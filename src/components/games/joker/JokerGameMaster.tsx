import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Play, Pause, RotateCcw, AlertTriangle, RefreshCw, Layers, CheckCircle2, ChevronRight, X, Map, Eye, Users, Crown } from 'lucide-react';
import { supabase, supabaseUrl, supabaseKey, getAccessToken } from '../../../supabaseClient';
import type { JokerGameState, JokerPlayer, JokerPhase, DoorData } from './jokerTypes';
import { generateRotatedMap, ensureTwentyFourSpecialCards, getEntryCell, getRandomEntryCell, getRotationFromMatrix, placeTrumpCardInRandomCell, parseMapMatrix, buildMapMatrixPayload } from './jokerMapData';
import { JokerMapGrid } from './JokerMapGrid';
import { processDoorPurchase, processNoPurchasePenalty } from './jokerEngine';
import { JokerGameConfig } from './config/JokerGameConfig';
import { calculateRedCostMultiplier, getDefaultStartingInventory } from './jokerInventoryConfig';

const GAME_ID = 'joker_main';

const deduplicateParticipants = (list: JokerPlayer[]): JokerPlayer[] => {
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

interface JokerGameMasterProps {
    user?: any;
    onClose?: () => void;
}

export const JokerGameMaster: React.FC<JokerGameMasterProps> = ({ user }) => {
    const [gameState, setGameState] = useState<JokerGameState | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showMapModal, setShowMapModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);

    const isAdvancingRef = useRef(false);
    const gameStateRef = useRef<JokerGameState | null>(null);

    // Sync Helper with Offline Retry Queue
    const syncStateToDB = async (payload: Partial<JokerGameState>) => {
        const attempt = async (retries = 5, delay = 1000) => {
            try {
                const token = await getAccessToken();
                const cleanPayload: any = { ...payload };

                let mapObj: any = cleanPayload.map_matrix;
                if (cleanPayload.map_matrix) {
                    const parsed = parseMapMatrix(cleanPayload.map_matrix);
                    const oldM = cleanPayload.old_map_matrix || parsed.old_map;
                    const newM = cleanPayload.new_map_matrix || parsed.new_map;
                    mapObj = buildMapMatrixPayload(parsed.grid, oldM, newM);
                }
                cleanPayload.map_matrix = mapObj;
                delete cleanPayload.old_map_matrix;
                delete cleanPayload.new_map_matrix;

                const res = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'apikey': supabaseKey
                    },
                    body: JSON.stringify(cleanPayload)
                });
                if (!res.ok) throw new Error(`Network response was not ok: ${res.status}`);
            } catch (err) {
                if (retries > 0) {
                    console.warn(`[JOKER_MASTER] Network error, retrying in ${delay}ms...`);
                    setTimeout(() => attempt(retries - 1, delay * 2), delay);
                } else {
                    console.error('[JOKER_MASTER] Sync permanently failed after retries:', err);
                }
            }
        };
        attempt();
    };

    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    const fetchState = async () => {
        try {
            const token = await getAccessToken();
            const res = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseKey
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    setGameState(data[0]);
                } else {
                    const randomRotation = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
                    const initialMap = ensureTwentyFourSpecialCards(generateRotatedMap(randomRotation));
                    await fetch(`${supabaseUrl}/rest/v1/joker_game_state`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'apikey': supabaseKey,
                            'Prefer': 'resolution=merge-duplicates'
                        },
                        body: JSON.stringify({
                            id: GAME_ID,
                            system_start: false,
                            phase: 'briefing',
                            current_round: 1,
                            map_rotation: randomRotation,
                            map_matrix: initialMap,
                            participants: [],
                            is_paused: false,
                            phase_duration_sec: JokerGameConfig.getPhaseDuration('briefing', 1),
                            phase_started_at: new Date().toISOString()
                        })
                    });
                    fetchState();
                }
            }
        } catch (err) {
            console.error('[JOKER_MASTER] Fetch error:', err);
        }
    };

    useEffect(() => {
        fetchState();
        const channel = supabase
            .channel('public:joker_game_state_master')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'joker_game_state', filter: `id=eq.${GAME_ID}` },
                (payload) => {
                    if (payload.new) {
                        setGameState(payload.new as JokerGameState);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const saveMasterScores = async (participants: JokerPlayer[]) => {
        if (!participants || participants.length === 0) return;
        for (const p of participants) {
            try {
                const targetUser = p.username || (p as any).email;
                if (!targetUser) continue;

                const hasEscaped = Boolean(p.hasReachedExit || p.status === 'escaped');
                const baseGameScore = typeof p.score === 'number' ? p.score : 1000;
                const delta = hasEscaped ? 1000 : -200;
                const finalVisaPoints = Math.max(0, baseGameScore + delta);

                let query = supabase.from('profiles').select('id, email, username, visa_points');
                if (targetUser.includes('@')) {
                    query = query.eq('email', targetUser);
                } else {
                    query = query.or(`username.ilike.${targetUser},email.ilike.${targetUser}@borderland.app`);
                }

                const { data: prof } = await query.maybeSingle();

                if (prof) {
                    console.log(`[JOKER_MASTER_VISA_UPDATE] Syncing ${prof.username} (${prof.id}). Game Score: ${baseGameScore} + Delta (${delta}) -> Final DB Visa: ${finalVisaPoints}`);

                    await supabase
                        .from('profiles')
                        .update({ visa_points: finalVisaPoints })
                        .eq('id', prof.id);

                    try {
                        const accessToken = await getAccessToken();
                        await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${prof.id}`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${accessToken || supabaseKey}`,
                                'apikey': supabaseKey,
                                'Prefer': 'return=minimal'
                            },
                            body: JSON.stringify({ visa_points: finalVisaPoints })
                        });
                    } catch (rErr) {
                        console.warn(rErr);
                    }
                }
            } catch (err) {
                console.error('[JOKER_MASTER_VISA_FATAL] Error in saveMasterScores:', err);
            }
        }
    };

    // Automatic Phase Advancement Ticker
    useEffect(() => {
        const interval = setInterval(async () => {
            const currentGS = gameStateRef.current;
            if (!currentGS || !currentGS.system_start || currentGS.is_paused || !currentGS.phase_started_at) return;

            let startStr = String(currentGS.phase_started_at).trim().replace(' ', 'T');
            if (startStr.match(/[+-]\d{2}$/)) startStr += ':00';
            if (!startStr.endsWith('Z') && !startStr.match(/[+-]\d{2}:?\d{2}$/)) startStr += 'Z';
            const startTime = new Date(startStr).getTime();
            if (isNaN(startTime)) return;

            const now = new Date().getTime();
            const elapsed = Math.floor((now - startTime) / 1000);
            const duration = currentGS.phase_duration_sec || 30;

            if (elapsed >= duration) {
                if (isAdvancingRef.current) return;
                isAdvancingRef.current = true;

                try {
                    const token = await getAccessToken();

                    // Fetch latest state to ensure we don't overwrite with stale background tab data
                    const freshRes = await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'apikey': supabaseKey
                        }
                    });
                    const freshData = await freshRes.json();
                    const freshGS = freshData && freshData.length > 0 ? freshData[0] : currentGS;

                    let nextPhase: JokerPhase = freshGS.phase;
                    let nextRound = freshGS.current_round || 1;

                    if (freshGS.phase === 'briefing') {
                        nextPhase = 'choosing';
                    } else if (freshGS.phase === 'choosing') {
                        nextPhase = 'reveal';
                    } else if (freshGS.phase === 'reveal') {
                        if (nextRound >= 14) {
                            syncStateToDB({ phase: 'end', system_start: false });
                            isAdvancingRef.current = false;
                            return;
                        } else {
                            nextRound += 1;
                            if (JokerGameConfig.isMinigameRound(nextRound)) {
                                nextPhase = 'minigame';
                            } else {
                                nextPhase = 'choosing';
                            }
                        }
                    } else if (freshGS.phase === 'minigame') {
                        nextPhase = 'choosing';
                    }

                    const nextDuration = JokerGameConfig.getPhaseDuration(nextPhase, nextRound);

                    let currentMatrix = freshGS.map_matrix && freshGS.map_matrix.length === 7
                        ? freshGS.map_matrix
                        : generateRotatedMap(freshGS.map_rotation || 0);

                    const updatedParticipants = (freshGS.participants || []).map((p: JokerPlayer) => {
                        if (freshGS.phase === 'choosing' && nextPhase === 'reveal') {
                            // Start of Reveal Phase: Keep player in current room! Record purchase choice & deduct score
                            if (p.pendingDoorChoice) {
                                const isSkipChoice = Boolean(p.pendingDoorChoice.isSkip || p.hasUsedSkipCard);
                                const actualCost = isSkipChoice ? 0 : (p.pendingDoorChoice.finalCost || 0);
                                return {
                                    ...p,
                                    score: Math.max(0, (p.score || 0) - actualCost),
                                    lastDoorChoice: p.pendingDoorChoice,
                                    boughtDoorChoice: p.pendingDoorChoice,
                                    pendingDoorChoice: undefined
                                };
                            } else {
                                // Candidate did NOT select or lock a door: Reset temporary flags
                                return {
                                    ...p,
                                    inventory: p.inventory || [],
                                    hasUsedGreenCard: false,
                                    hasUsedSkipCard: false
                                };
                            }
                        } else if (freshGS.phase === 'reveal' && nextPhase === 'choosing') {
                            // End of Reveal Phase (Timer Ups): Master authoritatively advances EVERY player to next room cell
                            let choice: any = p.boughtDoorChoice || p.lastDoorChoice || p.pendingDoorChoice;

                            if (choice?.door) {
                                if (choice.isProcessed) {
                                    // Player already walked into room during 3D Reveal Phase! Do NOT apply processDoorPurchase a second time!
                                    const isGreenWasUsed = p.hasUsedGreenCard || choice?.door?.isGreenUsed;
                                    const finalInventory = p.inventory || [];
                                    const cleanP: any = { ...p };
                                    delete cleanP.pendingDoorChoice;
                                    delete cleanP.lastDoorChoice;
                                    delete cleanP.boughtDoorChoice;

                                    return {
                                        ...cleanP,
                                        inventory: finalInventory,
                                        hasUsedGreenCard: false,
                                        hasUsedSkipCard: false,
                                        nextRoundCostMultiplier: isGreenWasUsed ? 1 : (p.nextRoundCostMultiplier || 1),
                                        frozenBy: undefined,
                                        frozenByPlayerId: undefined,
                                        blockedDoorsByRed: [],
                                        blockedByPlayerName: undefined,
                                        blockedByPlayerId: undefined
                                    };
                                }

                                const { door, finalCost, isSkip } = choice;
                                const { updatedPlayer } = processDoorPurchase(p, door, finalCost, isSkip, currentMatrix);
                                delete updatedPlayer.pendingDoorChoice;
                                delete (updatedPlayer as any).lastDoorChoice;
                                delete (updatedPlayer as any).boughtDoorChoice;
                                const isGreenWasUsed = p.hasUsedGreenCard || choice?.door?.isGreenUsed;
                                const finalInventory = updatedPlayer.inventory || [];

                                return {
                                    ...updatedPlayer,
                                    inventory: finalInventory,
                                    hasUsedGreenCard: false,
                                    hasUsedSkipCard: false,
                                    nextRoundCostMultiplier: isGreenWasUsed ? 1 : (p.nextRoundCostMultiplier || 1),
                                    frozenBy: undefined,
                                    frozenByPlayerId: undefined,
                                    blockedDoorsByRed: [],
                                    blockedByPlayerName: undefined,
                                    blockedByPlayerId: undefined
                                };
                            } else {
                                const penalizedPlayer = processNoPurchasePenalty(p, freshGS.current_round);
                                delete penalizedPlayer.pendingDoorChoice;
                                delete (penalizedPlayer as any).lastDoorChoice;
                                delete (penalizedPlayer as any).boughtDoorChoice;
                                const isGreenWasUsed = p.hasUsedGreenCard;
                                const finalInventory = penalizedPlayer.inventory || [];

                                return {
                                    ...penalizedPlayer,
                                    inventory: finalInventory,
                                    hasUsedGreenCard: false,
                                    hasUsedSkipCard: false,
                                    nextRoundCostMultiplier: isGreenWasUsed ? 1 : (p.nextRoundCostMultiplier || 1),
                                    frozenBy: undefined,
                                    frozenByPlayerId: undefined,
                                    blockedDoorsByRed: [],
                                    blockedByPlayerName: undefined,
                                    blockedByPlayerId: undefined
                                };
                            }
                        }
                        return p;
                    });

                    const isRoundAdvancing = nextRound !== freshGS.current_round;
                    let payloadMatrix = freshGS.map_matrix;
                    if (isRoundAdvancing) {
                        const parsedCurrent = parseMapMatrix(freshGS.map_matrix);
                        payloadMatrix = buildMapMatrixPayload(parsedCurrent.new_map, parsedCurrent.new_map, parsedCurrent.new_map);
                    }

                    // Update game state immediately and sync in background
                    setGameState({
                        ...freshGS,
                        phase: nextPhase,
                        current_round: nextRound,
                        phase_started_at: new Date().toISOString(),
                        phase_duration_sec: nextDuration,
                        map_matrix: payloadMatrix,
                        participants: updatedParticipants
                    } as any);

                    syncStateToDB({
                        phase: nextPhase,
                        current_round: nextRound,
                        phase_started_at: new Date().toISOString(),
                        phase_duration_sec: nextDuration,
                        map_matrix: payloadMatrix,
                        participants: updatedParticipants
                    });

                    if (nextPhase === 'end' || updatedParticipants.some((p: JokerPlayer) => p.hasReachedExit || p.status === 'escaped')) {
                        saveMasterScores(updatedParticipants);
                    }

                } catch (err) {
                    console.error('[JOKER_MASTER] Advance error:', err);
                } finally {
                    isAdvancingRef.current = false;
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Toggle System Start / Game Initiation (Picks random map rotation 0°, 90°, 180°, 270° & sets 10s briefing)
    const handleStartGame = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const token = await getAccessToken();
            // Prevent consecutive same map rotations by reading the matrix directly
            const prevRotation = gameState?.map_matrix ? getRotationFromMatrix(gameState.map_matrix) : -1;
            const availableRotations = [0, 90, 180, 270].filter(r => r !== prevRotation);
            const randomRotation = availableRotations[Math.floor(Math.random() * availableRotations.length)];
            const activeMap = ensureTwentyFourSpecialCards(generateRotatedMap(randomRotation));

            let currentList = gameState?.participants || [];

            // Fetch latest visa points from profiles for all players
            const { data: profilesData } = await supabase.from('profiles').select('*');
            const visaMap: Record<string, number> = {};
            const nameVisaMap: Record<string, number> = {};
            if (profilesData && profilesData.length > 0) {
                profilesData.forEach((p: any) => {
                    if (p.id && typeof p.visa_points === 'number') visaMap[p.id] = p.visa_points;
                    if (p.username && typeof p.visa_points === 'number') nameVisaMap[String(p.username).toLowerCase()] = p.visa_points;
                });
            }


            const availableGates = [1, 2, 3];
            for (let i = availableGates.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availableGates[i], availableGates[j]] = [availableGates[j], availableGates[i]];
            }

            const resetParticipants = currentList.map((p: any, idx: number) => {
                const entryIdx = availableGates[idx % availableGates.length];
                const entryCell = getEntryCell(activeMap, entryIdx);
                const realVisa = (p.id ? visaMap[p.id] : undefined) ?? (p.username ? nameVisaMap[String(p.username).toLowerCase()] : undefined) ?? p.visa_points ?? p.points;
                return {
                    ...p,
                    entryIndex: entryIdx,
                    targetExitIndex: entryIdx,
                    currentR: entryCell.r,
                    currentC: entryCell.c,
                    score: realVisa ?? p.score ?? 1000,
                    status: 'active' as const,
                    pendingDoorChoice: undefined,
                    lastDoorChoice: undefined,
                    inventory: getDefaultStartingInventory(false),
                    hasUsedGreenCard: false,
                    hasUsedSkipCard: false,
                    nextRoundCostMultiplier: calculateRedCostMultiplier(getDefaultStartingInventory(false), 0, false),
                    frozenBy: undefined,
                    frozenByPlayerId: undefined,
                    blockedDoorsByRed: [],
                    blockedByPlayerName: undefined,
                    blockedByPlayerId: undefined,
                    trumpSwappedBy: undefined,
                    hasReachedExit: false
                };
            });

            const payloadMatrix = buildMapMatrixPayload(activeMap, activeMap, activeMap);

            // Optimistic UI Update: Apply state locally instantly so the game starts for the admin immediately
            const newGameState = {
                id: GAME_ID,
                system_start: true,
                phase: 'briefing',
                current_round: 1,
                map_rotation: randomRotation,
                map_matrix: payloadMatrix,
                participants: resetParticipants,
                claimed_cards: {},
                winner_id: null,
                winner_username: null,
                is_paused: false,
                phase_started_at: new Date().toISOString(),
                phase_duration_sec: JokerGameConfig.getPhaseDuration('briefing', 1)
            };
            setGameState(newGameState as any);

            // Use the offline-resilient sync helper
            syncStateToDB({
                system_start: true,
                phase: 'briefing',
                current_round: 1,
                map_rotation: randomRotation,
                map_matrix: payloadMatrix,
                participants: resetParticipants,
                winner_id: null,
                winner_username: null,
                phase_started_at: new Date().toISOString(),
                phase_duration_sec: JokerGameConfig.getPhaseDuration('briefing', 1)
            });

        } catch (err) {
            console.error('[JOKER_MASTER] Start error:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    // Toggle Pause
    const handleTogglePause = async () => {
        if (!gameState || isProcessing) return;
        setIsProcessing(true);
        try {
            const token = await getAccessToken();
            await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseKey
                },
                body: JSON.stringify({ is_paused: !gameState.is_paused })
            });
            await fetchState();
        } catch (err) {
            console.error('[JOKER_MASTER] Pause error:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    // Reset Game Session with Keep Points / Reset Points choice & random map rotation
    const handleResetGame = async (keepPoints: boolean = false) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const token = await getAccessToken();
            // Prevent consecutive same map rotations
            const prevRotation = gameState?.map_matrix ? getRotationFromMatrix(gameState.map_matrix) : -1;
            const availableRotations = [0, 90, 180, 270].filter(r => r !== prevRotation);
            const randomRotation = availableRotations[Math.floor(Math.random() * availableRotations.length)];
            const activeMap = ensureTwentyFourSpecialCards(generateRotatedMap(randomRotation));

            const currentParticipants = gameState?.participants || [];

            // If admin restarts without points, clear/revert updated visa points in Supabase profiles
            if (!keepPoints) {
                for (const p of currentParticipants) {
                    try {
                        const isWinner = p.hasReachedExit || p.status === 'escaped';
                        const deltaToRevert = isWinner ? -1000 : 200;

                        const targetUser = p.username || (p as any).email;
                        if (!targetUser) continue;

                        let query = supabase.from('profiles').select('id, email, username, visa_points');
                        if (targetUser.includes('@')) {
                            query = query.eq('email', targetUser);
                        } else {
                            query = query.ilike('username', targetUser);
                        }

                        const { data: prof } = await query.maybeSingle();

                        if (prof) {
                            const currentVisa = typeof prof.visa_points === 'number' ? prof.visa_points : 1000;
                            const revertedVisa = Math.max(0, currentVisa + deltaToRevert);

                            // 1. Supabase Client Update
                            await supabase
                                .from('profiles')
                                .update({ visa_points: revertedVisa })
                                .eq('id', prof.id);

                            // 2. Direct REST PATCH API Update (Bypasses RLS to guarantee instant DB realtime revert)
                            await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${prof.id}`, {
                                method: 'PATCH',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`,
                                    'apikey': supabaseKey
                                },
                                body: JSON.stringify({ visa_points: revertedVisa })
                            });

                            console.log(`[JOKER_MASTER_RESET] Realtime Reverted ${deltaToRevert} PTS for ${p.username || prof.id}. Cleaned Visa: ${revertedVisa}`);
                        }
                    } catch (e) {
                        console.error('[JOKER_MASTER_RESET] Error reverting visa points:', e);
                    }
                }
            }

            const availableGates = [1, 2, 3];
            for (let i = availableGates.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availableGates[i], availableGates[j]] = [availableGates[j], availableGates[i]];
            }

            const resetParticipants = currentParticipants.map((p, idx) => {
                const entryIdx = availableGates[idx % availableGates.length];
                const entryCell = getEntryCell(activeMap, entryIdx);
                return {
                    ...p,
                    entryIndex: entryIdx,
                    targetExitIndex: entryIdx,
                    currentR: entryCell.r,
                    currentC: entryCell.c,
                    score: keepPoints ? (p.score ?? 1000) : 1000,
                    inventory: getDefaultStartingInventory(false),
                    status: 'active' as const,
                    pendingDoorChoice: undefined,
                    hasReachedExit: false
                };
            });

            const payloadMatrix = buildMapMatrixPayload(activeMap, activeMap, activeMap);

            await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseKey
                },
                body: JSON.stringify({
                    system_start: true,
                    phase: 'briefing',
                    current_round: 1,
                    map_rotation: randomRotation,
                    map_matrix: payloadMatrix,
                    participants: deduplicateParticipants(resetParticipants),
                    winner_id: null,
                    winner_username: null,
                    phase_started_at: new Date().toISOString(),
                    phase_duration_sec: JokerGameConfig.getPhaseDuration('briefing', 1)
                })
            });
            await fetchState();
        } catch (err) {
            console.error('[JOKER_MASTER] Reset error:', err);
        } finally {
            setIsProcessing(false);
            setShowResetModal(false);
        }
    };

    // Admin Refresh Map Cards (Only allowed BEFORE game starts)
    const handleRefreshMapCards = async () => {
        if (gameState?.system_start || isProcessing) return;
        setIsProcessing(true);
        try {
            const token = await getAccessToken();
            const prevRotation = gameState?.map_matrix ? getRotationFromMatrix(gameState.map_matrix) : -1;
            const availableRotations = [0, 90, 180, 270].filter(r => r !== prevRotation);
            const randomRotation = availableRotations[Math.floor(Math.random() * availableRotations.length)];
            const freshMap = ensureTwentyFourSpecialCards(generateRotatedMap(randomRotation));

            await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseKey
                },
                body: JSON.stringify({
                    map_rotation: randomRotation,
                    map_matrix: freshMap
                })
            });
            await fetchState();
        } catch (err) {
            console.error('[JOKER_MASTER] Refresh cards error:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRemovePlayer = async (playerId: string) => {
        try {
            const token = await getAccessToken();
            const updated = (gameState?.participants || []).filter(p => p.id !== playerId);
            await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey },
                body: JSON.stringify({ participants: updated })
            });
            fetchState();
        } catch (e) {
            console.error('Failed to remove player:', e);
        }
    };

    const handleClearRoster = async () => {
        try {
            const token = await getAccessToken();
            await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey },
                body: JSON.stringify({ participants: [] })
            });
            fetchState();
        } catch (e) {
            console.error('Failed to clear roster:', e);
        }
    };

    // Admin Action: Grant Trump Card to All Active Players
    const handleGrantTrumpCardToAll = async () => {
        if (!gameState?.participants || isProcessing) return;
        setIsProcessing(true);
        try {
            const token = await getAccessToken();
            const updatedParticipants = gameState.participants.map(p => ({
                ...p,
                inventory: [...(p.inventory || []), 'trump']
            }));

            await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey },
                body: JSON.stringify({ participants: updatedParticipants })
            });
            await fetchState();
        } catch (e) {
            console.error('Failed to grant Trump Card:', e);
        } finally {
            setIsProcessing(false);
        }
    };

    // Admin Action: Spawn 1 Trump Card on Map Matrix
    const handleSpawnTrumpCardOnMap = async () => {
        if (!gameState?.map_matrix || isProcessing) return;
        setIsProcessing(true);
        try {
            const token = await getAccessToken();
            const newMatrix = placeTrumpCardInRandomCell([...gameState.map_matrix]);

            await fetch(`${supabaseUrl}/rest/v1/joker_game_state?id=eq.${GAME_ID}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey },
                body: JSON.stringify({ map_matrix: newMatrix })
            });
            await fetchState();
        } catch (e) {
            console.error('Failed to spawn Trump Card on map:', e);
        } finally {
            setIsProcessing(false);
        }
    };

    const participants = gameState?.participants || [];
    const gridMatrix = gameState?.map_matrix && gameState.map_matrix.length === 7
        ? gameState.map_matrix
        : generateRotatedMap(gameState?.map_rotation || 0);

    return (
        <div className="min-h-screen bg-[#050508] text-slate-100 font-mono p-4 sm:p-8 max-w-6xl mx-auto select-none">
            {/* Header Banner */}
            <div className="p-6 bg-[#09090e]/90 border border-slate-400/40 rounded-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_50px_rgba(226,232,240,0.1)]">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-slate-800 border border-slate-600 rounded-xl text-slate-200">
                        <Shield size={28} className="animate-pulse" />
                    </div>
                    <div>
                        <h1 className="font-cinzel text-xl sm:text-3xl font-black text-slate-100 tracking-widest uppercase">
                            JOKER GAME MASTER <span className="text-slate-400">:: COMMAND UNIT</span>
                        </h1>
                        <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                            CONTROL CENTER // ROTATED MAZE LABYRINTH PROTOCOL
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setShowMapModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-500 rounded-xl text-xs font-bold text-slate-200 uppercase tracking-widest transition-all cursor-pointer shadow-lg"
                >
                    <Map size={16} />
                    <span>INSPECT 7x7 MAP</span>
                </button>
            </div>

            {/* Dashboard Control Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
                {/* Panel 1: System Status */}
                <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-cinzel">SYSTEM STATUS</h4>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between border-b border-slate-800 pb-2">
                            <span className="text-slate-500">PHASE:</span>
                            <span className="font-bold text-slate-200 uppercase">{gameState?.phase || 'IDLE'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-2">
                            <span className="text-slate-500">ROUND:</span>
                            <span className="font-bold text-slate-200">{gameState?.current_round || 1} / 14</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">MAP ROTATION:</span>
                            <span className="font-bold text-slate-200">{gameState?.map_matrix ? getRotationFromMatrix(gameState.map_matrix) : (gameState?.map_rotation || 0)}°</span>
                        </div>
                    </div>
                </div>

                {/* Panel 2: Command Actions */}
                <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-cinzel">COMMAND ACTIONS</h4>
                    <div className="flex flex-col gap-2">
                        {!gameState?.system_start ? (
                            <button
                                onClick={handleStartGame}
                                disabled={isProcessing}
                                className="flex items-center justify-center gap-2 py-2.5 bg-slate-200 hover:bg-white text-black font-bold text-xs uppercase tracking-widest rounded-lg transition-all cursor-pointer"
                            >
                                <Play size={14} /> INITIATE JOKER TRIAL
                            </button>
                        ) : (
                            <button
                                onClick={handleTogglePause}
                                disabled={isProcessing}
                                className="flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-500 text-slate-200 font-bold text-xs uppercase tracking-widest rounded-lg transition-all cursor-pointer"
                            >
                                {gameState.is_paused ? <Play size={14} /> : <Pause size={14} />}
                                {gameState.is_paused ? 'RESUME SESSION' : 'PAUSE SESSION'}
                            </button>
                        )}

                        <button
                            onClick={() => setShowResetModal(true)}
                            disabled={isProcessing}
                            className="flex items-center justify-center gap-2 py-2.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 font-bold text-xs uppercase tracking-widest rounded-lg transition-all cursor-pointer"
                        >
                            <RotateCcw size={14} /> RESET GAME SESSION
                        </button>

                        <button
                            onClick={handleGrantTrumpCardToAll}
                            disabled={isProcessing || !gameState?.participants || gameState.participants.length === 0}
                            className="flex items-center justify-center gap-2 py-2 bg-amber-950/60 hover:bg-amber-900 border border-amber-400/60 text-amber-300 font-bold text-xs uppercase tracking-widest rounded-lg transition-all cursor-pointer shadow-md"
                        >
                            <Crown size={14} className="text-amber-400" /> GRANT TRUMP CARD TO PLAYERS
                        </button>

                        <button
                            onClick={handleSpawnTrumpCardOnMap}
                            disabled={isProcessing || !gameState?.map_matrix}
                            className="flex items-center justify-center gap-2 py-2 bg-purple-950/60 hover:bg-purple-900 border border-purple-400/60 text-purple-300 font-bold text-xs uppercase tracking-widest rounded-lg transition-all cursor-pointer shadow-md"
                        >
                            <Map size={14} className="text-purple-400" /> SPAWN TRUMP CARD ON MAP
                        </button>
                    </div>
                </div>

                {/* Panel 3: Active Participants */}
                <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-cinzel flex items-center justify-between">
                        <span>ROSTER ({participants.length})</span>
                        {participants.length > 0 && (
                            <button
                                onClick={handleClearRoster}
                                className="text-[10px] text-red-400 hover:text-red-300 underline uppercase tracking-wider font-mono cursor-pointer"
                            >
                                Clear All
                            </button>
                        )}
                    </h4>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2">
                        {participants.length > 0 ? (
                            participants.map(p => (
                                <div key={p.id} className="p-2 bg-slate-900 border border-slate-800 rounded flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-200">{p.username}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-emerald-400 font-mono">{p.score ?? 1000} CR</span>
                                        <button
                                            onClick={() => handleRemovePlayer(p.id)}
                                            title="Remove player from roster"
                                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest text-center py-4">No candidates registered</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Admin Map Inspector Modal */}
            <AnimatePresence>
                {showMapModal && (
                    <div className="fixed inset-0 z-[1100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#050508] border border-slate-400/50 p-6 rounded-2xl max-w-3xl w-full font-mono text-slate-100 relative shadow-2xl space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-700/60">
                                <div>
                                    <h3 className="font-cinzel text-xl font-bold text-slate-100 uppercase tracking-widest flex items-center gap-3">
                                        <Map className="text-slate-300" size={22} />
                                        7x7 LABYRINTH MAP INSPECTOR
                                    </h3>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                                        GREEN DOT = GROUPED PLAYERS // RED DOT = SINGLE PLAYER // CLICK CELL TO INSPECT
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleRefreshMapCards}
                                        disabled={gameState?.system_start}
                                        title={gameState?.system_start ? "Refresh disabled after game starts" : "Refresh points & special cards"}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider border transition-all ${gameState?.system_start
                                            ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                                            : 'bg-slate-800 hover:bg-slate-700 border-slate-500 text-slate-200 cursor-pointer shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                                            }`}
                                    >
                                        <RefreshCw size={14} className={isProcessing ? 'animate-spin' : ''} />
                                        <span>REFRESH MAP</span>
                                    </button>

                                    <button onClick={() => setShowMapModal(false)} className="p-2 text-slate-400 hover:text-white cursor-pointer">
                                        <X size={22} />
                                    </button>
                                </div>
                            </div>

                            <JokerMapGrid
                                gridMatrix={gridMatrix}
                                players={participants}
                                isAdminView={true}
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Admin Restart Confirmation Modal (Keep Points / Reset Points choice) */}
            <AnimatePresence>
                {showResetModal && (
                    <div className="fixed inset-0 z-[1200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#09090e] border border-red-500/50 p-6 rounded-2xl max-w-md w-full text-slate-100 font-mono text-center space-y-4 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                            <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl inline-block">
                                <RotateCcw size={32} className="text-red-400 mx-auto animate-spin-slow" />
                            </div>
                            <div>
                                <h3 className="font-cinzel text-xl font-bold uppercase tracking-widest text-slate-100">
                                    RESTART JOKER SESSION
                                </h3>
                                <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">
                                    SELECT RESTART PROTOCOL FOR REGISTERED PLAYERS:
                                </p>
                            </div>

                            <div className="space-y-3 pt-2">
                                <button
                                    onClick={() => handleResetGame(true)}
                                    className="w-full py-3 bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-500 text-emerald-200 font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg cursor-pointer"
                                >
                                    ✓ KEEP PLAYER POINTS & RESTART ROUND 1
                                </button>

                                <button
                                    onClick={() => handleResetGame(false)}
                                    className="w-full py-3 bg-red-950/80 hover:bg-red-900 border border-red-500 text-red-200 font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg cursor-pointer"
                                >
                                    ↺ RESET ALL POINTS TO 1000 & RESTART ROUND 1
                                </button>

                                <button
                                    onClick={() => setShowResetModal(false)}
                                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                                >
                                    CANCEL
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
