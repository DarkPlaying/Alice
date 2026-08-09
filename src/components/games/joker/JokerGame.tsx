import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Timer, Shield, Activity, Users, LogOut, Award, AlertTriangle, Eye, Map, CheckCircle2, Briefcase, X, Trophy, XOctagon, CheckCircle, Snowflake, ShieldAlert, Home, Sparkles, Crown } from 'lucide-react';
import { supabase, supabaseUrl, supabaseKey, getAccessToken } from '../../../supabaseClient';
import type { JokerGameState, JokerPlayer, JokerPhase, DoorData, SpecialDoorCardType, MapCell } from './jokerTypes';
import { generateRotatedMap, getEntryCell, getRandomEntryCell, ensureTwentySpecialCards, placeTrumpCardInRandomCell, spawnCardsToNewLocation, parseMapMatrix, buildMapMatrixPayload } from './jokerMapData';
import { JokerMapGrid } from './JokerMapGrid';
import { JokerBriefing } from './JokerBriefing';
import { JokerDoorChooser } from './JokerDoorChooser';
import { JokerRevealOverlay } from './JokerRevealOverlay';
import { SlipCardGame } from './minigames/SlipCardGame';
import { ReflexGame } from './minigames/ReflexGame';
import { TrustPairsGame } from './minigames/TrustPairsGame';
import { Joker3DWorldCanvas } from './door3d/Joker3DWorldCanvas';
import { JokerFreezeModal } from './JokerFreezeModal';
import { JokerSkipModal } from './JokerSkipModal';
import { JokerRedCardModal } from './JokerRedCardModal';
import { JokerTrumpModal } from './JokerTrumpModal';
import { processDoorPurchase, processNoPurchasePenalty } from './jokerEngine';
import { getDefaultStartingInventory, SpecialCardMetadata, getCardCountInInventory, calculateRedCostMultiplier } from './jokerInventoryConfig';
import { JokerGameConfig } from './config/JokerGameConfig';

interface JokerGameProps {
    user?: any;
    onClose?: () => void;
}

const GAME_ID = 'joker_main';

const isSamePlayer = (p1: any, p2: any) => {
    if (!p1 || !p2) return false;
    if (p1.id && p2.id && p1.id === p2.id) return true;
    if (p1.username && p2.username && String(p1.username).toLowerCase() === String(p2.username).toLowerCase()) return true;
    return false;
};

export const deduplicateParticipants = (list: JokerPlayer[]): JokerPlayer[] => {
    if (!Array.isArray(list)) return [];
    const seenId = new Set<string>();
    const seenName = new Set<string>();
    const result: JokerPlayer[] = [];
    for (const p of list) {
        if (!p || !p.username) continue;
        const nameClean = String(p.username).trim().toLowerCase();

        const idKey = p.id;
        if (idKey && seenId.has(idKey)) continue;
        if (nameClean && seenName.has(nameClean)) continue;
        if (idKey) seenId.add(idKey);
        if (nameClean) seenName.add(nameClean);
        result.push(p);
    }
    return result;
};

