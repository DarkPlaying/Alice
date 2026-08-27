import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Timer, Shield, Activity, Users, LogOut, Award, AlertTriangle, Eye, Map, CheckCircle2, Briefcase, X, Trophy, XOctagon, CheckCircle, Snowflake, ShieldAlert, Home, Sparkles, Crown, Flame, Check, Lock, Layers, AlertCircle } from 'lucide-react';
import { supabase, supabaseUrl, supabaseKey, getAccessToken } from '../../../supabaseClient';
import type { JokerGameState, JokerPlayer, JokerPhase, DoorData, SpecialDoorCardType, MapCell } from './jokerTypes';
import { generateRotatedMap, getEntryCell, getRandomEntryCell, ensureTwentySpecialCards, placeTrumpCardInRandomCell, spawnCardsToNewLocation, parseMapMatrix, buildMapMatrixPayload } from './jokerMapData';
import { claimSpecialCardsForPlayer, mergePlayerInventories } from './jokerCardService';
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
import { JokerMinigameConfig } from './config/JokerMinigameConfig';

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
    const [isScreenProtected, setIsScreenProtected] = useState(false);
    const [minigameResultState, setMinigameResultState] = useState<{
        show: boolean;
        won: boolean;
        scoreBonus?: number;
        timeLeft: number;
    } | null>(null);
    const [minigameHistory, setMinigameHistory] = useState<Record<number, 'win' | 'loss'>>({});

    const isRegisteringRef = useRef<boolean>(false);
    const prevRoundRef = useRef<number>(1);
    const myRedMultiplierRef = useRef<number>(1);
    const prevBlockedDoorsCountRef = useRef<number>(0);
    // Local map cache: eagerly loaded at start of each choosing phase so claims/display use fresh data
    const localMapRef = useRef<any>(null);
    const localMapLoadedRoundRef = useRef<number>(0);
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

    // Anti-Screenshot & Screen Recording Protection (Blackout Overlay & All Key Blocking) — ONLY ACTIVE DURING MINIGAMES
    useEffect(() => {
        if (!activeMinigame && gameState?.phase !== 'minigame') {
            setIsScreenProtected(false);
            return;
        }

        const triggerProtection = () => {
            setIsScreenProtected(true);
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText('');
                }
            } catch (err) { }
            setTimeout(() => setIsScreenProtected(false), 3000);
        };

        const handleBlur = () => triggerProtection();
        const handleFocus = () => setIsScreenProtected(false);
        const handleVisibility = () => {
            if (document.hidden) triggerProtection();
            else setIsScreenProtected(false);
        };

        const handleKey = (e: KeyboardEvent) => {
            const keyLower = e.key ? e.key.toLowerCase() : '';
            const codeLower = e.code ? e.code.toLowerCase() : '';
            const isFKey = keyLower.startsWith('f') && keyLower.length > 1; // F1 - F12
            const isPrtScr = keyLower.includes('print') || keyLower.includes('snapshot') || e.keyCode === 44 || codeLower.includes('print');
            const isSystemKey =
                isPrtScr ||
                e.ctrlKey ||
                e.altKey ||
                e.metaKey ||
                keyLower === 'control' ||
                keyLower === 'alt' ||
                keyLower === 'meta' ||
                keyLower === 'contextmenu' ||
                codeLower.includes('win') ||
                isFKey;

            if (isSystemKey) {
                e.preventDefault();
                e.stopPropagation();
                triggerProtection();
            }
        };

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            triggerProtection();
        };

        const handleCopy = (e: ClipboardEvent) => {
            e.preventDefault();
            triggerProtection();
        };

        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('keydown', handleKey, { capture: true });
        window.addEventListener('keyup', handleKey, { capture: true });
        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('copy', handleCopy, { capture: true });

        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('keydown', handleKey, { capture: true });
            window.removeEventListener('keyup', handleKey, { capture: true });
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('copy', handleCopy, { capture: true });
        };
    }, [activeMinigame, gameState?.phase]);

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
                    const mergedInv = mergePlayerInventories(
                        me?.inventory || [],
                        prev?.inventory || [],
                        { hasUsedSkipCard: me?.hasUsedSkipCard || prev?.hasUsedSkipCard, hasUsedGreenCard: me?.hasUsedGreenCard || prev?.hasUsedGreenCard }
                    );

                    if (me?.hasUsedGreenCard) {
                        myRedMultiplierRef.current = 1;
                    } else {
                        const isFrozenByCard = Boolean(me?.frozenBy || me?.frozenByPlayerId);
                        const calculatedMult = calculateRedCostMultiplier(mergedInv, 0, isFrozenByCard);
                        myRedMultiplierRef.current = Math.max(calculatedMult, me?.nextRoundCostMultiplier || 1);
                    }

                    let newMe = {
                        ...me!,
                        inventory: mergedInv,
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
                        claimCoordsByRoundRef.current = {}; // reset cached destination coords each new round
                    }

                    // Reset blocked doors & temporary door selections whenever round changes or phase is briefing
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
                        newMe.lastDoorChoice = undefined;
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

    // Eagerly fetch & cache the full map_matrix locally at the start of EACH choosing phase.
    // This prevents stale/online-error-prone map data during reveal-phase claims.
    // The cached map is used by gridMatrix, handleEnterRoom, and claimCardsFromLiveDB.
    useEffect(() => {
        if (gameState?.phase !== 'choosing') return;
        const round = gameState.current_round || 1;
        if (localMapLoadedRoundRef.current === round && localMapRef.current) return;

        const loadMapLocally = async () => {
            try {
                const token = await getAccessToken();
                const res = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}&select=map_matrix`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey },
                    cache: 'no-store'
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data[0]?.map_matrix) {
                        localMapRef.current = data[0].map_matrix;
                        localMapLoadedRoundRef.current = round;
                        console.log(`[MAP CACHE] Locally loaded map_matrix for Round ${round} (choosing phase).`);
                    }
                }
            } catch (e) {
                console.warn('[MAP CACHE] Failed to load map locally:', e);
            }
        };
        loadMapLocally();
    }, [gameState?.phase, gameState?.current_round]);

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
                setTimeLeft(JokerGameConfig.getPhaseDuration(gameState?.phase || 'choosing', gameState?.current_round || 1));
                return;
            }
            const now = new Date().getTime();
            const elapsed = Math.floor((now - startTime) / 1000);
            const durationSec = (gameState.phase_duration_sec && gameState.phase_duration_sec > 0)
                ? gameState.phase_duration_sec
                : JokerGameConfig.getPhaseDuration(gameState.phase, gameState.current_round);
            const remaining = Math.max(0, durationSec - elapsed);
            setTimeLeft(remaining);

            if (gameState.phase === 'minigame') {
                const mType = JokerMinigameConfig.getMinigameTypeForRound(gameState.current_round);
                setActiveMinigame(mType as any);
            } else {
                setActiveMinigame(null);
                setMinigameResultState(null);
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
        // Use locally cached map (loaded eagerly at choosing-phase start) for correct round-specific positions
        const parsedGameMap = parseMapMatrix(localMapRef.current || gameState?.map_matrix);
        const enterRoomGrid = parsedGameMap.old_map && parsedGameMap.old_map.length === 7
            ? parsedGameMap.old_map
            : generateRotatedMap(gameState.map_rotation || 0);

        const { updatedPlayer } = processDoorPurchase(myPlayer, door, finalCost, isSkip, enterRoomGrid);

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
    const roundStartPosRef = useRef<{ [round: number]: { r: number; c: number } }>({});
    // Cache the destination room (claimR, claimC) computed ONCE per round per player.
    // Prevents re-computation when currentR/C changes mid-Reveal (player walks through door)
    // or when map_matrix subscription update re-triggers the effect.
    const claimCoordsByRoundRef = useRef<{ [roundPlayerId: string]: { r: number, c: number } }>({});

    // Lock starting position ONCE per round when round changes (never overwrite during the round!)
    useEffect(() => {
        if (myPlayer?.currentR !== undefined && myPlayer?.currentC !== undefined && gameState?.current_round) {
            if (!roundStartPosRef.current[gameState.current_round]) {
                roundStartPosRef.current[gameState.current_round] = { r: myPlayer.currentR, c: myPlayer.currentC };
                console.log(`[ROUND START POS] Locked Round ${gameState.current_round} start position for "${myPlayer.username}": (${myPlayer.currentR}, ${myPlayer.currentC})`);
            }
        }
    }, [gameState?.current_round, myPlayer?.id]);

    // Auto-claim cards DURING REVEAL PHASE when candidate enters destination room
    useEffect(() => {
        if (!myPlayer || !gameState || gameState.phase !== 'reveal' || myPlayer.trumpSwappedBy) return;

        const roundPlayerKey = `${gameState.current_round}_${myPlayer.id}`;
        let claimR: number = myPlayer.currentR;
        let claimC: number = myPlayer.currentC;

        if (claimCoordsByRoundRef.current[roundPlayerKey]) {
            // Use the destination coords computed on the FIRST run this round — never recompute.
            claimR = claimCoordsByRoundRef.current[roundPlayerKey].r;
            claimC = claimCoordsByRoundRef.current[roundPlayerKey].c;
        } else {
            // First run this Reveal Phase — compute destination from round start position + doorChoice.
            // Use locally cached map (loaded at choosing-phase start) for correct round-specific old_map.
            const parsedMap = parseMapMatrix(localMapRef.current || gameState.map_matrix);
            const fallbackRotationMap = generateRotatedMap(gameState.map_rotation || 0);
            const activeOldMap = parsedMap.old_map && parsedMap.old_map.length === 7 ? parsedMap.old_map : fallbackRotationMap;

            const doorChoice = myPlayer.pendingDoorChoice || (myPlayer as any).boughtDoorChoice || (myPlayer as any).lastDoorChoice;
            if (doorChoice?.door) {
                const isSkip = Boolean(
                    doorChoice.isSkip ||
                    myPlayer.hasUsedSkipCard ||
                    myPlayer.pendingDoorChoice?.isSkip ||
                    myPlayer.lastDoorChoice?.isSkip ||
                    (myPlayer as any).boughtDoorChoice?.isSkip
                );
                const { updatedPlayer: calcPlayer } = processDoorPurchase(myPlayer, doorChoice.door, doorChoice.finalCost || 0, isSkip, activeOldMap);
                claimR = calcPlayer.currentR;
                claimC = calcPlayer.currentC;
            }

            claimCoordsByRoundRef.current[roundPlayerKey] = { r: claimR, c: claimC };
            console.log(`[CARD CLAIM] Destination resolved: Round ${gameState.current_round}, Player "${myPlayer.username}" → room (${claimR}, ${claimC})`);
        }

        const playerRoundCellKey = `${gameState.current_round}_${myPlayer.id}_${claimR}_${claimC}`;
        if (claimedCellCoordsRef.current.has(playerRoundCellKey)) return;

        const executeClaim = async () => {
            claimedCellCoordsRef.current.add(playerRoundCellKey);
            const result = await claimSpecialCardsForPlayer(myPlayer, gameState, claimR, claimC);
            if (result && result.success) {
                setMyPlayer(result.updatedPlayer);
                setGameState(prev => prev ? { ...prev, map_matrix: result.payloadMatrix } as any : prev);
                console.log(`[CARD CLAIM SUCCESS] Candidate "${myPlayer.username}" claimed cards:`, result.claimedCards);
            } else {
                // If cell had no cards or claim deferred, delete key so retries can happen if needed
                claimedCellCoordsRef.current.delete(playerRoundCellKey);
            }
        };

        executeClaim();
        // Intentionally exclude gameState.map_matrix from deps: we fetch live from DB anyway, and including
        // it caused cascade re-runs (claim → DB update → subscription → re-run → wrong destination).
        // Also exclude currentR/C from re-computing destination (cached in claimCoordsByRoundRef).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myPlayer?.id, myPlayer?.currentR, myPlayer?.currentC, gameState?.phase, gameState?.current_round]);

    const handleExecuteFreeze = async (targetPlayerId: string) => {
        if (!myPlayer || !gameState || !targetPlayerId) return;

        // Ensure sender never freezes themselves
        if (targetPlayerId === myPlayer.id || (myPlayer.username && String(targetPlayerId).toLowerCase() === String(myPlayer.username).toLowerCase())) {
            console.warn('[JOKER_FREEZE] Cannot freeze yourself.');
            return;
        }

        const targetPlayer = (gameState.participants || []).find(p => !isSamePlayer(p, myPlayer) && (p.id === targetPlayerId || (p.username && String(p.username).toLowerCase() === String(targetPlayerId).toLowerCase())));
        if (!targetPlayer || isSamePlayer(targetPlayer, myPlayer)) return;

        // 1. Remove freeze card from inventory and unselect selected door
        const freezeIdx = myPlayer.inventory.indexOf('freeze');
        if (freezeIdx === -1) return;
        const updatedInventory = myPlayer.inventory.filter((_, idx) => idx !== freezeIdx);
        const updatedMe = {
            ...myPlayer,
            inventory: updatedInventory,
            pendingDoorChoice: undefined
        };
        setMyPlayer(updatedMe);
        setHasBoughtDoorThisRound(false);
        setShowFreezeModal(false);

        // 2. Fetch latest state and apply freeze (+5X) to target ONLY
        try {
            const token = await getAccessToken();
            const res = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}&select=participants`, {
                headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey },
                cache: 'no-store'
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0 && data[0].participants) {
                    const isTargetPlayer = (p: any) => {
                        if (!p || isSamePlayer(p, updatedMe)) return false;
                        if (p.id && targetPlayerId && p.id === targetPlayerId) return true;
                        if (p.username && targetPlayer.username && String(p.username).toLowerCase() === String(targetPlayer.username).toLowerCase()) return true;
                        return false;
                    };

                    const latestParticipants = data[0].participants.map((p: any) => {
                        if (isSamePlayer(p, updatedMe)) {
                            // Sender is NEVER frozen
                            return {
                                ...updatedMe,
                                frozenBy: undefined,
                                frozenByPlayerId: undefined
                            };
                        }
                        if (isTargetPlayer(p)) {
                            if (p.hasUsedGreenCard) {
                                setAttackNullifiedAlert({
                                    targetName: p.username || 'TARGET CANDIDATE',
                                    cardType: 'FREEZE CARD'
                                });
                                return p;
                            }

                            // Receiver multiplier logic:
                            // If receiver already has penalty (e.g. 6X), add +5X = 11X. If no penalty (1X), becomes 5X.
                            const currentMult = (p.nextRoundCostMultiplier && p.nextRoundCostMultiplier > 1) ? p.nextRoundCostMultiplier : 1;
                            const combinedMult = currentMult > 1 ? currentMult + 5 : 5;

                            console.log(`[FREEZE ATTACK] Target "${p.username}" frozen by "${myPlayer.username}". Old Mult: ${currentMult}X → New Mult: ${combinedMult}X.`);

                            return {
                                ...p,
                                frozenBy: myPlayer.username || 'AGENT',
                                frozenByPlayerId: myPlayer.id,
                                nextRoundCostMultiplier: combinedMult,
                                pendingDoorChoice: undefined
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

    // Minigame Completion Handler (REWARD 1 GAME CARD ON WIN & STORE HISTORY IN DB)
    const handleMinigameComplete = (success: boolean) => {
        setActiveMinigame(null);

        const isAlreadyWon = Boolean(minigameResultState?.show && minigameResultState?.won);
        const finalWon = isAlreadyWon ? true : success;
        const currRound = gameState?.current_round || 1;

        if (myPlayer) {
            const updatedInventory = finalWon
                ? (myPlayer.inventory?.includes('game') ? myPlayer.inventory : [...(myPlayer.inventory || []), 'game' as const])
                : (myPlayer.inventory || []);
            const updatedHistory = { ...(myPlayer.minigameHistory || {}), [currRound]: finalWon ? ('win' as const) : ('loss' as const) };
            const updatedPlayer: JokerPlayer = {
                ...myPlayer,
                inventory: updatedInventory,
                minigameHistory: updatedHistory
            };
            setMyPlayer(updatedPlayer);
            setMinigameHistory(updatedHistory);

            const currentParticipants = gameState?.participants || [];
            const newParticipants = currentParticipants.map(p => isSamePlayer(p, updatedPlayer) ? updatedPlayer : p);
            syncParticipantsToState(newParticipants);
        }

        // Open Top Layer Result Window (Lock victory state once set to true)
        setMinigameResultState({
            show: true,
            won: finalWon,
            timeLeft: timeLeft
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

    // Use locally cached map (loaded at choosing-phase start) — falls back to gameState?.map_matrix if not yet loaded
    const parsedMapData = parseMapMatrix(localMapRef.current || gameState?.map_matrix);
    const gridMatrix = parsedMapData.old_map && parsedMapData.old_map.length === 7 ? parsedMapData.old_map : generateRotatedMap(gameState?.map_rotation || 0);
    const fallbackEntry = getEntryCell(gridMatrix, myPlayer?.entryIndex || 1);
    // Only fall back to entry gate if cell is TRULY missing or a wall — path/entry/exit are all valid
    const rawCell = myPlayer ? gridMatrix[myPlayer.currentR]?.[myPlayer.currentC] : undefined;
    const currentCell = (rawCell && rawCell.type !== 'wall') ? rawCell : gridMatrix[fallbackEntry.r][fallbackEntry.c];

    const isMinigameMode = !!(activeMinigame || minigameResultState?.show || gameState?.phase === 'minigame');
    const isBriefingPhase = gameState?.phase === 'briefing';
    const showTopHeader = isMinigameMode || isBriefingPhase;

    return (
        <div className={`w-full min-h-screen ${isMinigameMode ? 'bg-[#050508] text-slate-100' : 'bg-white text-slate-900'} font-mono flex flex-col items-center justify-start p-2 sm:p-4 relative overflow-y-auto select-none transition-colors duration-300`}>
            {/* Top Header HUD (Rendered during minigame mode and briefing phase on laptop view) */}
            {showTopHeader && (
                <header className={`w-full ${isMinigameMode ? 'max-w-[98%] bg-[#0a0b12]/95 border-slate-800/90 text-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.5)]' : 'max-w-6xl bg-white/95 border-slate-300 text-slate-900 shadow-md'} mx-auto p-2 sm:p-4 border rounded-xl sm:rounded-2xl backdrop-blur-xl flex flex-row items-center justify-between gap-2 relative z-40 transition-all duration-300 overflow-hidden`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`p-1 sm:p-1.5 ${isMinigameMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-300'} border rounded-lg sm:rounded-xl shadow-sm shrink-0`}>
                            <img src="/suit_assets/Joker Game.png" alt="Joker Logo" className="w-5 h-5 sm:w-7 sm:h-7 object-contain" />
                        </div>
                        <div className="min-w-0">
                            <h1 className={`font-cinzel text-xs sm:text-xl font-black ${isMinigameMode ? 'text-white' : 'text-slate-950'} tracking-wider uppercase truncate`}>
                                JOKER TRIAL <span className={`${isMinigameMode ? 'text-slate-400' : 'text-slate-500'} font-extrabold hidden md:inline`}>:: LOGIC LABYRINTH</span>
                            </h1>
                            <p className={`text-[8px] sm:text-[10px] ${isMinigameMode ? 'text-slate-400' : 'text-slate-600'} font-bold uppercase tracking-wider truncate hidden sm:block`}>
                                SUBJECT: {user?.username || 'AGENT'} // ENTRY R{myPlayer?.entryIndex || 1} ➔ EXIT G{myPlayer?.targetExitIndex || 1}
                            </p>
                        </div>
                    </div>

                    {/* Sub-Header Widget in ONE LINE */}
                    <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
                        {/* Inventory Button */}
                        <button
                            onClick={() => setShowInventoryModal(true)}
                            className={`flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 ${isMinigameMode ? 'bg-[#08090e] hover:bg-slate-900 border-slate-800 text-slate-100' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-900'} border rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer`}
                        >
                            <Briefcase size={13} className={isMinigameMode ? "text-emerald-400" : "text-slate-700"} />
                            <span className="hidden md:inline">INVENTORY</span>
                            <span className="px-1 py-0.2 bg-emerald-600 text-white text-[9px] sm:text-[10px] rounded font-black">
                                {myPlayer?.inventory?.length || 0}
                            </span>
                        </button>

                        <div className="px-2 py-1 bg-slate-900/60 border border-slate-800 rounded-lg text-center font-mono flex items-center gap-1 text-[10px] sm:text-xs">
                            <span className="text-slate-400 font-bold hidden sm:inline">R:</span>
                            <span className="font-black text-white">{gameState?.current_round || 1}/14</span>
                        </div>

                        <div className="px-2 py-1 bg-slate-900/60 border border-slate-800 rounded-lg text-center font-mono flex items-center gap-1 text-[10px] sm:text-xs">
                            <span className="text-slate-400 font-bold hidden sm:inline">TIME:</span>
                            <span className={`font-black ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-slate-100'}`}>
                                {timeLeft}s
                            </span>
                        </div>

                        <div className="px-2 py-1 bg-slate-900/60 border border-slate-800 rounded-lg text-center font-mono flex items-center gap-1 text-[10px] sm:text-xs">
                            <span className="text-slate-400 font-bold hidden sm:inline">CR:</span>
                            <span className="font-black text-emerald-400">{myPlayer?.score ?? 1000}</span>
                        </div>

                        {onClose && (
                            <button onClick={onClose} className={`p-1 sm:p-1.5 ${isMinigameMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-950'} transition-colors cursor-pointer`} title="Exit Game">
                                <LogOut size={16} />
                            </button>
                        )}
                    </div>
                </header>
            )}

            {/* Main Interactive Grid & Game Views */}
            <main className={`w-full ${activeMinigame ? 'max-w-[98%]' : 'max-w-6xl'} my-4 flex-1 flex flex-col lg:flex-row items-start justify-center gap-6 relative z-30`}>
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

                {/* Right: Door Choice / Minigame Controller (Takes full width for regular players or minigame) */}
                <div className={`w-full ${activeMinigame ? 'w-full max-w-full px-2 sm:px-4' : (isMasterRole ? 'lg:w-1/2' : 'max-w-4xl mx-auto')} flex flex-col items-center justify-center`}>
                    {activeMinigame === 'slip' && !minigameResultState?.show && (
                        <SlipCardGame timeLeft={timeLeft} onComplete={handleMinigameComplete} />
                    )}

                    {activeMinigame === 'reflex' && !minigameResultState?.show && (
                        <ReflexGame onComplete={handleMinigameComplete} />
                    )}

                    {activeMinigame === 'trust' && !minigameResultState?.show && (
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
                                <JokerBriefing timeLeft={timeLeft} />
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
                            <span className="font-bold text-white text-base">{myPlayer.frozenBy}</span> applied Freeze Card to you! Your door cost multiplier is increased by <span className="font-bold text-red-400 text-base">+5X</span> (Total: <span className="font-bold text-red-400 text-base">{myPlayer.nextRoundCostMultiplier || 5}X</span>) for this round.
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
                                                                    const mult = Math.max(1, myPlayer?.nextRoundCostMultiplier || 1);
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

            {/* TOP LAYER RESULT MODAL FOR MINIGAMES (APPROVED HORIZONTAL LAYOUT WITH ELECTRIC BLUE/CYAN & RED FIRING FLAME) */}
            <AnimatePresence>
                {minigameResultState?.show && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="fixed inset-0 z-[1300] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6 font-mono text-slate-100 overflow-y-auto"
                    >
                        {/* Dynamic CSS Keyframes for Firing Flame */}
                        <style dangerouslySetInnerHTML={{
                            __html: `
                            @keyframes blueFireFlicker {
                                0% { transform: scale(1) translateY(0) rotate(-4deg); filter: drop-shadow(0 4px 22px rgba(6, 182, 212, 0.95)); }
                                25% { transform: scale(1.15) translateY(-5px) rotate(-8deg); filter: drop-shadow(0 8px 32px rgba(59, 130, 246, 0.95)); }
                                50% { transform: scale(0.92) translateY(2px) rotate(-1deg); filter: drop-shadow(0 2px 22px rgba(56, 189, 248, 0.9)); }
                                75% { transform: scale(1.12) translateY(-3px) rotate(-6deg); filter: drop-shadow(0 6px 30px rgba(14, 165, 233, 0.95)); }
                                100% { transform: scale(1) translateY(0) rotate(-4deg); filter: drop-shadow(0 4px 22px rgba(6, 182, 212, 0.95)); }
                            }

                            @keyframes redFireFlicker {
                                0% { transform: scale(1) translateY(0) rotate(0deg); filter: drop-shadow(0 4px 18px rgba(239, 68, 68, 0.95)); }
                                50% { transform: scale(1.12) translateY(-4px) rotate(4deg); filter: drop-shadow(0 8px 28px rgba(185, 28, 28, 0.95)); }
                                100% { transform: scale(1) translateY(0) rotate(0deg); filter: drop-shadow(0 4px 18px rgba(239, 68, 68, 0.95)); }
                            }

                            @keyframes blueHeatPulse {
                                0%, 100% { transform: scale(0.9); opacity: 0.45; }
                                50% { transform: scale(1.4); opacity: 0.9; }
                            }
                        `}} />

                        {/* HORIZONTAL CARD WITH TOP FLOATING ELECTRIC BLUE FLAME (COMPACT ON MOBILE) */}
                        <div className="relative w-full max-w-sm sm:max-w-3xl mt-4 sm:mt-6">

                            {/* 3D FLOATING FLAME AT TOP CENTER */}
                            <div className="absolute -top-8 sm:-top-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none">
                                <div className="relative flex items-center justify-center">
                                    <div className={`absolute w-12 h-12 sm:w-16 sm:h-16 rounded-full blur-xl animate-[blueHeatPulse_2s_infinite] ${minigameResultState.won ? 'bg-cyan-400/80' : 'bg-red-500/70'}`} />

                                    <Flame
                                        size={42}
                                        className={`transform transition-all duration-300 ${
                                            minigameResultState.won
                                                ? 'text-cyan-300 fill-cyan-400 animate-[blueFireFlicker_1.2s_infinite_alternate_ease-in-out]'
                                                : 'text-red-500 fill-red-500 animate-[redFireFlicker_1.4s_infinite_alternate_ease-in-out]'
                                        }`}
                                    />
                                </div>
                            </div>

                            {/* Outer Horizontal Card Container */}
                            <div className="w-full bg-[#0e101a] rounded-2xl sm:rounded-[36px] p-3 sm:p-8 pt-8 sm:pt-12 text-white shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-slate-800 relative overflow-hidden flex flex-col items-center">
                                {/* Background Subtle Grid Overlay */}
                                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2133_1px,transparent_1px),linear-gradient(to_bottom,#1f2133_1px,transparent_1px)] bg-[size:24px_24px] opacity-30 pointer-events-none" />

                                {/* Top Status Header Row */}
                                <div className="w-full flex justify-between items-center border-b border-slate-800/80 pb-2 mb-3 sm:mb-6 relative z-10">
                                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                                        <Trophy size={13} className={minigameResultState.won ? 'text-cyan-400' : 'text-slate-500'} />
                                        ROUND {gameState?.current_round || 1} MINIGAME {minigameResultState.won ? 'VICTORY' : 'RESULT'}
                                    </span>
                                    <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-slate-900 border border-slate-800 rounded-full text-[9px] sm:text-xs font-bold text-slate-400 font-mono">
                                        CLOSING IN: {timeLeft}s
                                    </span>
                                </div>

                                {/* LEFT & RIGHT SPLIT CONTENT LAYOUT */}
                                <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-8 items-center relative z-10">
                                    
                                    {/* LEFT COLUMN: Game Card Artwork Graphic Display */}
                                    <div className="md:col-span-5 flex flex-col items-center justify-center p-2.5 sm:p-5 bg-[#141624] border border-slate-800/80 rounded-xl sm:rounded-3xl shadow-inner min-h-[90px] sm:min-h-[220px]">
                                        {minigameResultState.won ? (
                                            <div className="relative group flex flex-col items-center">
                                                <div className="absolute inset-0 bg-cyan-400/25 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                                                <div className="relative p-1 sm:p-2 bg-[#080912] border border-cyan-400/50 rounded-lg sm:rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.3)] transform hover:scale-105 transition-all">
                                                    <img
                                                        src="/specialcard_joker/game.png"
                                                        alt="Game Card Reward"
                                                        className="w-16 h-22 sm:w-28 sm:h-40 object-contain rounded-md sm:rounded-xl shadow-lg border border-cyan-300/40"
                                                    />
                                                </div>
                                                <span className="text-[8px] sm:text-[10px] font-black text-cyan-400 tracking-[0.2em] uppercase font-mono block mt-1.5 sm:mt-3 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]">
                                                    +1 GAME CARD REWARD
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center py-1 sm:py-4">
                                                <span className="font-cinzel text-3xl sm:text-6xl font-black text-slate-600 tracking-widest drop-shadow-sm">
                                                    00
                                                </span>
                                                <span className="text-[8px] sm:text-[10px] font-black text-red-400 tracking-[0.2em] uppercase mt-1 sm:mt-2">
                                                    NO CARD CLAIMED
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* RIGHT COLUMN: Title, Message, History Milestones & Info Banner */}
                                    <div className="md:col-span-7 flex flex-col items-start text-left space-y-2.5 sm:space-y-4">
                                        
                                        {/* Main Title */}
                                        <div className="space-y-0.5">
                                            <h2 className="font-cinzel text-lg sm:text-3xl font-black uppercase tracking-[0.15em] text-white">
                                                {minigameResultState.won ? 'YOU WON THE MINIGAME!' : 'MINIGAME ENDED'}
                                            </h2>
                                            <div className={`w-14 sm:w-20 h-0.5 ${minigameResultState.won ? 'bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]' : 'bg-red-500/80'}`} />
                                        </div>

                                        {/* Subtitle Message */}
                                        <p className="text-[10px] sm:text-xs text-slate-300 font-mono leading-relaxed">
                                            {minigameResultState.won ? (
                                                <>Outstanding speed! <strong className="text-cyan-300 font-bold">1 GAME CARD</strong> has been added to your inventory for maze advantages.</>
                                            ) : (
                                                <>Time expired or failed attempts limit reached. <strong className="text-slate-400 font-bold">0 CREDITS</strong> earned in this round.</>
                                            )}
                                        </p>

                                        {/* Minigame Milestones Progress Row */}
                                        <div className="w-full bg-[#161826] border border-slate-800 rounded-lg sm:rounded-2xl p-2 sm:p-4">
                                            <div className="flex flex-wrap justify-between items-center gap-1 mb-1.5 sm:mb-3 pb-1 sm:pb-2 border-b border-slate-800/60">
                                                <span className="text-[7px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                                                    MINIGAME MILESTONES
                                                </span>
                                                <span className={`text-[7px] sm:text-[8px] font-bold ${minigameResultState.won ? 'text-cyan-400 bg-cyan-950/40 border-cyan-500/40' : 'text-red-400 bg-red-950/40 border-red-500/40'} border px-1.5 py-0.2 rounded uppercase tracking-wider font-mono`}>
                                                    CURRENT: R{gameState?.current_round || 1}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-7 gap-1 sm:gap-4 text-center py-0.5">
                                                {[1, 2, 3, 4, 5, 6, 7].map((roundNum) => {
                                                    const currentRoundNum = gameState?.current_round || 1;
                                                    const activeHistory = myPlayer?.minigameHistory || minigameHistory;
                                                    const result = activeHistory[roundNum] || (roundNum === currentRoundNum ? (minigameResultState.won ? 'win' : 'loss') : undefined);
                                                    const isCurrent = roundNum === currentRoundNum;

                                                    const ringStyle = isCurrent
                                                        ? (result === 'loss'
                                                            ? 'ring-1 sm:ring-2 ring-red-500 ring-offset-1 sm:ring-offset-2 ring-offset-[#161826] scale-105 shadow-[0_0_10px_rgba(239,68,68,0.95)] z-10'
                                                            : 'ring-1 sm:ring-2 ring-cyan-400 ring-offset-1 sm:ring-offset-2 ring-offset-[#161826] scale-105 shadow-[0_0_10px_rgba(6,182,212,0.95)] z-10')
                                                        : '';

                                                    return (
                                                        <div key={roundNum} className="flex flex-col items-center gap-0.5 sm:gap-2">
                                                            <div className={`w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-xl flex items-center justify-center text-[9px] sm:text-xs transition-all ${ringStyle} ${
                                                                result === 'win'
                                                                    ? 'bg-cyan-400 text-slate-950 font-black shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                                                                    : result === 'loss'
                                                                    ? 'bg-red-500 text-white font-black shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                                                                    : 'bg-[#1f2236] text-slate-600'
                                                            }`}>
                                                                {result === 'win' ? (
                                                                    <Check size={11} strokeWidth={3} />
                                                                ) : result === 'loss' ? (
                                                                    <X size={11} strokeWidth={3} />
                                                                ) : (
                                                                    <Lock size={9} />
                                                                )}
                                                            </div>
                                                            <span className={`text-[7px] sm:text-[9px] font-bold ${isCurrent ? (result === 'loss' ? 'text-red-400 font-mono font-black' : 'text-cyan-400 font-mono font-black') : 'text-slate-400'}`}>
                                                                R{roundNum}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Current Round Minigame Info Text Box (Static Div, Non-Clickable) */}
                                        <div className="w-full pt-1 pointer-events-none select-none">
                                            <div className="w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-full text-[9px] sm:text-xs font-mono font-bold uppercase tracking-widest bg-[#121422] border border-slate-800 text-slate-300 text-center flex items-center justify-center gap-2 shadow-inner">
                                                <Sparkles size={12} className={minigameResultState.won ? 'text-cyan-400' : 'text-amber-400'} />
                                                <span>ROUND {gameState?.current_round || 1} :: {JokerMinigameConfig.getMinigameTypeForRound(gameState?.current_round || 1).toUpperCase()} MINIGAME</span>
                                            </div>
                                        </div>

                                    </div>

                                </div>

                            </div>
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

                        {/* Step 2: Minigame Victory Style Card with White Firing Flame */}
                        {showVictoryCard && (
                            <div className="relative z-20 w-full max-w-3xl p-4 sm:p-6 text-center text-white max-h-[92vh] overflow-y-auto m-4 animate-in zoom-in-95 duration-300">
                                {/* Dynamic CSS Keyframes for Firing WHITE Flame Animation */}
                                <style dangerouslySetInnerHTML={{
                                    __html: `
                                    @keyframes whiteFireFlicker {
                                        0% { transform: scale(1) translateY(0) rotate(-4deg); filter: drop-shadow(0 4px 24px rgba(255, 255, 255, 0.95)); }
                                        25% { transform: scale(1.15) translateY(-5px) rotate(-8deg); filter: drop-shadow(0 8px 36px rgba(255, 255, 255, 1)); }
                                        50% { transform: scale(0.92) translateY(2px) rotate(-1deg); filter: drop-shadow(0 2px 24px rgba(240, 240, 255, 0.9)); }
                                        75% { transform: scale(1.12) translateY(-3px) rotate(-6deg); filter: drop-shadow(0 6px 32px rgba(255, 255, 255, 0.95)); }
                                        100% { transform: scale(1) translateY(0) rotate(-4deg); filter: drop-shadow(0 4px 24px rgba(255, 255, 255, 0.95)); }
                                    }

                                    @keyframes whiteHeatPulse {
                                        0%, 100% { transform: scale(0.9); opacity: 0.5; }
                                        50% { transform: scale(1.4); opacity: 0.95; }
                                    }
                                `}} />

                                <div className="relative w-full mt-6">
                                    {/* 3D FLOATING WHITE FIRING FLAME AT TOP CENTER */}
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none">
                                        <div className="relative flex items-center justify-center">
                                            <div className="absolute w-16 h-16 rounded-full blur-xl animate-[whiteHeatPulse_2s_infinite] bg-white/70" />
                                            <Flame
                                                size={58}
                                                className="text-white fill-slate-100 transform transition-all duration-300 animate-[whiteFireFlicker_1.2s_infinite_alternate_ease-in-out]"
                                            />
                                        </div>
                                    </div>

                                    {/* Outer Card Container */}
                                    <div className="w-full bg-[#0e101a]/95 rounded-3xl sm:rounded-[36px] p-5 sm:p-8 pt-12 text-white shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-slate-800 backdrop-blur-xl relative overflow-hidden flex flex-col items-center">
                                        {/* Background Grid Overlay */}
                                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2133_1px,transparent_1px),linear-gradient(to_bottom,#1f2133_1px,transparent_1px)] bg-[size:24px_24px] opacity-30 pointer-events-none" />

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
                                                    {/* Top Status Header Row */}
                                                    <div className="w-full flex justify-between items-center border-b border-slate-800/80 pb-3 mb-6 relative z-10 font-mono">
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
                                                            JOKER TRIAL FINAL RESULTS
                                                        </span>
                                                        <span className={`px-3 py-1 bg-slate-900 border rounded-full text-xs font-black font-mono uppercase tracking-wider ${winnerEscaped ? 'border-emerald-500/50 text-emerald-400' : 'border-red-500/50 text-red-400'}`}>
                                                            {winnerEscaped ? 'VICTORY ESCAPE' : 'TRIAL ELIMINATION'}
                                                        </span>
                                                    </div>

                                                    {/* LEFT & RIGHT SPLIT CONTENT LAYOUT */}
                                                    <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-center relative z-10 font-mono">
                                                        
                                                        {/* LEFT COLUMN: Place Number #1 & Champion Graphic */}
                                                        <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-[#141624] border border-slate-800/80 rounded-3xl shadow-inner min-h-[220px]">
                                                            <div className="relative group flex flex-col items-center text-center">
                                                                <div className="absolute inset-0 bg-white/20 rounded-full blur-2xl group-hover:blur-3xl transition-all" />
                                                                
                                                                {/* Place Number #1 Badge Box (GLOW GREEN IF WIN, GLOW RED IF ELIMINATED) */}
                                                                <div className={`relative p-5 rounded-2xl transform hover:scale-105 transition-all flex flex-col items-center min-w-[150px] ${
                                                                    winnerEscaped
                                                                        ? 'bg-[#041a12] border-2 border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.5)] text-emerald-300'
                                                                        : 'bg-[#1c080e] border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.5)] text-red-300'
                                                                }`}>
                                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 shadow-inner ${
                                                                        winnerEscaped
                                                                            ? 'bg-emerald-950 border border-emerald-400/80 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.6)]'
                                                                            : 'bg-red-950 border border-red-500/80 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.6)]'
                                                                    }`}>
                                                                        <span className="font-cinzel text-2xl font-black">#1</span>
                                                                    </div>
                                                                    <span className={`text-[9px] font-black tracking-[0.2em] uppercase font-mono ${
                                                                        winnerEscaped ? 'text-emerald-400' : 'text-red-400'
                                                                    }`}>
                                                                        STAGE CHAMPION
                                                                    </span>
                                                                    <h3 className="font-cinzel text-lg sm:text-xl font-black text-white uppercase tracking-wider mt-1">
                                                                        {winnerPlayer?.username || gameState?.winner_username || 'CHAMPION'}
                                                                    </h3>
                                                                </div>

                                                                <span className={`text-[10px] font-black tracking-[0.15em] uppercase font-mono block mt-3 px-3 py-1 rounded-full border ${winnerEscaped ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' : 'bg-red-950/60 border-red-500/50 text-red-400'}`}>
                                                                    {winnerEscaped ? 'ESCAPED (+1000 PTS)' : 'ELIMINATED (-200 PTS)'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* RIGHT COLUMN: Title, Subtitle, Leaderboard List & Single Return Button */}
                                                        <div className="md:col-span-7 flex flex-col items-start text-left space-y-4 w-full">
                                                            
                                                            {/* Main Title */}
                                                            <div className="space-y-1">
                                                                <h2 className="font-cinzel text-2xl sm:text-3xl font-black uppercase tracking-[0.15em] text-white">
                                                                    {isIWinner ? 'JOKER TRIAL VICTORY!' : 'PROTOCOL CONCLUDED'}
                                                                </h2>
                                                                <div className="w-20 h-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                                                            </div>

                                                            {/* Subtitle Message */}
                                                            <p className="text-xs text-slate-300 font-mono leading-relaxed">
                                                                {winnerEscaped ? (
                                                                    <>Player <strong className="text-white font-bold">{winnerPlayer?.username}</strong> successfully navigated the 14-round maze to reach the Exit Gate.</>
                                                                ) : (
                                                                    <>All candidates failed to reach exit gates within 14 rounds of rotated maze trials.</>
                                                                )}
                                                            </p>

                                                            {/* Leaderboard Rankings Section */}
                                                            <div className="w-full bg-[#161826] border border-slate-800 rounded-2xl p-3.5 space-y-2">
                                                                <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                                                                        RANKING // CANDIDATE SCORES
                                                                    </span>
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                                                                        FINAL CREDITS
                                                                    </span>
                                                                </div>

                                                                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                                                                    {sortedParticipants.map((p, idx) => {
                                                                        const isEscaped = Boolean(p.hasReachedExit || p.status === 'escaped');
                                                                        const baseScore = p.score || 0;
                                                                        const finalScore = isEscaped ? baseScore + 1000 : Math.max(0, baseScore - 200);

                                                                        return (
                                                                            <div
                                                                                key={p.id || idx}
                                                                                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-all ${
                                                                                    idx === 0
                                                                                        ? 'bg-white/10 border border-white/30 text-white font-bold shadow-sm'
                                                                                        : 'bg-[#0e101a] text-slate-300 border border-slate-800/80'
                                                                                }`}
                                                                            >
                                                                                <div className="flex items-center gap-2.5">
                                                                                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                                                                                        idx === 0 ? 'bg-white text-slate-950' : 'bg-slate-800 text-slate-400'
                                                                                    }`}>
                                                                                        #{idx + 1}
                                                                                    </span>
                                                                                    <span className="font-bold tracking-wider">{p.username}</span>
                                                                                </div>

                                                                                <div className="flex items-center gap-2">
                                                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                                                                        isEscaped ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40' : 'bg-red-950/80 text-red-400 border border-red-500/40'
                                                                                    }`}>
                                                                                        {isEscaped ? 'ESCAPED' : 'ELIMINATED'}
                                                                                    </span>
                                                                                    <span className="font-black text-white min-w-[65px] text-right">
                                                                                        {finalScore} PTS
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>

                                                            {/* Bottom Action Button (Single Full-Width Return Button) */}
                                                            <div className="w-full pt-1">
                                                                <button
                                                                    onClick={() => {
                                                                        if (onClose) {
                                                                            onClose();
                                                                        } else {
                                                                            window.location.href = '/home';
                                                                        }
                                                                    }}
                                                                    className="w-full py-3 bg-white hover:bg-slate-100 text-slate-950 font-mono font-black text-xs uppercase tracking-widest rounded-full flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)] cursor-pointer transform hover:scale-[1.01]"
                                                                >
                                                                    <Home size={15} />
                                                                    <span>RETURN TO LOBBY</span>
                                                                </button>
                                                            </div>

                                                        </div>

                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
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

            {/* Screen Protection Blackout Overlay for Screenshot / Screen Record Protection (Only active during minigames) */}
            {isScreenProtected && (activeMinigame || gameState?.phase === 'minigame') && (
                <div className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center text-white font-mono text-center p-6 select-none pointer-events-none">
                    <ShieldAlert size={56} className="text-red-500 animate-pulse mb-4" />
                    <h2 className="text-2xl font-bold tracking-widest text-red-500 uppercase mb-2">SCREEN PROTECTED</h2>
                    <p className="text-sm text-slate-400 max-w-md">Screenshots and Screen Recording are disabled for game safety.</p>
                </div>
            )}
        </div>
    );
};