export const JokerGame: React.FC<JokerGameProps> = ({ user, onClose }) => {
    const [gameState, setGameState] = useState<JokerGameState | null>(null);
    const [myPlayer, setMyPlayer] = useState<JokerPlayer | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(30);
    const [hasBoughtDoorThisRound, setHasBoughtDoorThisRound] = useState(false);
    const [activeMinigame, setActiveMinigame] = useState<'slip' | 'reflex' | 'trust' | null>(null);
    const [showWinnerMapOverlay, setShowWinnerMapOverlay] = useState(false);
    const [winnerMapTimer, setWinnerMapTimer] = useState(30);
    const [showInventoryModal, setShowInventoryModal] = useState(false);
    const [showFreezeModal, setShowFreezeModal] = useState(false);
    const [showSkipModal, setShowSkipModal] = useState(false);
    const [showRedCardModal, setShowRedCardModal] = useState(false);
    const [showTrumpModal, setShowTrumpModal] = useState(false);
    const [attackNullifiedAlert, setAttackNullifiedAlert] = useState<{ targetName: string; cardType: string } | null>(null);
    const [minigameResultState, setMinigameResultState] = useState<{
        show: boolean;
        won: boolean;
        scoreBonus: number;
        timeLeft: number;
    } | null>(null);

    const isRegisteringRef = useRef<boolean>(false);
    const prevRoundRef = useRef<number>(1);
    const myRedMultiplierRef = useRef<number>(1);
    const prevBlockedDoorsCountRef = useRef<number>(0);
    const [incomingRedAttackAlert, setIncomingRedAttackAlert] = useState<{
        show: boolean;
        direction: string;
        attackerName: string;
    } | null>(null);

    const [gameCardMapState, setGameCardMapState] = useState<{
        show: boolean;
        rotation: number;
        targetExitIndex: number;
        timeLeft: number;
    } | null>(null);

    const [showVictoryCard, setShowVictoryCard] = useState(false);

    // Synchronize & Award Final Visa Points to Supabase Profiles on Trial Victory / End
    const lastSavedScoreRef = useRef<{ [key: string]: number }>({});

    useEffect(() => {
        const currentPhaseStr = String(gameState?.phase || '');
        const isEndPhase = currentPhaseStr === 'end' 
            || currentPhaseStr === 'completed' 
            || myPlayer?.hasReachedExit 
            || myPlayer?.status === 'escaped' 
            || (gameState?.participants || []).some(p => p.hasReachedExit || p.status === 'escaped') 
            || showWinnerMapOverlay 
            || showVictoryCard;

        if (!isEndPhase) {
            lastSavedScoreRef.current = {};
            return;
        }

        const participants = gameState?.participants || [];
        if (participants.length === 0) return;

        const saveScores = async () => {
            const winnerPlayer = participants.find(p => p.hasReachedExit || p.status === 'escaped') ||
                participants.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];

            for (const p of participants) {
                try {
                    const targetUser = p.username || (p as any).email;
                    if (!targetUser) continue;

                    const hasEscaped = Boolean(p.hasReachedExit || p.status === 'escaped');
                    const baseGameScore = typeof p.score === 'number' ? p.score : 1000;
                    const delta = hasEscaped ? 1000 : -200;
                    const finalVisaPoints = Math.max(0, baseGameScore + delta);

                    // Skip redundant saves if score has not changed
                    if (lastSavedScoreRef.current[targetUser] === finalVisaPoints) continue;
                    lastSavedScoreRef.current[targetUser] = finalVisaPoints;

                    let query = supabase.from('profiles').select('id, email, username, visa_points');
                    if (targetUser.includes('@')) {
                        query = query.eq('email', targetUser);
                    } else {
                        query = query.or(`username.ilike.${targetUser},email.ilike.${targetUser}@borderland.app`);
                    }

                    const { data: prof, error: findErr } = await query.maybeSingle();

                    if (prof) {
                        console.log(`[JOKER_VISA_UPDATE] Syncing ${prof.username} (${prof.id}). Game Balance: ${baseGameScore} + Delta (${delta}) -> Final DB Visa: ${finalVisaPoints}`);

                        // 1. Update via Supabase Client by Profile UUID
                        const { error: clientErr } = await supabase
                            .from('profiles')
                            .update({ visa_points: finalVisaPoints })
                            .eq('id', prof.id);

                        if (clientErr) {
                            console.error('[JOKER_VISA_ERROR] Supabase client update error:', clientErr);
                        } else {
                            console.log(`[JOKER_VISA_SUCCESS] Supabase client updated ${prof.username} to ${finalVisaPoints}`);
                        }

                        // 2. Direct REST PATCH API Update with Bearer token & Prefer: return=minimal
                        try {
                            const accessToken = await getAccessToken();
                            const restRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${prof.id}`, {
                                method: 'PATCH',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${accessToken || supabaseKey}`,
                                    'apikey': supabaseKey,
                                    'Prefer': 'return=minimal'
                                },
                                body: JSON.stringify({ visa_points: finalVisaPoints })
                            });
                            console.log(`[JOKER_VISA_REST] REST PATCH Status: ${restRes.status}`);
                        } catch (restErr) {
                            console.warn('[JOKER_VISA_REST_NOTICE]', restErr);
                        }
                    }
                } catch (e) {
                    console.error('[JOKER_VISA_FATAL] Error in saveScores loop:', e);
                }
            }
        };

        saveScores();
    }, [gameState?.phase, myPlayer?.hasReachedExit, myPlayer?.status, myPlayer?.score, gameState?.participants, showWinnerMapOverlay, showVictoryCard]);

    // Popping Confetti Shower Effect (Referenced from C:\Users\Sanjay\Documents\memories\src\components\HeroSection.tsx)
    useEffect(() => {
        if (!showVictoryCard) return;

        // 1. Initial burst
        confetti({
            particleCount: 160,
            spread: 100,
            origin: { y: 0.6 },
            colors: ["#ff0844", "#ffb199", "#ff0050", "#10b981", "#3b82f6", "#f59e0b", "#ffffff"]
        });

        // 2. Continuous side-popping shower loop (matches HeroSection.tsx in memories project)
        const frame = () => {
            confetti({
                particleCount: 4,
                angle: 60,
                spread: 60,
                origin: { x: 0, y: 0.8 },
                colors: ["#ff0844", "#ffb199", "#ff0050", "#10b981", "#3b82f6", "#f59e0b", "#ffffff"]
            });
            confetti({
                particleCount: 4,
                angle: 120,
                spread: 60,
                origin: { x: 1, y: 0.8 },
                colors: ["#ff0844", "#ffb199", "#ff0050", "#10b981", "#3b82f6", "#f59e0b", "#ffffff"]
            });
        };

        const intervalId = setInterval(frame, 200);
        return () => clearInterval(intervalId);
    }, [showVictoryCard]);

    // 30s Rotated Map Overlay Timer Countdown & Spacebar Shortcut
    useEffect(() => {
        if (!gameCardMapState?.show) return;

        const timer = setInterval(() => {
            setGameCardMapState(prev => {
                if (!prev || prev.timeLeft <= 1) {
                    clearInterval(timer);
                    return null;
                }
                return { ...prev, timeLeft: prev.timeLeft - 1 };
            });
        }, 1000);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter' || e.code === 'Escape') {
                e.preventDefault();
                setGameCardMapState(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            clearInterval(timer);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [gameCardMapState?.show]);

    // Press Spacebar / Escape to acknowledge and close incoming Red Card attack warning modal
    useEffect(() => {
        if (!incomingRedAttackAlert?.show) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter' || e.code === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setIncomingRedAttackAlert(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [incomingRedAttackAlert?.show]);

    // Press Spacebar / Enter / Escape to acknowledge and close victim Trump Swap warning modal
    useEffect(() => {
        if (!myPlayer?.trumpSwappedBy) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter' || e.code === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                const updated = refundUsedCardsForPlayer({ ...myPlayer, trumpSwappedBy: undefined });
                setMyPlayer(updated);
                setHasBoughtDoorThisRound(false);
                const currentParticipants = gameState?.participants || [];
                const newParticipants = currentParticipants.map(p => isSamePlayer(p, updated) ? updated : p);
                syncParticipantsToState(newParticipants);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [myPlayer?.trumpSwappedBy]);

    // Press Spacebar / Enter / Escape to acknowledge and close victim Freeze warning modal
    useEffect(() => {
        if (!myPlayer?.frozenBy) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter' || e.code === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                handleAcknowledgeFreeze();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [myPlayer?.frozenBy]);

    // 30s Minigame Result Window Timer Countdown
    useEffect(() => {
        if (!minigameResultState?.show) return;

        const timer = setInterval(() => {
            setMinigameResultState(prev => {
                if (!prev) return null;
                if (prev.timeLeft <= 1) {
                    clearInterval(timer);
                    return null;
                }
                return { ...prev, timeLeft: prev.timeLeft - 1 };
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [minigameResultState?.show]);

    const isMasterRole = user?.role === 'master' || user?.role === 'admin' || user?.username === 'admin' || user?.username === 'SANJAY';

    // Realtime Sync & Polling Fallback
    const fetchState = async () => {
        try {
            const token = await getAccessToken();
            const res = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}&select=*`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseKey
                },
                cache: 'no-store'
            });
            if (res.ok) {
                const data = await res.json();
                const row = Array.isArray(data) ? data[0] : data;
                if (row) handleStateUpdate(row);
            }
        } catch (e) {
            console.error('[JOKER_GAME] Fetch error:', e);
        }
    };

    const findMyPlayerInList = (participants: JokerPlayer[], userObj: any): JokerPlayer | null => {
        if (!participants || participants.length === 0) return null;

        // Allow multi-tab local testing via ?p=1, ?p=2, ?p=3 or ?player=1, ?player=2, ?player=3
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const pParam = urlParams.get('p') || urlParams.get('player');
            if (pParam) {
                const pIdx = Math.max(0, parseInt(pParam, 10) - 1);
                if (participants[pIdx]) return participants[pIdx];
            }
        } catch (e) {
            // fallback to auth matching
        }

        if (userObj?.id) {
            const byId = participants.find(p => p.id === userObj.id);
            if (byId) return byId;
        }

        if (userObj?.username) {
            const byName = participants.find(p => p.username && p.username.toLowerCase() === String(userObj.username).toLowerCase());
            if (byName) return byName;
        }

        return participants[0];
    };

    const fetchVisaPointsForUserObj = async (userObj: any): Promise<number> => {
        if (!userObj) return 1000;
        if (typeof userObj.visa_points === 'number') return userObj.visa_points;
        try {
            const token = await getAccessToken();
            let pData: any[] = [];
            if (userObj.id) {
                const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userObj.id}&select=visa_points`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey, 'Accept': 'application/json' }
                });
                if (res.ok) pData = await res.json();
            }
            if ((!pData || pData.length === 0) && userObj.username) {
                const res = await fetch(`${supabaseUrl}/rest/v1/profiles?username=eq.${encodeURIComponent(userObj.username)}&select=visa_points`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey, 'Accept': 'application/json' }
                });
                if (res.ok) pData = await res.json();
            }
            if (pData && pData.length > 0 && typeof pData[0].visa_points === 'number') {
                return pData[0].visa_points;
            }
        } catch (e) {
            console.warn('[JOKER] Failed to fetch visa_points:', e);
        }
        return 1000;
    };

    const handleStateUpdate = (data: JokerGameState) => {
        if (data && data.participants) {
            data.participants = deduplicateParticipants(data.participants);

            // In Round 1 (before reveal phase), strictly enforce 1-to-1 unique gate distribution across participants
            if ((data.current_round || 1) === 1 && (data.phase === 'briefing' || data.phase === 'idle')) {
                const gridMatrix = data.map_matrix && data.map_matrix.length === 7 ? data.map_matrix : generateRotatedMap(data.map_rotation || 0);

                const shuffledGates = [1, 2, 3];
                for (let i = shuffledGates.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffledGates[i], shuffledGates[j]] = [shuffledGates[j], shuffledGates[i]];
                }

                let modified = false;
                data.participants.forEach((p, idx) => {
                    const assignedGate = shuffledGates[idx % shuffledGates.length];
                    if (!p.entryIndex || (p.currentR === 0 && p.currentC === 0)) {
                        p.entryIndex = assignedGate;
                        p.targetExitIndex = assignedGate;
                        const cell = getEntryCell(gridMatrix, assignedGate);
                        p.currentR = cell.r;
                        p.currentC = cell.c;
                        modified = true;
                    }
                });

                if (modified) {
                    const cleanedParts = [...data.participants];
                    getAccessToken().then(token => {
                        fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey },
                            body: JSON.stringify({ participants: cleanedParts })
                        }).catch(e => console.warn('[JOKER] Gate cleanup sync error:', e));
                    });
                }
            }
        }
        setGameState(data);

        // Bind or Register local player
        if (user) {
            const participants = data.participants || [];
            let me = findMyPlayerInList(participants, user);

            const parsedMapData = parseMapMatrix(data.map_matrix);
            const gridMatrix = parsedMapData.old_map && parsedMapData.old_map.length === 7 ? parsedMapData.old_map : generateRotatedMap(data.map_rotation || 0);

            // Register ONLY if participants is empty or me is genuinely missing in round 1
            if (!me && (data.current_round || 1) === 1 && data.phase !== 'end') {
                if (isRegisteringRef.current) return;
                isRegisteringRef.current = true;

                const randomEntryIdx = Math.floor(Math.random() * 3) + 1; // Random 1, 2, or 3
                const entryCell = getEntryCell(gridMatrix, randomEntryIdx);

                const registerPlayerAsync = async () => {
                    const finalScore = await fetchVisaPointsForUserObj(user);

                    const newMe: JokerPlayer = {
                        id: user.id || `user_${Date.now()}`,
                        username: user.username || 'AGENT',
                        avatar_url: user.avatar_url,
                        currentR: entryCell.r,
                        currentC: entryCell.c,
                        entryIndex: randomEntryIdx,
                        targetExitIndex: randomEntryIdx,
                        score: finalScore,
                        status: 'active',
                        inventory: getDefaultStartingInventory(),
                    };

                    try {
                        const token = await getAccessToken();
                        const stateRes = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}&select=participants`, {
                            headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey }
                        });
                        if (stateRes.ok) {
                            const stateData = await stateRes.json();
                            const latestParts = stateData[0]?.participants || [];
                            if (!latestParts.some((p: any) => p.id === newMe.id)) {
                                latestParts.push(newMe);
                                latestParts.forEach((p: any) => {
                                    if (!p.entryIndex) {
                                        p.entryIndex = Math.floor(Math.random() * 3) + 1;
                                        p.targetExitIndex = p.entryIndex;
                                        const eCell = getEntryCell(gridMatrix, p.entryIndex);
                                        p.currentR = eCell.r;
                                        p.currentC = eCell.c;
                                    }
                                });

                                await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey },
                                    body: JSON.stringify({ participants: latestParts })
                                });
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to sync new player:', e);
                    }
                };

                registerPlayerAsync();
            } else if (me) {
                const meEntryIdx = me.entryIndex || 1;
                const correctEntryCell = getEntryCell(gridMatrix, meEntryIdx);

                const isCurrentCellBlocked = me.currentR === undefined || me.currentC === undefined || !gridMatrix[me.currentR]?.[me.currentC] || (gridMatrix[me.currentR]?.[me.currentC]?.type as string) === 'wall' || (gridMatrix[me.currentR]?.[me.currentC]?.type as string) === 'empty' || (gridMatrix[me.currentR]?.[me.currentC]?.type as string) === 'blocked';

                const needsCoordCorrection =
                    isCurrentCellBlocked ||
                    ((data.current_round || 1) === 1 && !me.lastDoorChoice && (me.currentR !== correctEntryCell.r || me.currentC !== correctEntryCell.c));

                if (needsCoordCorrection) {
                    me = {
                        ...me,
                        currentR: correctEntryCell.r,
                        currentC: correctEntryCell.c,
                        entryIndex: meEntryIdx
                    };
                }

                // In Round 1, guarantee initial starting inventory if missing
                if ((data.current_round || 1) === 1) {
                    if (!me.inventory || me.inventory.length === 0) {
                        const initInv = getDefaultStartingInventory(false);
                        me = {
                            ...me,
                            inventory: initInv,
                            hasUsedGreenCard: false,
                            hasUsedSkipCard: false,
                            nextRoundCostMultiplier: calculateRedCostMultiplier(initInv, 0, false),
                            frozenBy: undefined,
                            frozenByPlayerId: undefined,
                            blockedDoorsByRed: [],
                            blockedByPlayerName: undefined,
                            blockedByPlayerId: undefined,
                            trumpSwappedBy: undefined
                        };
                    }
                }

                // In Round 1 briefing/idle, ensure player's score matches their true Visa Points if not yet verified
                if ((data.current_round || 1) === 1 && !(me as any)._visaScoreVerified) {
                    const verifyVisaScoreAsync = async () => {
                        const realVisa = await fetchVisaPointsForUserObj(user);
                        if (me && me.score !== realVisa) {
                            const correctedPlayer = {
                                ...me,
                                score: realVisa,
                                _visaScoreVerified: true
                            } as JokerPlayer;
                            const updatedParticipants = (data.participants || []).map(p => isSamePlayer(p, correctedPlayer) ? correctedPlayer : p);
                            syncParticipantsToState(updatedParticipants);
                        }
                    };
                    verifyVisaScoreAsync();
                }
            }

            if (me) {
                console.log(`[JOKER_GAME] State Update: Round ${data.current_round} | Phase: ${data.phase} | Player Pos: (${me.currentR}, ${me.currentC}) | Score: ${me.score}`);
                setMyPlayer(prev => {
                    if (me?.hasUsedGreenCard) {
                        myRedMultiplierRef.current = 1;
                    } else {
                        const calculatedMult = calculateRedCostMultiplier(me?.inventory || [], 0, Boolean(me?.frozenBy || me?.frozenByPlayerId));
                        myRedMultiplierRef.current = Math.min(6, Math.max(calculatedMult, me?.nextRoundCostMultiplier || 1));
                    }

                    let newMe = {
                        ...me!,
                        nextRoundCostMultiplier: me?.hasUsedGreenCard ? 1 : myRedMultiplierRef.current
                    };

                    const isNewRound = prevRoundRef.current !== data.current_round;
                    if (isNewRound) {
                        prevRoundRef.current = data.current_round;
                        prevBlockedDoorsCountRef.current = 0;
                        setIncomingRedAttackAlert(null);
                    }

                    if (isNewRound || data.phase === 'briefing' || !data.system_start) {
                        claimedCellCoordsRef.current.clear();
                    }

                    // Red Card door blocks only last 1 round! Reset blocked doors & temporary card effects whenever round changes or room position changes or phase is briefing
                    if (isNewRound || data.phase === 'briefing') {
                        newMe.frozenBy = undefined;
                        newMe.frozenByPlayerId = undefined;
                        newMe.lastDoorChoice = undefined;
                        newMe.pendingDoorChoice = undefined;
                        (newMe as any).boughtDoorChoice = undefined;
                        newMe.blockedDoorsByRed = [];
                        newMe.blockedByPlayerName = undefined;
                        newMe.blockedByPlayerId = undefined;
                        newMe.trumpSwappedBy = undefined;
                        setHasBoughtDoorThisRound(false);
                        prevBlockedDoorsCountRef.current = 0;
                        setIncomingRedAttackAlert(null);
                    } else if (prev && (prev.currentR !== newMe.currentR || prev.currentC !== newMe.currentC)) {
                        newMe.frozenBy = undefined;
                        newMe.frozenByPlayerId = undefined;
                        newMe.pendingDoorChoice = undefined;
                        newMe.blockedDoorsByRed = [];
                        newMe.blockedByPlayerName = undefined;
                        newMe.blockedByPlayerId = undefined;
                        setHasBoughtDoorThisRound(false);
                        prevBlockedDoorsCountRef.current = 0;
                        setIncomingRedAttackAlert(null);
                    }

                    // Trigger instant warning popup modal when affected by a Red Card door block attack
                    const currBlocked = newMe.blockedDoorsByRed || [];
                    if (currBlocked.length > prevBlockedDoorsCountRef.current) {
                        const latestBlockedDir = currBlocked[currBlocked.length - 1];
                        setIncomingRedAttackAlert({
                            show: true,
                            direction: latestBlockedDir,
                            attackerName: newMe.blockedByPlayerName || 'AN OPPONENT'
                        });
                    } else if (currBlocked.length === 0) {
                        setIncomingRedAttackAlert(null);
                    }
                    prevBlockedDoorsCountRef.current = currBlocked.length;

                    const isFrozen = !!newMe.frozenBy || (newMe.nextRoundCostMultiplier && newMe.nextRoundCostMultiplier > 1);
                    if (
                        prev?.pendingDoorChoice?.door &&
                        !newMe.pendingDoorChoice?.door &&
                        data.phase === 'choosing' &&
                        prev.currentR === newMe.currentR &&
                        prev.currentC === newMe.currentC
                    ) {
                        newMe.pendingDoorChoice = prev.pendingDoorChoice;
                    }
                    if (data.phase === 'choosing') {
                        newMe.lastDoorChoice = undefined;
                    }
                    return newMe;
                });
            }
        }
    };

    useEffect(() => {
        fetchState();
        const channel = supabase
            .channel('joker_game_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'joker_game_state', filter: `id=eq.${GAME_ID}` }, payload => {
                if (payload.new) handleStateUpdate(payload.new as JokerGameState);
            })
            .subscribe();

        const pollTimer = setInterval(fetchState, 3000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollTimer);
        };
    }, [user?.id, user?.username]);

    // Reset local player choice & sync minigames with admin
    useEffect(() => {
        setHasBoughtDoorThisRound(false);
        if (![4, 8, 12].includes(gameState?.current_round || 0) || gameState?.phase !== 'choosing') {
            setActiveMinigame(null);
        }
    }, [gameState?.current_round, gameState?.phase]);

    // Auto-close card & inventory modals when final lock threshold (10s) is reached
    useEffect(() => {
        if (gameState?.phase === 'choosing' && JokerGameConfig.isDoorLockRestricted(timeLeft)) {
            setShowInventoryModal(false);
            setShowRedCardModal(false);
            setShowFreezeModal(false);
            setShowSkipModal(false);
            setShowTrumpModal(false);
        }
    }, [gameState?.phase, timeLeft]);

    // Refund logic: If player activated a special card in choosing phase but DID NOT end up using it in a locked door choice, refund it back to inventory during reveal phase!
    useEffect(() => {
        if (gameState?.phase === 'reveal' && myPlayer) {
            const hasLockedDoorChoice = !!(myPlayer.pendingDoorChoice?.door || myPlayer.boughtDoorChoice?.door || myPlayer.lastDoorChoice?.door);
            let needsRefund = false;
            let currentInv = [...(myPlayer.inventory || [])];
            let updateProps: Partial<JokerPlayer> = {};

            // 1. Green Card refund if no door locked or green card cost wasn't applied
            if (myPlayer.hasUsedGreenCard) {
                const wasGreenApplied = hasLockedDoorChoice && (myPlayer.pendingDoorChoice?.finalCost === 0 || myPlayer.boughtDoorChoice?.finalCost === 0 || myPlayer.lastDoorChoice?.finalCost === 0);
                if (!wasGreenApplied) {
                    currentInv.push('green');
                    updateProps.hasUsedGreenCard = false;
                    needsRefund = true;
                    console.log('[JOKER_REFUND] Green Card unused in round. Refunded 1 Green Card to inventory.');
                }
            }

            // 2. Skip Card refund if no door locked or skip movement wasn't applied
            if (myPlayer.hasUsedSkipCard) {
                const wasSkipApplied = hasLockedDoorChoice && (myPlayer.pendingDoorChoice?.isSkip || myPlayer.boughtDoorChoice?.isSkip || myPlayer.lastDoorChoice?.isSkip);
                if (!wasSkipApplied) {
                    currentInv.push('skip');
                    updateProps.hasUsedSkipCard = false;
                    needsRefund = true;
                    console.log('[JOKER_REFUND] Skip Card unused in round. Refunded 1 Skip Card to inventory.');
                }
            }

            if (needsRefund) {
                const refundedMe: JokerPlayer = {
                    ...myPlayer,
                    ...updateProps,
                    inventory: currentInv
                };
                setMyPlayer(refundedMe);
                const currentParticipants = gameState?.participants || [];
                const updatedParts = currentParticipants.map(p => isSamePlayer(p, refundedMe) ? refundedMe : p);
                syncParticipantsToState(updatedParts);
            }
        }
    }, [gameState?.phase, gameState?.current_round]);

    // Timer Sync & Auto-Advancement when timeLeft === 0
    useEffect(() => {
        if (!gameState?.phase_started_at) return;

        const updateTimer = () => {
            if (!gameState?.phase_started_at || typeof gameState.phase_started_at !== 'string') {
                setTimeLeft(gameState?.phase_duration_sec || 30);
                return;
            }
            let startStr = String(gameState.phase_started_at).trim().replace(' ', 'T');
            if (startStr.match(/[+-]\d{2}$/)) startStr += ':00';
            if (!startStr.endsWith('Z') && !startStr.match(/[+-]\d{2}:?\d{2}$/)) startStr += 'Z';
            const startTime = new Date(startStr).getTime();
            if (isNaN(startTime)) {
                setTimeLeft(gameState?.phase_duration_sec || 30);
                return;
            }
            const now = new Date().getTime();
            const elapsed = Math.floor((now - startTime) / 1000);
            const remaining = Math.max(0, (gameState.phase_duration_sec || 30) - elapsed);
            setTimeLeft(isNaN(remaining) ? 0 : remaining);

            if (gameState.phase === 'choosing' && [4, 8, 12].includes(gameState.current_round)) {
                if (gameState.current_round === 4) setActiveMinigame('slip');
                if (gameState.current_round === 8) setActiveMinigame('reflex');
                if (gameState.current_round === 12) setActiveMinigame('trust');
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 500);
        return () => clearInterval(interval);
    }, [gameState?.phase_started_at, gameState?.phase_duration_sec, gameState?.phase, gameState?.current_round]);



    const syncParticipantsToState = async (updatedParticipants: JokerPlayer[]) => {
        try {
            const token = await getAccessToken();
            // Fetch latest state to prevent race conditions overriding other players' choices
            const res = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}&select=participants`, {
                headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey }
            });
            let latestParticipants = updatedParticipants;
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0 && Array.isArray(data[0].participants)) {
                    // Merge my updated player into the latest participants array
                    const me = findMyPlayerInList(updatedParticipants, user) || updatedParticipants[0];
                    const myPlayerId = me?.id;
                    if (me && myPlayerId) {
                        latestParticipants = data[0].participants.map((p: any) => {
                            if (p.id === myPlayerId || (p.username && me.username && String(p.username).toLowerCase() === String(me.username).toLowerCase())) {
                                const choice = me.boughtDoorChoice || me.lastDoorChoice || me.pendingDoorChoice || p.boughtDoorChoice || p.lastDoorChoice || p.pendingDoorChoice;
                                return {
                                    ...me,
                                    boughtDoorChoice: me.boughtDoorChoice || choice,
                                    lastDoorChoice: me.lastDoorChoice || choice,
                                    pendingDoorChoice: me.pendingDoorChoice || p.pendingDoorChoice
                                };
                            }
                            return p;
                        });
                        if (!latestParticipants.some((p: any) => isSamePlayer(p, me))) {
                            latestParticipants.push(me);
                        }
                    }
                }
            }

            setGameState((prev: any) => prev ? { ...prev, participants: deduplicateParticipants(latestParticipants) } : prev);

            // Send network sync asynchronously in background without delaying UI updates
            fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseKey
                },
                body: JSON.stringify({ participants: deduplicateParticipants(latestParticipants) })
            }).catch(e => console.error('[JOKER_GAME] Background sync error:', e));
        } catch (e) {
            console.error('[JOKER_GAME] Sync error:', e);
        }
    };

    const handleClaimSpecialCard = (input: any) => {
        if (!myPlayer || !input) return;
        const typesToClaim: SpecialDoorCardType[] = Array.isArray(input)
            ? input.filter((t: any) => t && t !== 'none' && t !== 'standard')
            : (input !== 'none' && input !== 'standard' ? [input] : []);

        if (typesToClaim.length === 0) return;

        const currentInv = myPlayer.inventory || [];
        const newItems = typesToClaim.filter(t => !currentInv.includes(t));

        if (newItems.length === 0) return;

        const updatedMe: JokerPlayer = {
            ...myPlayer,
            inventory: [...currentInv, ...newItems]
        };

        setMyPlayer(updatedMe);
        const currentParticipants = gameState?.participants || [];
        const newParticipants = currentParticipants.map((p: any) => isSamePlayer(p, updatedMe) ? updatedMe : p);
        syncParticipantsToState(newParticipants);
    };

    // Door Purchase Handler (Store choice and instantly deduct/refund score in UI & DB)
    const handleSelectDoor = (door: DoorData | null, finalCost: number, isSkip: boolean) => {
        if (!myPlayer || !gameState) return;

        const currentParticipants = gameState.participants || [];

        if (!door) {
            // Player unlocked their door choice.
            const updatedPlayer: JokerPlayer = {
                ...myPlayer,
                pendingDoorChoice: undefined
            };
            setMyPlayer(updatedPlayer);
            setHasBoughtDoorThisRound(false);
            const newParticipants = currentParticipants.map(p => isSamePlayer(p, updatedPlayer) ? updatedPlayer : p);
            syncParticipantsToState(newParticipants);
            return;
        }

        // Player locked a door. Do NOT deduct score here, Master deducts it in Reveal Phase
        const doorChoiceObj = { door, finalCost, isSkip, isLocked: true };
        const updatedPlayer: JokerPlayer = {
            ...myPlayer,
            pendingDoorChoice: doorChoiceObj,
            lastDoorChoice: doorChoiceObj,
            boughtDoorChoice: doorChoiceObj
        };

        console.log(`[JOKER_GAME] Door Selected: ${door.direction.toUpperCase()} | Cost: ${finalCost} CR | Pos: (${myPlayer.currentR}, ${myPlayer.currentC})`);

        setMyPlayer(updatedPlayer);
        setHasBoughtDoorThisRound(true);

        const newParticipants = currentParticipants.map(p => isSamePlayer(p, updatedPlayer) ? updatedPlayer : p);
        syncParticipantsToState(newParticipants);

        const patchDoorChoiceToDB = async (pts: JokerPlayer[]) => {
            try {
                const token = await getAccessToken();
                await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'apikey': supabaseKey
                    },
                    body: JSON.stringify({ participants: pts })
                });
            } catch (e) {
                console.error('[JOKER_GAME] Error patching door choice to DB:', e);
            }
        };
        patchDoorChoiceToDB(newParticipants);
    };

    // Room Entry Handler (When Phase 3 Reveal door is entered manually or 30s auto-teleport)
    const handleEnterRoom = () => {
        if (!myPlayer || !gameState) return;
        const choice = myPlayer.pendingDoorChoice || myPlayer.lastDoorChoice || (myPlayer as any).boughtDoorChoice;
        if (!choice?.door) return;

        const { door, finalCost, isSkip } = choice;
        const gridMatrix = gameState.map_matrix && gameState.map_matrix.length === 7 ? gameState.map_matrix : generateRotatedMap(gameState.map_rotation || 0);

        const { updatedPlayer } = processDoorPurchase(myPlayer, door, finalCost, isSkip, gridMatrix);

        updatedPlayer.pendingDoorChoice = undefined;
        updatedPlayer.lastDoorChoice = { ...choice, isProcessed: true };
        (updatedPlayer as any).boughtDoorChoice = { ...choice, isProcessed: true };

        setMyPlayer(updatedPlayer);

        const currentParticipants = gameState.participants || [];
        const newParticipants = currentParticipants.map(p => isSamePlayer(p, updatedPlayer) ? updatedPlayer : p);
        syncParticipantsToState(newParticipants);
    };

    // Special Card Inventory Usage
    const handleUseInventoryCard = (card: SpecialDoorCardType) => {
        if (!myPlayer || !gameState || gameState.phase !== 'choosing') return;
        if (JokerGameConfig.isDoorLockRestricted(timeLeft)) {
            console.warn(`[JOKER_GAME] Card activation blocked: Final ${JokerGameConfig.DOOR_LOCK_DISABLE_THRESHOLD_SEC} seconds threshold reached.`);
            setShowInventoryModal(false);
            setShowRedCardModal(false);
            setShowFreezeModal(false);
            setShowSkipModal(false);
            setShowTrumpModal(false);
            return;
        }

        if (card === 'freeze') {
            setShowFreezeModal(true);
            setShowInventoryModal(false);
            return;
        }

        if (card === 'skip') {
            setShowSkipModal(true);
            setShowInventoryModal(false);
            return;
        }

        if (card === 'red') {
            setShowRedCardModal(true);
            setShowInventoryModal(false);
            return;
        }

        if (card === 'trump') {
            setShowTrumpModal(true);
            setShowInventoryModal(false);
            return;
        }

        if (card === 'game') {
            const gameIdx = myPlayer.inventory.indexOf('game');
            if (gameIdx === -1) return;
            const updatedInventory = myPlayer.inventory.filter((_, idx) => idx !== gameIdx);

            const possibleRotations = [90, 180, 270];
            const randomRot = possibleRotations[Math.floor(Math.random() * possibleRotations.length)];

            const updatedMe = {
                ...myPlayer,
                inventory: updatedInventory
            };
            setMyPlayer(updatedMe);
            setShowInventoryModal(false);

            setGameCardMapState({
                show: true,
                rotation: randomRot,
                targetExitIndex: myPlayer.targetExitIndex || 1,
                timeLeft: 30
            });
            return;
        }

        let updatedInventory = myPlayer.inventory.filter((c, idx) => idx !== myPlayer.inventory.indexOf(card));
        
        let updatedPlayer: JokerPlayer = {
            ...myPlayer,
            inventory: updatedInventory,
            pendingDoorChoice: undefined // Unselect selected door on card use to avoid cost/movement glitches
        };

        if (card === 'green') {
            myRedMultiplierRef.current = 1;
            // Using Green Card resets red penalty multiplier back to 1X, clears ALL blocked doors, and nullifies Freeze, while keeping Red attack cards!
            updatedPlayer = {
                ...updatedPlayer,
                inventory: updatedInventory,
                hasUsedGreenCard: true,
                nextRoundCostMultiplier: 1,
                blockedDoorsByRed: [],
                frozenBy: undefined,
                frozenByPlayerId: undefined
            };
        }

        setMyPlayer(updatedPlayer);
        setHasBoughtDoorThisRound(false);
        const currentParticipants = gameState?.participants || [];
        const newParticipants = currentParticipants.map(p => isSamePlayer(p, updatedPlayer) ? updatedPlayer : p);
        syncParticipantsToState(newParticipants);

        const patchParticipantsToDB = async (pts: JokerPlayer[]) => {
            try {
                const token = await getAccessToken();
                await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'apikey': supabaseKey
                    },
                    body: JSON.stringify({ participants: pts })
                });
            } catch (e) {
                console.error('[JOKER_GAME] Error patching card activation to DB:', e);
            }
        };
        patchParticipantsToDB(newParticipants);
    };

    const handleConfirmSkipCard = () => {
        if (!myPlayer || !gameState || gameState.phase !== 'choosing' || timeLeft <= 10) return;
        const currentInv = myPlayer.inventory || [];
        const skipIdx = currentInv.indexOf('skip');
        if (skipIdx === -1) return;

        const updatedInventory = currentInv.filter((_, idx) => idx !== skipIdx);
        const updatedPlayer: JokerPlayer = {
            ...myPlayer,
            inventory: updatedInventory,
            hasUsedSkipCard: true,
            pendingDoorChoice: undefined // Unselect selected door choice
        };
        setMyPlayer(updatedPlayer);
        setHasBoughtDoorThisRound(false);
        const currentParticipants = gameState?.participants || [];
        const newParticipants = currentParticipants.map(p => isSamePlayer(p, updatedPlayer) ? updatedPlayer : p);
        syncParticipantsToState(newParticipants);

        const patchParticipantsToDB = async (pts: JokerPlayer[]) => {
            try {
                const token = await getAccessToken();
                await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'apikey': supabaseKey
                    },
                    body: JSON.stringify({ participants: pts })
                });
            } catch (e) {
                console.error('[JOKER_GAME] Error patching card activation to DB:', e);
            }
        };
        patchParticipantsToDB(newParticipants);
    };

    const handleRefundSkipCard = () => {
        if (!myPlayer) return;
        const currentInv = myPlayer.inventory || [];
        const updatedPlayer: JokerPlayer = {
            ...myPlayer,
            hasUsedSkipCard: false,
            inventory: [...currentInv, 'skip']
        };
        setMyPlayer(updatedPlayer);
        const currentParticipants = gameState?.participants || [];
        const newParticipants = currentParticipants.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
        syncParticipantsToState(newParticipants);
    };

    const claimedCellCoordsRef = useRef<Set<string>>(new Set());

    // Auto-claim cards DURING REVEAL PHASE when candidate enters destination room
    useEffect(() => {
        if (!myPlayer || !gameState || gameState.phase !== 'reveal' || myPlayer.trumpSwappedBy) return;
        const parsedMap = parseMapMatrix(gameState.map_matrix);
        const fallbackRotationMap = generateRotatedMap(gameState.map_rotation || 0);
        const activeOldMap = parsedMap.old_map && parsedMap.old_map.length === 7 ? parsedMap.old_map : fallbackRotationMap;
        const activeNewBase = parsedMap.new_map && parsedMap.new_map.length === 7 ? parsedMap.new_map : activeOldMap;

        let claimR = myPlayer.currentR;
        let claimC = myPlayer.currentC;
        const doorChoice = myPlayer.pendingDoorChoice || (myPlayer as any).boughtDoorChoice || (myPlayer as any).lastDoorChoice;
        if (doorChoice?.door?.direction) {
            const dir = doorChoice.door.direction;
            const isSkip = Boolean(doorChoice.isSkip);
            const step = isSkip ? 2 : 1;
            let candR = claimR;
            let candC = claimC;
            if (dir === 'up' || dir === 'north') candR = Math.max(0, candR - step);
            if (dir === 'down' || dir === 'south') candR = Math.min(6, candR + step);
            if (dir === 'left' || dir === 'west') candC = Math.max(0, candC - step);
            if (dir === 'right' || dir === 'east') candC = Math.min(6, candC + step);

            const destCell = activeOldMap[candR]?.[candC];
            if (destCell && destCell.type !== 'wall' && !destCell.isBlockedCell) {
                claimR = candR;
                claimC = candC;
            }
        }

        const currentCell = activeOldMap[claimR]?.[claimC];

        if (currentCell && currentCell.specialCards && currentCell.specialCards.length > 0) {
            const playerRoundCellKey = `${gameState.current_round}_${myPlayer.id}_${claimR}_${claimC}`;

            if (claimedCellCoordsRef.current.has(playerRoundCellKey)) {
                return;
            }

            const cardsToClaim = currentCell.specialCards.filter((c: string) => c && c !== 'none');
            if (cardsToClaim.length === 0) return;

            claimedCellCoordsRef.current.add(playerRoundCellKey);

            const newInventory = [...(myPlayer.inventory || [])];
            cardsToClaim.forEach((spec: any) => {
                newInventory.push(spec);
            });

            const nextRoundCostMultiplier = calculateRedCostMultiplier(newInventory, 0, Boolean(myPlayer.frozenBy || myPlayer.frozenByPlayerId));
            myRedMultiplierRef.current = nextRoundCostMultiplier;

            console.log(`[CARD CLAIM LOG] Candidate "${myPlayer.username}" claimed card(s): [${cardsToClaim.join(', ')}] at room cell (${claimR}, ${claimC}). New Multiplier: ${nextRoundCostMultiplier}X.`);

            const updatedNewMatrix = spawnCardsToNewLocation(activeNewBase, claimR, claimC, cardsToClaim);
            const payloadMatrix = buildMapMatrixPayload(activeOldMap, activeOldMap, updatedNewMatrix);

            const updatedPlayer = {
                ...myPlayer,
                inventory: newInventory,
                nextRoundCostMultiplier
            };
            setMyPlayer(updatedPlayer);
            setGameState(prev => prev ? { ...prev, map_matrix: payloadMatrix } as any : prev);

            const currentParticipants = gameState.participants || [];
            const newParticipants = currentParticipants.map(p => isSamePlayer(p, updatedPlayer) ? updatedPlayer : p);
            syncParticipantsToState(newParticipants);

            const claimCardsInDB = async () => {
                try {
                    const token = await getAccessToken();
                    await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'apikey': supabaseKey
                        },
                        body: JSON.stringify({
                            map_matrix: payloadMatrix,
                            participants: newParticipants
                        })
                    });
                } catch (e) {
                    console.error('[JOKER_GAME] Claim cards error:', e);
                }
            };
            claimCardsInDB();
        }
    }, [myPlayer?.currentR, myPlayer?.currentC, gameState?.phase, gameState?.current_round, JSON.stringify(gameState?.map_matrix)]);

    const handleExecuteFreeze = async (targetPlayerId: string) => {
        if (!myPlayer || !gameState) return;

        const targetPlayer = (gameState.participants || []).find(p => p.id === targetPlayerId || (p.username && myPlayer.username && p.username !== myPlayer.username));
        if (!targetPlayer || isSamePlayer(targetPlayer, myPlayer)) return;

        // 1. Remove freeze card from inventory and unselect selected door
        const freezeIdx = myPlayer.inventory.indexOf('freeze');
        if (freezeIdx === -1) return;
        const updatedInventory = myPlayer.inventory.filter((_, idx) => idx !== freezeIdx);
        const updatedMe = {
            ...myPlayer,
            inventory: updatedInventory,
            pendingDoorChoice: undefined // Unselect selected door on card use
        };
        setMyPlayer(updatedMe);
        setHasBoughtDoorThisRound(false);
        setShowFreezeModal(false);

        // 2. Fetch latest state and apply freeze to target
        try {
            const token = await getAccessToken();
            const res = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}&select=participants`, {
                headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0 && data[0].participants) {
                    const isTargetPlayer = (p: any) => {
                        if (!p) return false;
                        if (p.id && targetPlayerId && p.id === targetPlayerId) return true;
                        if (p.username && targetPlayer.username && String(p.username).toLowerCase() === String(targetPlayer.username).toLowerCase()) return true;
                        return false;
                    };

                    const latestParticipants = data[0].participants.map((p: any) => {
                        if (isSamePlayer(p, updatedMe)) {
                            return updatedMe;
                        }
                        if (isTargetPlayer(p)) {
                            if (p.hasUsedGreenCard) {
                                setAttackNullifiedAlert({
                                    targetName: p.username || 'TARGET CANDIDATE',
                                    cardType: 'FREEZE CARD'
                                });
                                return p;
                            }
                            const targetRedCount = getCardCountInInventory(p.inventory || [], 'red');
                            const targetRedMult = targetRedCount >= 3 ? 6 : targetRedCount === 2 ? 4 : targetRedCount === 1 ? 2 : 1;
                            const combinedMult = 5 + (targetRedMult > 1 ? targetRedMult : 0);

                            return {
                                ...p,
                                frozenBy: myPlayer.username || 'AGENT',
                                frozenByPlayerId: myPlayer.id,
                                nextRoundCostMultiplier: combinedMult,
                                pendingDoorChoice: undefined // Unselect target player's door choice
                            };
                        }
                        return p;
                    });

                    await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'apikey': supabaseKey
                        },
                        body: JSON.stringify({ participants: latestParticipants })
                    });
                }
            }
        } catch (e) {
            console.error('[JOKER_GAME] Freeze execution error:', e);
        }
    };

    const handleExecuteRedCardBlock = async (targetPlayerId: string, direction: 'up' | 'right' | 'down' | 'left') => {
        if (!myPlayer || !gameState) return;

        const targetPlayer = (gameState.participants || []).find(p => !isSamePlayer(p, myPlayer) && ((p.id && p.id === targetPlayerId) || (p.username && String(p.username).toLowerCase() === String(targetPlayerId).toLowerCase())));
        if (!targetPlayer || isSamePlayer(targetPlayer, myPlayer)) return;

        const redIdx = myPlayer.inventory.indexOf('red');
        if (redIdx === -1) return;
        const updatedInventory = myPlayer.inventory.filter((_, idx) => idx !== redIdx);

        const updatedMe = {
            ...myPlayer,
            inventory: updatedInventory,
            nextRoundCostMultiplier: myRedMultiplierRef.current,
            pendingDoorChoice: undefined
        };
        setMyPlayer(updatedMe);
        setHasBoughtDoorThisRound(false);
        setShowRedCardModal(false);

        try {
            const token = await getAccessToken();
            const res = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}&select=participants`, {
                headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0 && data[0].participants) {
                    const isTargetPlayer = (p: any) => {
                        if (!p) return false;
                        if (p.id && targetPlayer.id && p.id === targetPlayer.id) return true;
                        if (p.username && targetPlayer.username && String(p.username).toLowerCase() === String(targetPlayer.username).toLowerCase()) return true;
                        return false;
                    };

                    const latestParticipants = data[0].participants.map((p: any) => {
                        if (isSamePlayer(p, updatedMe)) {
                            return updatedMe;
                        }
                        if (isTargetPlayer(p)) {
                            if (p.hasUsedGreenCard) {
                                setAttackNullifiedAlert({
                                    targetName: p.username || 'TARGET CANDIDATE',
                                    cardType: 'RED CARD BLOCK'
                                });
                                return p;
                            }
                            const existingBlocked = p.blockedDoorsByRed || [];
                            const newBlocked = existingBlocked.includes(direction) ? existingBlocked : [...existingBlocked, direction];
                            return {
                                ...p,
                                blockedDoorsByRed: newBlocked,
                                blockedByPlayerName: myPlayer.username || 'AN OPPONENT',
                                blockedByPlayerId: myPlayer.id
                            };
                        }
                        return p;
                    });

                    await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'apikey': supabaseKey
                        },
                        body: JSON.stringify({ participants: latestParticipants })
                    });
                }
            }
        } catch (e) {
            console.error('[JOKER_GAME] Red Card execution error:', e);
        }
    };

    const refundUsedCardsForPlayer = (p: JokerPlayer): JokerPlayer => {
        let inv = [...(p.inventory || [])];

        const restoredMult = calculateRedCostMultiplier(inv, 0, Boolean(p.frozenBy || p.frozenByPlayerId));

        return {
            ...p,
            inventory: inv,
            hasUsedGreenCard: false,
            hasUsedSkipCard: false,
            nextRoundCostMultiplier: restoredMult,
            pendingDoorChoice: undefined
        };
    };

    const handleExecuteTrumpSwap = async (targetPlayerId: string) => {
        if (!myPlayer || !gameState) return;

        const trumpIdx = (myPlayer.inventory || []).indexOf('trump');
        if (trumpIdx === -1) return;

        const updatedInventory = myPlayer.inventory.filter((_, idx) => idx !== trumpIdx);
        setShowTrumpModal(false);

        try {
            const token = await getAccessToken();
            const res = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}&select=participants`, {
                headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0 && Array.isArray(data[0].participants)) {
                    const dbParticipants: JokerPlayer[] = data[0].participants;

                    const meInDB = dbParticipants.find(p => isSamePlayer(p, myPlayer));
                    const targetInDB = dbParticipants.find(p => (p.id && p.id === targetPlayerId) || (p.username && targetPlayerId && String(p.username).toLowerCase() === String(targetPlayerId).toLowerCase()));

                    if (!meInDB || !targetInDB) return;

                    const meFreshR = Number(meInDB.currentR ?? 0);
                    const meFreshC = Number(meInDB.currentC ?? 0);
                    const targetFreshR = Number(targetInDB.currentR ?? 0);
                    const targetFreshC = Number(targetInDB.currentC ?? 0);

                    // Atomic swap: candidate 1 gets candidate 2's fresh room, candidate 2 gets candidate 1's fresh room
                    const updatedMe: JokerPlayer = refundUsedCardsForPlayer({
                        ...meInDB,
                        currentR: targetFreshR,
                        currentC: targetFreshC,
                        inventory: updatedInventory
                    });

                    const updatedTarget: JokerPlayer = refundUsedCardsForPlayer({
                        ...targetInDB,
                        currentR: meFreshR,
                        currentC: meFreshC,
                        trumpSwappedBy: myPlayer.username || 'AN OPPONENT',
                        trumpSwappedFromRoom: { r: targetFreshR, c: targetFreshC },
                        trumpSwappedToRoom: { r: meFreshR, c: meFreshC }
                    });

                    setMyPlayer(updatedMe);
                    setHasBoughtDoorThisRound(false);

                    const latestParticipants = dbParticipants.map((p: JokerPlayer) => {
                        if (isSamePlayer(p, updatedMe)) return updatedMe;
                        if (isSamePlayer(p, updatedTarget)) return updatedTarget;
                        return p;
                    });

                    await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'apikey': supabaseKey
                        },
                        body: JSON.stringify({ participants: latestParticipants })
                    });
                }
            }
        } catch (e) {
            console.error('[JOKER_GAME] Trump swap execution error:', e);
        }
    };

    const handleUnblockDoorWithGreenCard = async (direction: 'up' | 'right' | 'down' | 'left') => {
        if (!myPlayer || !gameState) return;
        const greenIdx = (myPlayer.inventory || []).indexOf('green');
        if (greenIdx === -1) return;

        const updatedInventory = myPlayer.inventory.filter((_, idx) => idx !== greenIdx);
        const updatedNoRedInv = updatedInventory.filter(c => c !== 'red');
        const updatedMe: JokerPlayer = {
            ...myPlayer,
            inventory: updatedNoRedInv,
            blockedDoorsByRed: [],
            hasUsedGreenCard: true,
            nextRoundCostMultiplier: 1,
            frozenBy: undefined,
            frozenByPlayerId: undefined
        };

        setMyPlayer(updatedMe);
        const currentParticipants = gameState.participants || [];
        const newParticipants = currentParticipants.map(p => isSamePlayer(p, updatedMe) ? updatedMe : p);
        syncParticipantsToState(newParticipants);
    };

    // Minigame Completion Handler (NO MINUS MARKS, 30S TOP LAYER RESULT MODAL)
    const handleMinigameComplete = (success: boolean, scoreBonus: number) => {
        setActiveMinigame(null);
        const finalBonus = Math.max(0, scoreBonus); // NO MINUS MARKS!

        if (myPlayer) {
            const updatedPlayer: JokerPlayer = {
                ...myPlayer,
                score: myPlayer.score + finalBonus
            };
            setMyPlayer(updatedPlayer);
            const currentParticipants = gameState?.participants || [];
            const newParticipants = currentParticipants.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
            syncParticipantsToState(newParticipants);
        }

        // Open 30-Second Top Layer Result Window (Map for Winner, "YOU DIDN'T WIN" for Loser)
        setMinigameResultState({
            show: true,
            won: success,
            scoreBonus: finalBonus,
            timeLeft: 30
        });
    };

    // Instant Game End on Exit Reach
    const handlePlayerWin = async (winner: JokerPlayer) => {
        setShowWinnerMapOverlay(true);
        setWinnerMapTimer(30);

        const currentParticipants = gameState?.participants || [];
        const finalParticipants = currentParticipants.map(p => {
            if (p.id === winner.id) {
                return { ...p, score: p.score + 1000, status: 'escaped' as const };
            }
            return { ...p, score: Math.max(0, p.score - 200), status: 'eliminated' as const };
        });

        try {
            const token = await getAccessToken();
            await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseKey
                },
                body: JSON.stringify({
                    phase: 'end',
                    winner_id: winner.id,
                    participants: finalParticipants
                })
            });
        } catch (e) {
            console.error('[JOKER_GAME] Win sync error:', e);
        }
    };

    const handleAcknowledgeFreeze = async () => {
        if (!myPlayer || !gameState) return;
        const updatedMe = { ...myPlayer, frozenBy: undefined };
        setMyPlayer(updatedMe);
        try {
            const token = await getAccessToken();
            const res = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}&select=participants`, {
                headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0 && data[0].participants) {
                    const latestParticipants = data[0].participants.map((p: any) => isSamePlayer(p, updatedMe) ? updatedMe : p);
                    await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'apikey': supabaseKey
                        },
                        body: JSON.stringify({ participants: latestParticipants })
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const parsedMapData = parseMapMatrix(gameState?.map_matrix);
    const gridMatrix = parsedMapData.old_map && parsedMapData.old_map.length === 7 ? parsedMapData.old_map : generateRotatedMap(gameState?.map_rotation || 0);
    const fallbackEntry = getEntryCell(gridMatrix, myPlayer?.entryIndex || 1);
    // Only fall back to entry gate if cell is TRULY missing or a wall — path/entry/exit are all valid
    const rawCell = myPlayer ? gridMatrix[myPlayer.currentR]?.[myPlayer.currentC] : undefined;
    const currentCell = (rawCell && rawCell.type !== 'wall') ? rawCell : gridMatrix[fallbackEntry.r][fallbackEntry.c];

    return (
        <div className="w-full min-h-screen bg-white text-slate-900 font-mono flex flex-col items-center justify-start p-4 relative overflow-y-auto select-none">
            {/* Top White Header HUD (Rendered for briefing phase or minigames) */}
            {(gameState?.phase === 'briefing' || activeMinigame) && (
                <header className="w-full max-w-6xl mx-auto p-4 bg-white/95 border border-slate-300 rounded-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md relative z-40">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-100 border border-slate-300 rounded-xl shadow-sm">
                            <img src="/suit_assets/Joker Game.png" alt="Joker Logo" className="w-7 h-7 object-contain" />
                        </div>
                        <div>
                            <h1 className="font-cinzel text-xl sm:text-2xl font-black text-slate-950 tracking-widest uppercase">
                                JOKER TRIAL <span className="text-slate-500 font-extrabold">:: LOGIC LABYRINTH</span>
                            </h1>
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">
                                SUBJECT: {user?.username || 'AGENT'} // ENTRY R{myPlayer?.entryIndex || 1} ➔ EXIT G{myPlayer?.targetExitIndex || 1}
                            </p>
                        </div>
                    </div>

                    {/* Sub-Header Widget */}
                    <div className="flex items-center gap-4 sm:gap-6">
                        {/* Inventory Button before round details */}
                        <button
                            onClick={() => setShowInventoryModal(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 uppercase tracking-widest transition-all cursor-pointer shadow-sm"
                        >
                            <Briefcase size={15} className="text-slate-700" />
                            <span className="hidden sm:inline">INVENTORY</span>
                            <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] rounded font-black">
                                {myPlayer?.inventory?.length || 0}
                            </span>
                        </button>

                        <div className="text-center sm:text-right">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block">ROUND</span>
                            <span className="text-xl font-black font-cinzel text-slate-950">{gameState?.current_round || 1}/14</span>
                        </div>

                        <div className="text-center sm:text-right">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block">TIMER</span>
                            <span className={`text-xl font-black font-mono ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-950'}`}>
                                {timeLeft}s
                            </span>
                        </div>

                        <div className="px-4 py-1.5 bg-slate-100 border border-slate-300 rounded-xl text-center sm:text-right shadow-inner">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block">CREDITS</span>
                            <span className="text-xl font-black font-mono text-emerald-600">{myPlayer?.score ?? 1000}</span>
                        </div>

                        {onClose && (
                            <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-950 transition-colors cursor-pointer" title="Exit Game">
                                <LogOut size={20} />
                            </button>
                        )}
                    </div>
                </header>
            )}

            {/* Main Interactive Grid & Game Views */}
            <main className="w-full max-w-6xl my-4 flex-1 flex flex-col lg:flex-row items-start justify-center gap-6 relative z-30">
                {/* Left: Map Grid (ONLY VISIBLE FOR ADMIN / GAME MASTER ROLE) */}
                {isMasterRole && (
                    <div className="w-full lg:w-1/2 flex items-center justify-center">
                        <JokerMapGrid
                            gridMatrix={gridMatrix}
                            players={gameState?.participants || []}
                            currentPlayerId={user?.id}
                            isAdminView={isMasterRole}
                        />
                    </div>
                )}

                {/* Right: Door Choice / Minigame Controller (Takes full width for regular players) */}
                <div className={`w-full ${isMasterRole ? 'lg:w-1/2' : 'max-w-4xl mx-auto'} flex flex-col items-center justify-center`}>
                    {activeMinigame === 'slip' && (
                        <SlipCardGame timeLeft={timeLeft} onComplete={handleMinigameComplete} />
                    )}

                    {activeMinigame === 'reflex' && (
                        <ReflexGame onComplete={handleMinigameComplete} />
                    )}

                    {activeMinigame === 'trust' && (
                        <TrustPairsGame
                            players={gameState?.participants || []}
                            myPlayerId={user?.id}
                            onComplete={handleMinigameComplete}
                        />
                    )}

                    {!activeMinigame && myPlayer && (
                        <>
                            <Joker3DWorldCanvas
                                currentCell={currentCell}
                                player={myPlayer}
                                allPlayers={gameState?.participants || []}
                                gridMatrix={gridMatrix}
                                phase={gameState?.phase || 'choosing'}
                                timeLeft={timeLeft}
                                user={user}
                                gameState={gameState}
                                onSelectDoor={handleSelectDoor}
                                onEnterRoom={handleEnterRoom}
                                onClaimSpecialCard={handleClaimSpecialCard}
                                onOpenInventory={() => setShowInventoryModal(true)}
                                onClose={onClose}
                                onRefundSkipCard={handleRefundSkipCard}
                                onUnblockDoorWithGreenCard={handleUnblockDoorWithGreenCard}
                            />

                            {gameState?.phase === 'briefing' && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white p-4">
                                    <JokerBriefing timeLeft={timeLeft} />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* SPECIAL CARDS INVENTORY MODAL */}
            {/* Joker Freeze Targeting Modal */}
            {showFreezeModal && myPlayer && gameState && (
                <JokerFreezeModal
                    allPlayers={gameState.participants || []}
                    myPlayer={myPlayer}
                    gridMatrix={gridMatrix}
                    onClose={() => setShowFreezeModal(false)}
                    onFreezePlayer={handleExecuteFreeze}
                />
            )}

            {/* Skip Card Warning / Activation Modal */}
            {showSkipModal && myPlayer && (
                <JokerSkipModal
                    myPlayer={myPlayer}
                    gridMatrix={gridMatrix}
                    onClose={() => setShowSkipModal(false)}
                    onConfirmSkip={handleConfirmSkipCard}
                />
            )}

            {/* Joker Red Card Target Door Block Modal */}
            {showRedCardModal && myPlayer && gameState && (
                <JokerRedCardModal
                    allPlayers={gameState.participants || []}
                    myPlayer={myPlayer}
                    gridMatrix={gridMatrix}
                    onClose={() => setShowRedCardModal(false)}
                    onBlockPlayerDoor={handleExecuteRedCardBlock}
                />
            )}

            {/* Joker Trump Card Room Swap Modal */}
            {showTrumpModal && myPlayer && gameState && (
                <JokerTrumpModal
                    allPlayers={gameState.participants || []}
                    myPlayer={myPlayer}
                    gridMatrix={gridMatrix}
                    onClose={() => setShowTrumpModal(false)}
                    onSwapRoom={handleExecuteTrumpSwap}
                />
            )}

            {/* Victim Trump Swap Alert Modal */}
            {myPlayer?.trumpSwappedBy && (
                <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in zoom-in-95 duration-300 font-mono">
                    <div className="w-full max-w-md bg-slate-950 border-2 border-amber-400 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.4)] p-6 flex flex-col items-center text-center relative overflow-hidden">
                        <div className="w-20 h-32 mb-4 rounded-xl border-2 border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.5)] overflow-hidden bg-black p-1">
                            <img src="/specialcard_joker/trumph.png" alt="Trump Card" className="w-full h-full object-contain rounded-lg animate-pulse" />
                        </div>
                        <h2 className="text-xl font-cinzel font-black text-amber-400 mb-2 tracking-wider uppercase">
                            TRUMP CARD ROOM SWAP!
                        </h2>
                        <p className="text-xs text-slate-300 font-bold uppercase leading-relaxed mb-4">
                            <span className="text-amber-300 font-black">{myPlayer.trumpSwappedBy}</span> activated a Trump Card and swapped room positions with you!
                        </p>
                        <div className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl mb-5 text-xs text-slate-300">
                            <span>MOVED TO ROOM: </span>
                            <span className="text-amber-400 font-black">({(myPlayer.currentR || 0) + 1}, {(myPlayer.currentC || 0) + 1})</span>
                        </div>
                        <button
                            onClick={() => {
                                const updated = refundUsedCardsForPlayer({ ...myPlayer, trumpSwappedBy: undefined });
                                setMyPlayer(updated);
                                setHasBoughtDoorThisRound(false);
                                const currentParticipants = gameState?.participants || [];
                                const newParticipants = currentParticipants.map(p => isSamePlayer(p, updated) ? updated : p);
                                syncParticipantsToState(newParticipants);
                            }}
                            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md"
                        >
                            ACKNOWLEDGE & PROCEED [PRESS SPACEBAR / ENTER]
                        </button>
                    </div>
                </div>
            )}

            {/* Attacker Alert: Attack Nullified by Green Card Modal */}
            {attackNullifiedAlert && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 font-mono animate-in zoom-in-95 duration-300 select-none">
                    <div className="w-full max-w-md bg-slate-950 border-2 border-emerald-400 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.4)] p-6 flex flex-col items-center text-center relative overflow-hidden">
                        <div className="w-20 h-32 mb-4 rounded-xl border-2 border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.5)] overflow-hidden bg-black p-1">
                            <img src="/specialcard_joker/green.png" alt="Green Card" className="w-full h-full object-contain rounded-lg animate-pulse" />
                        </div>
                        <h2 className="text-xl font-cinzel font-black text-emerald-400 mb-2 tracking-wider uppercase">
                            ATTACK NULLIFIED BY GREEN CARD!
                        </h2>
                        <p className="text-xs text-slate-300 font-bold uppercase leading-relaxed mb-4">
                            <span className="text-emerald-300 font-black">{attackNullifiedAlert.targetName}</span> HAS AN ACTIVE GREEN CARD! YOUR <span className="text-amber-300 font-black">{attackNullifiedAlert.cardType}</span> ATTACK WAS COMPLETELY NULLIFIED!
                        </p>
                        <div className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl mb-5 text-[11px] text-slate-400 font-mono">
                            <span>GREEN CARD PROTECTION: </span>
                            <span className="text-emerald-400 font-bold">IMMUNITY TO ALL ATTACKS & PENALTIES</span>
                        </div>
                        <button
                            onClick={() => setAttackNullifiedAlert(null)}
                            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md"
                        >
                            ACKNOWLEDGE & CLOSE [PRESS SPACEBAR / ENTER]
                        </button>
                    </div>
                </div>
            )}

            {/* Victim Freeze Alert Modal */}
            {myPlayer?.frozenBy && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in zoom-in-95 duration-300">
                    <div className="w-full max-w-md bg-slate-900 border-2 border-red-500/50 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.3)] p-6 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-red-950 border-2 border-red-500 flex items-center justify-center mb-4">
                            <Snowflake size={32} className="text-red-500 animate-pulse" />
                        </div>
                        <h2 className="text-2xl font-cinzel font-black text-red-500 mb-2 tracking-wider">FROZEN!</h2>
                        <p className="text-sm text-slate-300 leading-relaxed mb-6">
                            <span className="font-bold text-white text-base">{myPlayer.frozenBy}</span> caused you freeze effect so your current door value are increase by <span className="font-bold text-red-400 text-base">5X</span> and u can also have option not to buy any doors current round.
                        </p>
                        <button
                            onClick={handleAcknowledgeFreeze}
                            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] cursor-pointer"
                        >
                            Acknowledge [Press Spacebar / Enter]
                        </button>
                    </div>
                </div>
            )}

            {/* Inventory Modal (Press Q or Button) */}
            <AnimatePresence>
                {showInventoryModal && myPlayer && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1400] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 font-mono text-slate-900 overflow-y-auto select-none"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="max-w-6xl w-full bg-white border border-slate-300 p-5 sm:p-6 rounded-3xl space-y-5 shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative max-h-[90vh] overflow-y-auto"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900">
                                        <Briefcase size={22} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <h2 className="font-cinzel text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-widest">
                                            SPECIAL CARD INVENTORY
                                        </h2>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">
                                            ACQUIRED LABYRINTH SPECIAL CARDS & ABILITIES
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right mr-2 hidden sm:block">
                                        <div className="text-[9px] text-slate-500 font-bold tracking-widest uppercase">Timer</div>
                                        <div className={`text-lg font-black ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-950'}`}>
                                            {timeLeft}s
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowInventoryModal(false)}
                                        className="p-2 text-slate-600 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-all cursor-pointer"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Grid of All 6 Special Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                {SpecialCardMetadata.ALL_CARDS.map(cardInfo => {
                                    const count = (myPlayer?.inventory || []).filter(c => c === cardInfo.type).length;
                                    const hasCard = count > 0;

                                    return (
                                        <div
                                            key={cardInfo.type}
                                            className={`p-4 rounded-2xl border flex flex-col items-center justify-between text-center transition-all ${hasCard ? `${cardInfo.color} ring-1 ring-slate-300/60` : 'border-slate-200 bg-slate-50 opacity-50 grayscale'
                                                }`}
                                        >
                                            <img src={cardInfo.img} alt={cardInfo.name} className="w-full h-28 object-contain rounded-lg mb-2" />
                                            <div className="space-y-1">
                                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-950">{cardInfo.name}</h4>
                                                <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">{cardInfo.desc}</p>
                                            </div>
                                            <div className="mt-3 w-full pt-2 border-t border-slate-300/60 flex flex-col gap-1 text-[10px] font-bold font-mono">
                                                {cardInfo.type === 'red' ? (
                                                    <>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-slate-600">MULTIPLIER:</span>
                                                            <span className="text-red-600 font-black">
                                                                {(() => {
                                                                    if (myPlayer?.hasUsedGreenCard) return '1X';
                                                                    const mult = Math.min(6, myPlayer?.nextRoundCostMultiplier || 1);
                                                                    return `${mult}X`;
                                                                })()}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-slate-600">ATTACK CARDS:</span>
                                                            <span className={hasCard ? 'text-red-600 font-black' : 'text-slate-400'}>{count} CARDS</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-600">OWNED:</span>
                                                        <span className={hasCard ? 'text-emerald-700 text-xs font-black' : 'text-slate-400'}>{count} CARDS</span>
                                                    </div>
                                                )}
                                            </div>
                                            {hasCard && (
                                                (() => {
                                                    const isCardDisabled = gameState?.phase !== 'choosing' || timeLeft <= 10;
                                                    return (
                                                        <button
                                                            onClick={() => {
                                                                if (isCardDisabled) return;
                                                                handleUseInventoryCard(cardInfo.type as SpecialDoorCardType);
                                                                setShowInventoryModal(false);
                                                            }}
                                                            disabled={isCardDisabled}
                                                            className={`mt-2 w-full py-2 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm ${isCardDisabled
                                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                                                : 'bg-slate-950 hover:bg-black text-white cursor-pointer'
                                                                }`}
                                                        >
                                                            {isCardDisabled ? 'LOCKED' : 'ACTIVATE'}
                                                        </button>
                                                    );
                                                })()
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Footer Count Bar */}
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-900 font-bold">
                                <div className="flex items-center gap-2">
                                    <Briefcase size={16} className="text-emerald-600" />
                                    <span>CURRENT HELD CARDS: <span className="text-emerald-700 font-black">{(myPlayer?.inventory || []).length} CARDS OWNED</span></span>
                                </div>
                                <button
                                    onClick={() => setShowInventoryModal(false)}
                                    className="px-5 py-2 bg-slate-950 hover:bg-black text-white text-xs font-bold rounded-xl uppercase tracking-widest cursor-pointer shadow-sm transition-all"
                                >
                                    CLOSE INVENTORY
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 30-SECOND TOP LAYER RESULT MODAL FOR MINIGAMES (WIN OR LOSE) */}
            <AnimatePresence>
                {minigameResultState?.show && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-[1300] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6 font-mono text-slate-100 overflow-y-auto"
                    >
                        <div className="max-w-2xl w-full bg-[#05050a] border border-slate-400/50 p-6 sm:p-8 rounded-3xl text-center space-y-5 shadow-[0_0_100px_rgba(0,0,0,0.9)] relative max-h-[90vh] overflow-y-auto">
                            {/* Header Status */}
                            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Trophy size={16} className={minigameResultState.won ? "text-yellow-400" : "text-slate-500"} />
                                    ROUND 4 GAME CARD RESULT
                                </span>
                                <span className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-full text-xs font-bold text-slate-300">
                                    CLOSING IN: {minigameResultState.timeLeft}s
                                </span>
                            </div>

                            {minigameResultState.won ? (
                                /* WINNER RESULT: Show Maze Map & Earned Points */
                                <div className="space-y-4">
                                    <div className="p-4 bg-emerald-950/70 border border-emerald-500 rounded-2xl flex items-center justify-center gap-3 text-emerald-300">
                                        <CheckCircle size={32} className="text-emerald-400 shrink-0" />
                                        <div className="text-left">
                                            <h3 className="font-cinzel text-xl font-black uppercase tracking-wider text-emerald-300">
                                                PROTOCOL CLEARED — VICTORY!
                                            </h3>
                                            <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest">
                                                CREDITS EARNED THIS GAME: +{minigameResultState.scoreBonus} CR
                                            </p>
                                        </div>
                                    </div>

                                    {/* Interactive Full Maze Map Preview for Winner */}
                                    <div className="p-4 bg-slate-900/90 border border-slate-700 rounded-2xl space-y-3">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block text-left">
                                            🗺️ LABYRINTH MAP VECTOR INSPECTOR (30S VIEWING ACCESS)
                                        </span>
                                        <div className="w-full flex items-center justify-center max-h-[340px]">
                                            <JokerMapGrid
                                                gridMatrix={gridMatrix}
                                                players={gameState?.participants || []}
                                                currentPlayerId={user?.id}
                                                isAdminView={true}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* LOSER RESULT: Banner & Earned Points (NO MINUS MARKS) */
                                <div className="space-y-6 my-4">
                                    <div className="p-6 bg-red-950/80 border-2 border-red-500 rounded-2xl flex flex-col items-center justify-center space-y-3 text-red-200 shadow-xl">
                                        <XOctagon size={48} className="text-red-400 animate-pulse" />
                                        <h3 className="font-cinzel text-2xl font-black uppercase tracking-widest text-red-400">
                                            YOU DIDN'T WIN THE GAME
                                        </h3>
                                        <p className="text-xs text-slate-300 uppercase tracking-widest font-mono">
                                            CREDITS EARNED: 0 CR (NO MINUS MARKS APPLIED)
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* END OF GAME VICTORY SCREEN OVERLAY (Ending Video -> White Theme Card, Left/Right Confetti, Return Home Button) */}
            <AnimatePresence>
                {(gameState?.phase === 'end' || myPlayer?.hasReachedExit || myPlayer?.status === 'escaped' || (gameState?.participants || []).some(p => p.hasReachedExit || p.status === 'escaped') || showWinnerMapOverlay) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1500] flex flex-col items-center justify-center font-mono text-slate-900 overflow-hidden select-none bg-black"
                    >
                        {/* Background Ending Video (Always active in background for final frame visual!) */}
                        <div className="absolute inset-0 z-0 overflow-hidden">
                            <video
                                src="/end.mp4"
                                autoPlay
                                muted
                                playsInline
                                onEnded={() => setShowVictoryCard(true)}
                                className="w-full h-full object-cover scale-105 filter brightness-105 contrast-110"
                            />
                            {showVictoryCard && (
                                <div className="absolute inset-0 bg-black/25 backdrop-blur-xs transition-all duration-500" />
                            )}
                        </div>

                        {/* Step 2: Transparent Blur Victory Card & Canvas Confetti Shower */}
                        {showVictoryCard && (
                            <>
                                {/* Victory Content (White Font Theme) */}
                                <div className="relative z-20 max-w-2xl w-full p-4 sm:p-6 text-center space-y-6 max-h-[92vh] overflow-y-auto m-4 text-white animate-in zoom-in-95 duration-300">
                                    {(() => {
                                        const sortedParticipants = (gameState?.participants || []).slice().sort((a, b) => {
                                            const aEscaped = Boolean(a.hasReachedExit || a.status === 'escaped');
                                            const bEscaped = Boolean(b.hasReachedExit || b.status === 'escaped');
                                            if (aEscaped !== bEscaped) return aEscaped ? -1 : 1;
                                            return (b.score || 0) - (a.score || 0);
                                        });
                                        const winnerPlayer = sortedParticipants[0];
                                        const winnerEscaped = Boolean(winnerPlayer?.hasReachedExit || winnerPlayer?.status === 'escaped');
                                        const isIWinner = winnerPlayer && isSamePlayer(winnerPlayer, myPlayer) && winnerEscaped;

                                        return (
                                            <>
                                                {/* Winner Header Badge */}
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/50 flex items-center justify-center shadow-lg backdrop-blur-md animate-bounce">
                                                        <i className="fa-solid fa-ranking-star text-3xl text-white"></i>
                                                    </div>
                                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 border-2 border-white/40 rounded-full text-white text-xs font-black uppercase tracking-widest shadow-md backdrop-blur-md">
                                                        <Sparkles size={14} className="text-amber-400" /> CONGRATULATIONS! TRIAL CONCLUDED
                                                    </div>
                                                    <h2 className="font-cinzel text-2xl sm:text-3xl font-black text-white uppercase tracking-widest mt-1 drop-shadow-lg">
                                                        {isIWinner ? 'JOKER TRIAL VICTORY' : 'JOKER TRIAL CONCLUDED'}
                                                    </h2>
                                                </div>

                                                <div className="w-full bg-white/15 border-2 border-white/40 text-white rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-lg backdrop-blur-md">
                                                    <div className="flex items-center gap-4 text-left">
                                                        <div className="w-12 h-12 rounded-full bg-white/30 border-2 border-white flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                                                            {winnerPlayer?.avatar_url ? (
                                                                <img src={winnerPlayer.avatar_url} alt={winnerPlayer.username} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Crown size={24} className="text-amber-400 animate-pulse" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <Crown size={16} className="text-amber-400" />
                                                                <span className="text-xs text-amber-300 font-extrabold uppercase tracking-widest">STAGE WINNER</span>
                                                            </div>
                                                            <h3 className="text-lg font-black text-white font-mono drop-shadow-md">{winnerPlayer?.username || gameState?.winner_username || 'CHAMPION'}</h3>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`px-3.5 py-1.5 font-black text-xs uppercase rounded-lg tracking-wider shadow-md ${
                                                            winnerEscaped ? 'bg-emerald-400 border-2 border-emerald-300 text-slate-900' : 'bg-red-400 border-2 border-red-300 text-slate-900'
                                                        }`}>
                                                            {winnerEscaped ? 'ESCAPED (+1000 PTS)' : 'ELIMINATED (-200 PTS)'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}

                                    {/* Player Points Leaderboard Table (White Font) */}
                                    <div className="w-full space-y-2 text-left">
                                        <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 drop-shadow-md">
                                            <Users size={14} className="text-white" /> PLAYER POINTS & LEADERBOARD RANKINGS:
                                        </h4>
                                        <div className="bg-white/15 border border-white/30 rounded-xl overflow-hidden divide-y divide-white/20 shadow-lg backdrop-blur-md">
                                            {(gameState?.participants || [])
                                                .slice()
                                                .sort((a, b) => {
                                                    const aEscaped = Boolean(a.hasReachedExit || a.status === 'escaped');
                                                    const bEscaped = Boolean(b.hasReachedExit || b.status === 'escaped');
                                                    if (aEscaped !== bEscaped) return aEscaped ? -1 : 1;
                                                    const aFinal = (a.score || 0) + (aEscaped ? 1000 : -200);
                                                    const bFinal = (b.score || 0) + (bEscaped ? 1000 : -200);
                                                    return bFinal - aFinal;
                                                })
                                                .map((p, idx) => {
                                                    const isEscaped = Boolean(p.hasReachedExit || p.status === 'escaped');
                                                    const isMe = isSamePlayer(p, myPlayer);
                                                    const rankStr = idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`;
                                                    const baseScore = p.score || 0;
                                                    const finalScore = isEscaped ? baseScore + 1000 : Math.max(0, baseScore - 200);

                                                    return (
                                                        <div
                                                            key={p.id || idx}
                                                            className={`p-3.5 flex items-center justify-between text-xs font-mono transition-all backdrop-blur-sm ${
                                                                isMe ? 'bg-white/25 font-bold' : ''
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span className="w-10 font-black text-amber-300">{rankStr}</span>
                                                                <span className={`font-extrabold ${isEscaped ? 'text-white' : 'text-slate-100'}`}>
                                                                    {p.username || 'PLAYER'} {isMe && '(YOU)'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-slate-200">
                                                                    SCORE: <strong className="text-white font-extrabold">{finalScore} PTS</strong>
                                                                </span>
                                                                <span
                                                                    className={`px-3 py-1 text-[10px] font-black uppercase rounded shadow-md ${
                                                                        isEscaped
                                                                            ? 'bg-emerald-400 text-slate-900 border border-emerald-300'
                                                                            : 'bg-red-400 text-slate-900 border border-red-300'
                                                                    }`}
                                                                >
                                                                    {isEscaped ? 'ESCAPED (+1000)' : 'ELIMINATED (-200)'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>

                                    {/* Return Home Button (White Font Sheer Glass) */}
                                    <button
                                        onClick={() => {
                                            if (onClose) {
                                                onClose();
                                            } else {
                                                window.location.href = '/home';
                                            }
                                        }}
                                        className="w-full py-4 bg-white/20 hover:bg-white/40 text-white border-2 border-white/50 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-xl hover:scale-[1.01] flex items-center justify-center gap-2 backdrop-blur-md"
                                    >
                                        <Home size={18} className="text-white" />
                                        <span>RETURN HOME // REDIRECT TO GAMES SECTION</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* INCOMING RED CARD ATTACK WARNING MODAL FOR AFFECTED PLAYER */}
            {incomingRedAttackAlert?.show && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-red-950 border-2 border-red-500/80 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.5)] overflow-hidden flex flex-col items-center text-center p-6 relative">
                        <div className="w-16 h-16 rounded-2xl bg-red-950/90 border-2 border-red-500 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(239,68,68,0.6)] animate-pulse">
                            <ShieldAlert size={36} className="text-red-500" />
                        </div>
                        
                        <h2 className="text-2xl font-cinzel font-black text-red-100 tracking-wider mb-1">
                            DOOR BLOCKED BY RED CARD ATTACK!
                        </h2>
                        <p className="text-xs text-red-400/90 font-mono uppercase tracking-widest mb-4">
                            Targeted Attack Received
                        </p>

                        <div className="w-full bg-slate-950/80 border border-red-500/30 rounded-xl p-4 mb-6">
                            <p className="text-sm font-mono text-slate-200 leading-relaxed">
                                The <span className="text-red-400 font-extrabold uppercase">{incomingRedAttackAlert.direction}</span> vector door was blocked by <span className="text-amber-300 font-extrabold">{incomingRedAttackAlert.attackerName}</span>'s Red Card attack!
                            </p>
                        </div>

                        <button
                            onClick={() => setIncomingRedAttackAlert(null)}
                            className="w-full py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:scale-[1.02] flex items-center justify-center gap-2"
                        >
                            <span>PRESS [SPACEBAR] ACKNOWLEDGE & CLOSE</span>
                        </button>
                    </div>
                </div>
            )}

            {/* GAME CARD ROTATED 30S MAP VISION OVERLAY (Clean Admin Map Borders & Styling) */}
            {gameCardMapState?.show && (
                <div className="fixed inset-0 z-[1300] flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl p-4 font-mono text-slate-100 animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-w-md w-full bg-[#050508] border-2 border-purple-500/80 rounded-3xl p-4 sm:p-5 shadow-[0_0_60px_rgba(168,85,247,0.5)] flex flex-col items-center text-center space-y-3 relative overflow-hidden">
                        <div className="flex items-center justify-between w-full border-b border-purple-900/50 pb-3">
                            <div className="flex items-center gap-2 text-purple-400 font-extrabold text-sm tracking-wider">
                                <Eye size={20} className="animate-pulse text-purple-400" />
                                <span>GAME CARD :: 30S MAP VISION</span>
                            </div>
                            <div className="px-3 py-1 bg-purple-950/80 border border-purple-500 rounded-lg text-purple-300 font-black text-xs shadow-[0_0_10px_rgba(168,85,247,0.4)] animate-pulse">
                                TIME LEFT: {gameCardMapState.timeLeft}S
                            </div>
                        </div>

                        <div className="flex justify-center items-center w-full text-[11px] text-purple-300/90 uppercase tracking-widest font-bold bg-purple-950/30 border border-purple-900/50 px-3 py-1.5 rounded-xl">
                            <span>YOUR ASSIGNED EXIT: <strong className="text-emerald-400 font-black">GATE {gameCardMapState.targetExitIndex}</strong></span>
                        </div>

                        {/* FULL ADMIN LABYRINTH MAP GRID WITH BORDERS, CONNECTORS & DOOR COSTS (Only player exit gate shown) */}
                        <div className="w-full p-2 bg-slate-950 border border-purple-900/40 rounded-2xl shadow-inner my-1 flex items-center justify-center">
                            <JokerMapGrid
                                gridMatrix={generateRotatedMap(gameCardMapState.rotation || 90, gameState?.map_matrix)}
                                players={[]}
                                targetExitOnlyIndex={gameCardMapState.targetExitIndex}
                                isAdminView={false}
                            />
                        </div>

                        <button
                            onClick={() => setGameCardMapState(null)}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:scale-[1.01]"
                        >
                            PRESS [SPACEBAR] CLOSE MAP VISION
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
