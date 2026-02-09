import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import type { DiamondsGameState, DiamondsPlayer, DiamondsCard, DiamondsPhase } from '../../game/diamonds';
import { getCardImagePath } from '../../game/diamonds';
import { generateDiamondsDeck } from '../../game/diamonds/actions/dealing';
import { dealHands } from '../../game/diamonds/actions/dealing';
import { assignGroups } from '../../game/diamonds/actions/shuffling';
import { evaluateRound } from '../../game/diamonds/actions/evaluation';
import { resolveSteals } from '../../game/diamonds/actions/picking';
import { updateScores } from '../../game/diamonds/actions/scoring';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Swords, Skull, Timer, CheckCircle2, AlertTriangle, X, Activity, Scan, Info, Shield, Syringe, Biohazard, User, ChevronRight } from 'lucide-react';


import { motion, AnimatePresence } from 'framer-motion';
import { PlayerCardModal } from '../PlayerCardModal';

const GAME_ID = 'diamonds_king';

export const DiamondsGame: React.FC<{ user: any; onClose?: () => void }> = ({ user, onClose }) => {
    const [gameState, setGameState] = useState<DiamondsGameState | null>(null);
    const [myHand, setMyHand] = useState<DiamondsCard[]>([]);
    const [mySlots, setMySlots] = useState<(DiamondsCard | null)[]>([null, null, null, null, null]);
    const [myPlayer, setMyPlayer] = useState<DiamondsPlayer | null>(null);
    const [showPlayerCard, setShowPlayerCard] = useState(false);
    const [isProhibited, setIsProhibited] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(0); // Client-side countdown
    const [showResetOverlay, setShowResetOverlay] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [hasPicked, setHasPicked] = useState(false);
    const [showRulesModal, setShowRulesModal] = useState(false);
    const [opponentSlots, setOpponentSlots] = useState<{ playerId: string, username: string, slots: DiamondsCard[] }[]>([]);
    const [playerIdMap, setPlayerIdMap] = useState<Record<string, string>>({});
    const [selectedSteal, setSelectedSteal] = useState<{ targetId: string, card: DiamondsCard } | null>(null);
    const [opponentHandCounts, setOpponentHandCounts] = useState<Record<string, number>>({});
    const [detectorActive, setDetectorActive] = useState(false);

    const [powerUsage, setPowerUsage] = useState({
        hasUsedRefresh: false,
        hasUsedDetector: false,
        hasUsedFiveSlots: false
    });
    const [protocolToasts, setProtocolToasts] = useState<{ id: string, message: string, type: 'info' | 'error' | 'success' }[]>([]);

    const addToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setProtocolToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setProtocolToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    // Drag and Drop refs
    const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
    const handScrollerRef = useRef<HTMLDivElement | null>(null);

    // Refs
    const gameStateRef = useRef<DiamondsGameState | null>(null);
    const isProcessingRef = useRef(false);
    const roundRef = useRef(0); // This is the local UI ref for slot reset
    const systemStartRef = useRef<boolean | null>(null);

    // Sync Ref for transition logic
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    // Wheel-to-Scroll Logic for Deployment Hand
    useEffect(() => {
        const scroller = handScrollerRef.current;
        if (!scroller) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                scroller.scrollLeft += e.deltaY;
            }
        };

        scroller.addEventListener('wheel', handleWheel, { passive: false });
        return () => scroller.removeEventListener('wheel', handleWheel);
    }, [gameState?.phase]);

    // Reset Detector Power UI between rounds
    useEffect(() => {
        if (gameState?.current_round) {
            setDetectorActive(false);
            setOpponentHandCounts({});
        }
    }, [gameState?.current_round]);

    const isMaster = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'master' || user?.username?.toLowerCase() === 'admin' || user?.username?.toLowerCase() === 'sanjay';
    const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.username?.toLowerCase() === 'admin' || user?.username?.toLowerCase() === 'sanjay';
    const isMasterRole = user?.role?.toLowerCase() === 'master';

    // Log roles once
    useEffect(() => {
        if (user) {
            console.log(`[DIAMONDS_ENGINE] User Context:`, {
                username: user.username,
                role: user.role,
                isAdmin,
                isMaster,
                isMasterRole
            });
        }
    }, [user, isAdmin, isMaster, isMasterRole]);

    // Debug tracking for assets
    useEffect(() => {
        const available = myHand.filter(c => !mySlots.some(s => s?.id === c.id));
        console.log(`[DIAMONDS_DEBUG] Phase: ${gameState?.phase}, Total: ${myHand.length}, Available: ${available.length}`);
    }, [gameState?.phase, myHand, mySlots]);

    // Fetch Player ID Mapping from Firebase (Consistent Anonymity)
    useEffect(() => {
        const fetchPlayerIds = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'users'));
                const usersList = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as any[];

                usersList.sort((a: any, b: any) => {
                    const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
                    const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';
                    if (isMasterA && !isMasterB) return -1;
                    if (!isMasterA && isMasterB) return 1;
                    const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
                    const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
                    return timeA - timeB;
                });

                const mapping: Record<string, string> = {};
                let pCount = 1;
                usersList.forEach((u: { id: string, username?: string }) => {
                    const pid = `#PLAYER_${pCount.toString().padStart(3, '0')}`;
                    if (u.id) mapping[u.id] = pid;
                    if (u.username) mapping[u.username] = pid;
                    pCount++;
                });
                setPlayerIdMap(mapping);
            } catch (error) {
                console.error('Error fetching player IDs (Firebase):', error);
            }
        };
        fetchPlayerIds();
    }, []);

    // Engine Tracking
    const phaseRef = useRef<DiamondsPhase>('idle');
    const phaseStartedAtRef = useRef<string | null>(null);
    const phaseDurationRef = useRef(0);

    // Sync Refs for logic consistency
    useEffect(() => {
        if (gameState) {
            phaseRef.current = gameState.phase;
            phaseStartedAtRef.current = gameState.phase_started_at || null;
            phaseDurationRef.current = gameState.phase_duration_sec || 0;
        }
    }, [gameState]);

    useEffect(() => {
        if (isMasterRole) {
            setIsProhibited(true);
        }
    }, [isMasterRole]);

    // Distributed Heartbeat Keeper: If paused, the engine needs to "slide" the start time forward
    // to preserve the remaining time. Only one client does this.
    useEffect(() => {
        if (!gameState?.is_paused || isProcessingRef.current) return;

        const keepAlivePause = async () => {
            // Election: only one browser updates to move the start time forward by 2s
            const now = new Date().toISOString();
            const nextStart = new Date(new Date(gameState.phase_started_at!).getTime() + 2000).toISOString();

            const { count } = await supabase.from('diamonds_game_state')
                .update({ phase_started_at: nextStart, updated_at: now }, { count: 'exact' })
                .eq('id', GAME_ID)
                .eq('is_paused', true)
                .eq('phase_started_at', gameState.phase_started_at);

            if (count && count > 0) {
                console.log("[DIAMONDS_ENGINE] Pause Keeper: Sliding start time forward to freeze timer.");
            }
        };

        const interval = setInterval(keepAlivePause, 2000);
        return () => clearInterval(interval);
    }, [gameState?.is_paused, gameState?.phase_started_at]);

    const PHASE_TIMINGS: Record<DiamondsPhase, number> = {
        idle: 0,
        briefing: 10,
        shuffle: 5,
        dealing: 5,
        slotting: 80,
        evaluation: 10,
        picking: 10,
        scoring: 30,
        end: 0
    };
    const MAX_ROUNDS = 5;





    const handlePhaseTimeout = async () => {
        if (isProcessingRef.current || !gameStateRef.current) {
            if (!gameStateRef.current) console.warn("[DIAMONDS_ENGINE] Timeout triggered but gameState is null");
            return;
        }

        isProcessingRef.current = true;
        const current = gameStateRef.current.phase;
        const round = gameStateRef.current.current_round || 1;

        console.log(`[DIAMONDS_ENGINE] Phase Timeout detected: ${current}. Round: ${round}. Admin: ${isAdmin}.`);

        try {
            console.log(`[DIAMONDS_ENGINE] Attempting distributed transition...`);

            console.log(`[DIAMONDS_ENGINE] ---------------------------------------`);
            console.log(`[DIAMONDS_ENGINE] STARTING TRANSITION FROM ${current.toUpperCase()}`);
            console.log(`[DIAMONDS_ENGINE] ---------------------------------------`);

            if (current === 'idle') await transitionTo('briefing');
            else if (current === 'briefing') await transitionTo('shuffle');
            else if (current === 'shuffle') {
                if (round === 1) await transitionTo('dealing');
                else await transitionTo('slotting');
            }
            else if (current === 'dealing') await transitionTo('slotting');
            else if (current === 'slotting') await transitionTo('evaluation');
            else if (current === 'evaluation') {
                console.log("[DIAMONDS_ENGINE] Evaluation complete. Moving to SCORING to show results.");
                await transitionTo('scoring');
            }
            else if (current === 'scoring') {
                console.log("[DIAMONDS_ENGINE] Results shown. Moving to PICKING for card extraction.");
                await transitionTo('picking');
            }
            else if (current === 'picking') {
                console.log(`[DIAMONDS_ENGINE] Picking window closed. Preparing Round ${round + 1}.`);
                if (round >= MAX_ROUNDS) await transitionTo('end');
                else await transitionTo('shuffle', round + 1);
            } else {
                console.log(`[DIAMONDS_ENGINE] No transition mapped for phase: ${current}`);
                isProcessingRef.current = false;
            }
        } catch (err) {
            console.error("[DIAMONDS_ENGINE] Transition Exception:", err);
            isProcessingRef.current = false;
        } finally {
            // Safety fallback - usually transitionTo handles this but we want to be sure
            setTimeout(() => { isProcessingRef.current = false; }, 500);
        }
    };

    const transitionTo = async (nextPhase: DiamondsPhase, nextRound: number = gameState?.current_round || 1) => {
        const currentState = gameStateRef.current;
        if (!currentState) {
            isProcessingRef.current = false;
            return;
        }

        // --- DISTRIBUTED ELECTION SYSTEM ---
        // Only one browser can "win" the transition master role by successfully updating the record 
        // with the specific current phase/round constraint.
        const now = new Date().toISOString();
        const { count, error: electionError } = await supabase.from('diamonds_game_state')
            .update({ updated_at: now }, { count: 'exact' })
            .eq('id', GAME_ID)
            .eq('phase', currentState.phase)
            .eq('current_round', currentState.current_round);

        if (electionError || count === 0) {
            console.log(`[DIAMONDS_ENGINE] Election Lost (Count: ${count}). Transition to ${nextPhase} handled by another browser.`);
            isProcessingRef.current = false;
            return;
        }

        console.log(`[DIAMONDS_ENGINE] Election WON. Executing transition to ${nextPhase} (Round ${nextRound})...`);

        console.log(`[DIAMONDS_ENGINE] Transitioning to ${nextPhase} (Round ${nextRound})`);

        try {
            // 1. Robust Participant Fetch
            let participants = gameStateRef.current?.participants || [];
            if (participants.length === 0 && nextPhase !== 'briefing') {
                console.warn("[DIAMONDS_ENGINE] Participants list seems empty. Fetching from DB...");
                const { data: recovered } = await supabase.from('diamonds_game_state').select('participants').eq('id', GAME_ID).maybeSingle();
                if (recovered?.participants && recovered.participants.length > 0) {
                    participants = recovered.participants;
                    console.log(`[DIAMONDS_ENGINE] Recovered ${participants.length} participants.`);
                } else {
                    console.error("[DIAMONDS_ENGINE] CRITICAL: No participants found in DB!");
                }
            }

            let updates: Partial<DiamondsGameState> = {
                phase: nextPhase,
                current_round: nextRound,
                updated_at: now,
                phase_started_at: now,
                phase_duration_sec: PHASE_TIMINGS[nextPhase] || 0
            };

            // ENGINE LOGIC
            if (nextPhase === 'briefing') {
                // ... (Keep existing user fetch logic, it's UI/DB binding, not core engine math)
                let candidateIds: string[] = [];
                const { data: statusData } = await supabase.from('diamonds_game_state').select('allowed_players').eq('id', GAME_ID).maybeSingle();
                if (statusData?.allowed_players && statusData.allowed_players.length > 0) {
                    candidateIds = statusData.allowed_players;
                }

                // DATABASE LOGGING
                console.log("[DIAMONDS_BRIEFING] Initializing participants...");
                console.log("[DIAMONDS_BRIEFING] Candidate IDs:", candidateIds);

                // 2. Fetch User Metadata from Firestore (Authoritative IDs/Emails/Roles)
                console.log("[DIAMONDS_BRIEFING] Fetching user metadata from Firestore...");
                const fsSnapshot = await getDocs(collection(db, 'users'));
                const fsUsers = fsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as any[];
                console.log(`[DIAMONDS_BRIEFING] Fetched ${fsUsers.length} users from Firestore.`);

                // 3. Fetch Scores from Supabase Profiles (Authoritative Visa Points)
                console.log("[DIAMONDS_BRIEFING] Fetching scores from Supabase profiles...");
                const { data: profiles, error: pError } = await supabase.from('profiles').select('email, visa_points, username');
                if (pError) console.error("[DIAMONDS_ENGINE] Profiles fetch error:", pError);

                const profileMap = new Map();
                profiles?.forEach(p => {
                    if (p.email) profileMap.set(p.email.toLowerCase(), p);
                });

                // 4. Construct Participants
                const initialParticipants: DiamondsPlayer[] = fsUsers
                    .filter(u => {
                        const isCandidate = candidateIds.length > 0 ? candidateIds.includes(u.id) : true;
                        const isMaster = u.role === 'master' || u.username === 'admin' || u.username?.toLowerCase().includes('architect');
                        const isAllowed = isCandidate && (!isMaster || u.username?.toLowerCase() === 'sanjay');
                        if (!isAllowed) console.log(`[DIAMONDS_BRIEFING] Filtered out: ${u.username} (CandidateMatch: ${isCandidate}, IsMaster: ${isMaster})`);
                        return isAllowed;
                    })
                    .map(u => {
                        const profile = profileMap.get(u.email?.toLowerCase());
                        const finalScore = profile?.visa_points !== undefined ? profile.visa_points : 1000;
                        return {
                            id: u.id,
                            username: profile?.username || u.username || 'Agent',
                            role: (u.role as any) || 'player',
                            score: finalScore,
                            status: 'active',
                            cards: [],
                            slots: [null, null, null, null, null],
                            hasUsedFiveSlots: false,
                            hasUsedRefresh: false,
                            hasUsedDetector: false
                        };
                    });

                console.log(`[DIAMONDS_BRIEFING] Final Initial Participants Count: ${initialParticipants.length}`);

                // USER REQUEST: Reset local powers state for immediate UI feedback
                setPowerUsage({
                    hasUsedRefresh: false,
                    hasUsedDetector: false,
                    hasUsedFiveSlots: false
                });

                // ENGINE RESET
                roundRef.current = 0;

                // 5. CLEAR STALE DATA (Fresh Session Protocol)
                console.log("[DIAMONDS_BRIEFING] Clearing stale hands and slots from DB...");
                await supabase.from('diamonds_hands').delete().eq('game_id', GAME_ID);
                await supabase.from('diamonds_slots').delete().eq('game_id', GAME_ID);
                console.log("[DIAMONDS_BRIEFING] DB State Purged.");

                // 6. SYNC PARTICIPANTS TO DB (For authoritative round handling)
                const participantsToSync = initialParticipants.map(p => ({
                    id: p.id,
                    game_id: GAME_ID,
                    username: p.username,
                    score: p.score,
                    status: p.status,
                    groupId: p.groupId || null,
                    // USER REQUEST: Reset power flags in DB for new game session
                    hasUsedRefresh: false,
                    hasUsedDetector: false,
                    hasUsedFiveSlots: false
                }));
                const { error: syncError } = await supabase.from('diamonds_participants').upsert(participantsToSync);
                if (syncError) console.error("[DIAMONDS_ENGINE] Participants Sync Failed:", syncError);

                updates.participants = initialParticipants;
                updates.round_data = {}; // Reset data
            }

            if (nextPhase === 'slotting') {
                console.log(`[DIAMONDS_ENGINE] Round ${nextRound} slotting start. Purging all previous slots...`);
                const { error: resetError } = await supabase.from('diamonds_slots').delete().eq('game_id', GAME_ID);
                if (resetError) console.error("[DIAMONDS_ENGINE] Slot reset failed:", resetError);
            }

            if (nextPhase === 'shuffle' || nextPhase === 'end') {
                // MODULAR: Clean up cards from previous round (Spending Protocol)
                const lastRound = (gameState?.current_round || nextRound) - 1;
                if (lastRound >= 1) {
                    console.log(`[DIAMONDS_ENGINE] Cleaning up cards from Round ${lastRound}...`);

                    const { data: lastSlots } = await supabase.from('diamonds_slots').select('*').eq('game_id', GAME_ID).eq('round', lastRound);
                    const { data: allParticipants } = await supabase.from('diamonds_participants').select('*').eq('game_id', GAME_ID);

                    if (lastSlots && allParticipants) {
                        for (const p of allParticipants) {
                            const pSlotRecord = lastSlots.find(s => s.player_id === p.id);
                            if (!pSlotRecord?.slots) continue;

                            const { data: handData } = await supabase.from('diamonds_hands').select('cards').eq('game_id', GAME_ID).eq('player_id', p.id).maybeSingle();
                            if (!handData) continue;

                            let updatedHand = handData.cards as DiamondsCard[];
                            let cardsToRemove: string[] = [];

                            (pSlotRecord.slots as DiamondsCard[]).forEach(s => {
                                if (!s) return;
                                const hIndex = updatedHand.findIndex(c => c.id === s.id);
                                if (hIndex === -1) return; // Already moved/stolen

                                if (s.type === 'standard') {
                                    cardsToRemove.push(s.id);
                                } else {
                                    // Special card usage
                                    let cardInHand = updatedHand[hIndex];
                                    if (!cardInHand.metadata) cardInHand.metadata = { usesRemaining: 1 };
                                    cardInHand.metadata.usesRemaining -= 1;
                                    if (cardInHand.metadata.usesRemaining <= 0) {
                                        cardsToRemove.push(s.id);
                                    }
                                }
                            });

                            const cleanedHand = updatedHand.filter(c => !cardsToRemove.includes(c.id));

                            // Check for elimination
                            if (cleanedHand.length === 0 && p.status !== 'eliminated') {
                                console.log(`[DIAMONDS_ENGINE] !!! ELIMINATED: ${p.username} out of assets. !!!`);
                                await supabase.from('diamonds_participants').update({ status: 'eliminated' }).eq('id', p.id);
                            }

                            await supabase.from('diamonds_hands').update({ cards: cleanedHand }).eq('game_id', GAME_ID).eq('player_id', p.id);
                        }
                    }
                }
            }

            if (nextPhase === 'shuffle') {
                // MODULAR: Assign Groups (1v1 / 1v1v1)
                // Use robust participants variable defined at top
                const grouped = assignGroups(participants);
                updates.participants = grouped;
                console.log(`[DIAMONDS_ENGINE] Assigned groups for ${grouped.length} players.`);
            }

            if (nextPhase === 'dealing') {
                const currentState = gameStateRef.current;
                // Use robust participants variable defined at top

                // CRITICAL: Check session deck from STATE first to avoid regeneration
                let sessionDeck: DiamondsCard[] = currentState?.round_data?.session_deck || [];

                console.log(`[DIAMONDS_ENGINE] Dealing Phase. Round: ${nextRound}. Current Deck Size: ${sessionDeck.length}`);

                // ONLY GENERATE IF EMPTY.
                if (sessionDeck.length === 0) {
                    console.log("[DIAMONDS_ENGINE] Generating NEW SESSION DECK (1Z, 2I, 2S)");
                    sessionDeck = generateDiamondsDeck(participants.length);
                    // sessionDeck = shuffleDeck(sessionDeck); // REMOVED: generateDiamondsDeck already calls weightedShuffle
                }

                // MODULAR: Deal Hands
                const { updatedParticipants, remainingDeck, handsPayload } = dealHands(sessionDeck, participants);

                // 2. DB Sync for Hands (Fresh Hand Overwrite)
                console.log("[DIAMONDS_ENGINE] Syncing 7-card hands to Supabase...");
                const handsWithGameId = handsPayload.map(h => ({ ...h, game_id: GAME_ID }));
                const { error: handError } = await supabase.from('diamonds_hands').upsert(handsWithGameId, { onConflict: 'game_id,player_id' });

                if (handError) {
                    console.error("[DIAMONDS_ENGINE] CRITICAL: Hand Sync Failed:", handError);
                    alert("DATABASE LINK FAILURE: Hands could not be uploaded.");
                } else {
                    console.log(`[DIAMONDS_SYNC] Successfully uploaded hands for ${handsWithGameId.length} players.`);
                }

                updates.participants = updatedParticipants;
                updates.round_data = {
                    ...(currentState?.round_data || {}),
                    session_deck: remainingDeck
                };
            }



            if (nextPhase === 'evaluation') {
                // MODULAR: Evaluate
                // 1. Fetch all slots from DB to be authoritative
                const { data: allSlots } = await supabase.from('diamonds_slots').select('*').eq('game_id', GAME_ID).eq('round', nextRound);
                const slotsMap = new Map<string, any[]>();
                allSlots?.forEach((s: any) => slotsMap.set(s.player_id, s.slots));

                // USER REQUEST: Auto-pick logic
                // If a player hasn't slotted or locked, we force it.
                for (const p of participants) {
                    if (p.status !== 'active') continue;
                    let pSlots = slotsMap.get(p.id) || [null, null, null, null, null];

                    // USER REQUEST: Auto-pick logic
                    // If not authorized OR 0 cards slotted, we force 1 card.
                    // REFINED: Only force 1 card if they HAHA haven't slotted ANYTHING OR they are NOT authorized for 5 slots.
                    // But if they HAVE slotted cards, we should respect them up to their auth limit.
                    // const isAuthorized = p.hasUsedFiveSlots || (slotsMap.get(p.id)?.length || 0) > 1; // If they have > 1, they likely intended to use power

                    // Actually, the real logic should be: 
                    // 1. If slots are empty -> pick 1 random.
                    // 2. If slots have >1 but p.hasUsedFiveSlots is false (from PREVIOUS rounds) -> this is their 5-slot turn!
                    // 3. If p.hasUsedFiveSlots is TRUE (already used power in past round) -> force 1 card.

                    const alreadyUsedPower = p.hasUsedFiveSlots;
                    const cardsCount = pSlots.filter(s => s !== null).length;

                    if (cardsCount === 0) {
                        console.log(`[DIAMONDS_ENGINE] AUTO-PICK: ${p.username} (Empty slots). Enforcing 1-card.`);
                        const { data: handData } = await supabase.from('diamonds_hands').select('cards').eq('game_id', GAME_ID).eq('player_id', p.id).single();
                        if (handData?.cards && handData.cards.length > 0) {
                            const hand = handData.cards as DiamondsCard[];
                            const finalCard = hand[Math.floor(Math.random() * hand.length)];
                            const newSlots = [finalCard, null, null, null, null];
                            slotsMap.set(p.id, newSlots);
                            await supabase.from('diamonds_slots').upsert({
                                game_id: GAME_ID, player_id: p.id, round: nextRound, slots: newSlots, updated_at: now
                            });
                        }
                    } else if (cardsCount > 1 && alreadyUsedPower) {
                        console.log(`[DIAMONDS_ENGINE] AUTO-PICK: ${p.username} (Power Depleted, tried >1). Forcing 1-card.`);
                        const firstCard = pSlots.find(s => s !== null);
                        const newSlots = [firstCard, null, null, null, null];
                        slotsMap.set(p.id, newSlots);
                        await supabase.from('diamonds_slots').upsert({
                            game_id: GAME_ID, player_id: p.id, round: nextRound, slots: newSlots, updated_at: now
                        });
                    }
                }


                const { results, updatedParticipants } = evaluateRound(participants, slotsMap);

                // Aggregate ALL winners and losers for the UI overlay
                const allWinners = results.reduce((acc: string[], r) => [...acc, ...r.winners], []);
                const allLosers = results.reduce((acc: string[], r) => [...acc, ...r.losers], []);
                const allEliminated = results.reduce((acc: string[], r) => [...acc, ...r.eliminatedIds], []);
                const allEffects = results.reduce((acc: any[], r) => [...acc, ...(r.effects || [])], []);

                // --- SPECIAL CARD HAND MANAGEMENT ---
                console.log("[DIAMONDS_ENGINE] Processing card usage and infection spread...");

                for (const p of updatedParticipants) {

                    const { data: currentHandData } = await supabase.from('diamonds_hands').select('cards').eq('game_id', GAME_ID).eq('player_id', p.id).maybeSingle();

                    if (currentHandData) {
                        let hand = currentHandData.cards as DiamondsCard[];
                        let updatedHand = [...hand];


                        // 1. Process Transformations (Cures or Shotgun Shatters) only in this phase
                        // NOTE: Cards are fully "spent" (removed) at the end of the Picking phase to allow for stealing.
                        results.forEach(res => {
                            res.effects?.forEach((ef: any) => {
                                if (ef.type === 'cured' && ef.playerId === p.id) {
                                    // EXTRACT: New rank value and optional slot index from description
                                    const newValMatch = ef.desc?.match(/TO (\d+)/);
                                    const newVal = newValMatch ? parseInt(newValMatch[1]) : (Math.floor(Math.random() * 8) + 2);

                                    const hIdx = updatedHand.findIndex(c => c.id === ef.originalCardId);
                                    if (hIdx !== -1) {
                                        // Create replacement card
                                        const ts = Date.now().toString().slice(-4);
                                        const replacement: DiamondsCard = {
                                            id: `trans_${ts}_${p.id.slice(0, 3)}_${hIdx}`,
                                            type: 'standard',
                                            rank: newVal.toString(),
                                            suit: 'hearts', // Standard theme
                                            value: newVal,
                                            isRevealed: true
                                        };

                                        // Permanently replace the Zombie with the new card in the hand
                                        updatedHand[hIdx] = replacement;

                                        // If it's in a slot, update that too (even if not explicitly mentioned by slotIndex)
                                        p.slots.forEach((s, sIdx) => {
                                            if (s?.id === ef.originalCardId) {
                                                p.slots[sIdx] = replacement;
                                            }
                                        });

                                        console.log(`[DIAMONDS_ENGINE] NEUTRALIZED ASSET: ${p.username} zombie replaced with ${newVal}.`);
                                    }
                                }
                            });
                        });



                        // 2. Process Infection (Zombie Spread)
                        const wasInfected = results.some(r => r.effects?.some(e => e.playerId === p.id && e.type === 'infected'));
                        if (wasInfected) {
                            const hasZombie = updatedHand.some(c => c.specialType === 'zombie');
                            if (!hasZombie) {
                                console.log(`[DIAMONDS_ENGINE] !!! SPREAD: ${p.username} infected. Awarding 1-Use Zombie !!!`);
                                updatedHand.push({
                                    id: `spread_zom_${Date.now()}_${p.id.slice(0, 4)}`,
                                    type: 'special',
                                    specialType: 'zombie',
                                    suit: 'special',
                                    value: 0,
                                    metadata: { usesRemaining: 1 } // USER REQUEST: No 2-time use
                                });
                            } else {
                                console.log(`[DIAMONDS_ENGINE] ${p.username} already infected. Skipping duplicate spread.`);
                            }
                        }

                        // 3. Update DB
                        await supabase.from('diamonds_hands').update({ cards: updatedHand }).eq('game_id', GAME_ID).eq('player_id', p.id);

                    }
                }

                updates.participants = updatedParticipants;
                updates.round_data = {
                    ...(gameStateRef.current?.round_data || {}),
                    results: results,
                    winners: allWinners,
                    losers: allLosers,
                    effects: allEffects,
                    eliminated: [...allEliminated, ...updatedParticipants.filter(p => p.status === 'eliminated').map(p => p.id)]
                };
            }

            if (nextPhase === 'picking') {
                // MODULAR: Resolve Steals (Prepare Data)
                const battleResults = gameStateRef.current?.round_data?.results || [];
                const { pendingSteals } = resolveSteals(participants, battleResults);

                updates.round_data = {
                    ...(gameStateRef.current?.round_data || {}),
                    winners: battleResults.reduce((acc: string[], r: any) => [...acc, ...r.winners], []),
                    losers: battleResults.reduce((acc: string[], r: any) => [...acc, ...r.losers], []),
                    effects: battleResults.reduce((acc: any[], r: any) => [...acc, ...(r.effects || [])], []),
                    pending_steals: pendingSteals
                };
            }

            if (nextPhase === 'scoring') {
                // MODULAR: Apply Scores
                const battleResults = gameStateRef.current?.round_data?.results || [];
                const isFinalRound = (gameStateRef.current?.current_round || 0) === 5;
                const { updatedParticipants } = updateScores(participants, battleResults, isFinalRound);

                // --- POST-COMBAT RESOURCE AUDIT ---
                // If any player has 0 cards, they are eliminated
                const finalParticipants: DiamondsPlayer[] = [];
                for (const p of updatedParticipants) {
                    if (p.status !== 'active') {
                        finalParticipants.push(p);
                        continue;
                    }

                    const { data: handData } = await supabase.from('diamonds_hands').select('cards').eq('game_id', GAME_ID).eq('player_id', p.id).maybeSingle();
                    const handSize = (handData?.cards as any[])?.length || 0;

                    if (handSize === 0) {
                        console.log(`[DIAMONDS_ENGINE] !!! RESOURCE DEPLETION: ${p.username} eliminated. !!!`);
                        finalParticipants.push({ ...p, status: 'eliminated' as 'active' | 'eliminated' | 'survived' });
                    } else {
                        finalParticipants.push(p);
                    }
                }

                updates.participants = finalParticipants;

                // CRITICAL: Synchronize scores with persistent diamonds_participants table
                // This prevents fetchMyParticipantStatus from overwriting scores with stale data
                for (const p of finalParticipants) {
                    await supabase.from('diamonds_participants')
                        .update({
                            score: p.score,
                            status: p.status,
                            roundAdjustment: p.roundAdjustment
                        })
                        .eq('id', p.id);
                }
            }

            if (nextPhase === 'idle' || nextPhase === 'briefing') {
                // Reset logic for new game
                setMyHand([]);
                setMySlots([null, null, null, null, null]);
                setIsLocked(false);
                setHasPicked(false);
            }

            // SAFETY CHECK: Never write empty participants if we had them before
            if (updates.participants && updates.participants.length === 0 && participants.length > 0) {
                console.error("[DIAMONDS_ENGINE] SAFETY: Prevented writing empty participants list!");
                delete updates.participants;
            }

            // 6. FINAL STATE PERSISTENCE
            console.log("[DIAMONDS_ENGINE] Persisting state updates:", Object.keys(updates));
            const { error: finalError } = await supabase.from('diamonds_game_state').update(updates).eq('id', GAME_ID);

            if (finalError) {
                console.error("[DIAMONDS_ENGINE] CRITICAL: Final State update failed:", finalError);
                // If it's a 409, it might be a race condition or constraint. 
                // We'll try to alert the user if it's severe.
                if (finalError.code === '409') {
                    console.warn("[DIAMONDS_ENGINE] Conflict (409) detected. Possibly a constraint violation.");
                }
            } else {
                console.log("[DIAMONDS_ENGINE] State successfully persisted.");
            }
        } catch (err) {
            console.error("[DIAMONDS_ENGINE] FATAL Engine Error:", err);
            isProcessingRef.current = false;
        } finally {
            isProcessingRef.current = false;
        }
    };

    // Timer Sync Effect
    useEffect(() => {
        const syncTimer = () => {
            if (!gameState?.phase_started_at) return;

            // PAUSE LOGIC: Freeze UI timer if game is paused
            if (gameState.is_paused) {
                if (gameState.phase_duration_sec !== undefined) setTimeLeft(gameState.phase_duration_sec);
                return;
            }

            const start = new Date(gameState.phase_started_at).getTime();
            const duration = gameState.phase_duration_sec || 0;
            const now = Date.now();
            const elapsed = Math.floor((now - start) / 1000);
            const remaining = Math.max(0, duration - elapsed);
            setTimeLeft(remaining);

            // AUTHORITY TRIGGER
            if (remaining <= 0) {
                if (isProcessingRef.current) {
                    console.log(`[DIAMONDS_ENGINE] Heartbeat: Timer at ${remaining}s. Engine BUSY.`);
                } else {
                    console.log(`[DIAMONDS_ENGINE] Heartbeat: Timer at ${remaining}s. Engine IDLE. Triggering transition...`);
                    handlePhaseTimeout();
                }
            }
        };

        syncTimer(); // Immediate sync
        const interval = setInterval(syncTimer, 1000);
        return () => clearInterval(interval);
    }, [gameState?.phase_started_at, gameState?.phase_duration_sec, gameState?.phase, gameState?.is_paused, user, gameState?.current_round, isMaster]);

    // Supabase Realtime Sync (Centralized Source of Truth)
    useEffect(() => {
        if (!user) return;

        const handleUpdate = (data: any) => {
            console.log("[DIAMONDS_PLAYER] Game State Received:", data);
            if (gameState?.phase !== data.phase) {
                if (['evaluation', 'picking', 'scoring'].includes(data.phase)) {
                    fetchMySlots(data);
                }
            }
            setGameState(data);
            setIsLoading(false);

            if (data.system_start === false && systemStartRef.current === true) {
                setShowResetOverlay(true);
                setTimeout(() => {
                    if (onClose) onClose();
                }, 2500);
            }
            systemStartRef.current = data.system_start;

            const participants = data.participants || [];
            let me = participants.find((p: any) => p.id === user.id);
            if (!me && user.username) {
                me = participants.find((p: any) => p.username === user.username);
            }
            if (!me && user.username) {
                me = participants.find((p: any) => p.username?.toLowerCase() === user.username.toLowerCase());
            }

            // PRIORITY: Prioritize the dedicated participant status over the game state snapshot to prevent "flexing"
            setMyPlayer(prev => {
                const p = me;
                if (!prev) return p;

                // --- SCORING FIX ---
                // During 'scoring' or 'picking', the Game State snapshot (calculated by transitionTo logic)
                // is the AUTHORITATIVE source for points and adjustments.
                // We MUST update scores from the snapshot during these phases.
                if (data.phase === 'scoring' || data.phase === 'picking') {
                    console.log(`[DIAMONDS_PLAYER] Scoring Phase Update: Taking authoritative score ${p.score} (Adj: ${p.roundAdjustment})`);
                    return {
                        ...p, // Take everything from the snapshot
                        isZombie: prev.isZombie ?? p.isZombie // Preserve zombie state if ambiguous, but generally snapshot is king here too
                    };
                }

                // For other phases (hunting, slotting), avoid "flexing" by keeping local detailed state
                // until the next major transition.
                return {
                    ...p,
                    score: prev.score, // Keep displayed score stable
                    roundAdjustment: prev.roundAdjustment, // Keep displayed adjustment stable
                    status: prev.status,
                    isZombie: prev.isZombie ?? p.isZombie,
                    groupId: p.groupId // Snapshots are good for group assignments
                };
            });

            // CRITICAL: Refresh Hand and Slots on every state change
            fetchMyHand();

            // Interaction Fix: Don't fetch slots if we are actively drafting in slotting phase
            const isActivelySlotting = data.phase === 'slotting' && !isLocked;
            if (!isActivelySlotting) {
                fetchMySlots(data);
            }

            // 2s POLLING FALLBACK Sync often happens faster than state updates can reflect in fetchOpponentSlots
            if (data.phase === 'picking') {
                fetchOpponentSlots(data, me);
            }

            if (data.current_round !== roundRef.current || data.phase === 'shuffle') {
                // Reset slots locally
                setMySlots([null, null, null, null, null]);
                setIsLocked(false);
                setHasPicked(false);
                setOpponentSlots([]); // Clear opponent slots on new round
                roundRef.current = data.current_round;
            }

            // CRITICAL: Explicit UI Reset on Idle/Briefing/Reset
            if (data.phase === 'idle' || data.phase === 'briefing' || data.system_start === false) {
                setMySlots([null, null, null, null, null]);
                setIsLocked(false);
                setHasPicked(false);
                setOpponentSlots([]);
                setMyHand([]);
            }

            // Auto-clear slots if we are back in slotting and they are locked from previous round (rare sync edge case)
            if (data.phase === 'slotting' && isLocked && data.current_round !== roundRef.current) {
                console.log("[DIAMONDS_SYNC] Unlocking slots for new round.");
                setIsLocked(false);
                setMySlots([null, null, null, null, null]);
            }
        };

        const fetchInitial = async () => {
            const { data } = await supabase.from('diamonds_game_state').select('*').eq('id', GAME_ID).maybeSingle();
            if (data) handleUpdate(data);
            else setIsLoading(false);
        };

        fetchInitial();
        fetchMyParticipantStatus();

        // 2s POLLING FALLBACK (Resilient Sync)
        const pollInterval = setInterval(() => {
            if (!document.hidden) {
                fetchInitial();
                fetchMyParticipantStatus();
            }
        }, 2000);

        const channel = supabase
            .channel(`diamonds_state_sync_${GAME_ID}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'diamonds_game_state',
                filter: `id=eq.${GAME_ID}`
            }, (payload) => {
                handleUpdate(payload.new);
            })
            .subscribe();

        fetchMyHand();
        fetchMySlots();

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollInterval);
        };
    }, [user, onClose]);

    // Auto-Start Feature: Trigger briefing if game is idle but active (Admin only)
    useEffect(() => {
        if (gameState?.phase === 'idle' && gameState?.system_start === true && !isProcessingRef.current) {
            console.log("[DIAMONDS_ENGINE] Detecting system start. Triggering briefing...");
            isProcessingRef.current = true;
            transitionTo('briefing').catch(err => {
                console.error("[DIAMONDS_ENGINE] Initial start failed:", err);
                isProcessingRef.current = false;
            });
        } else if (gameState?.phase === 'idle') {
            console.log("[DIAMONDS_ENGINE] Idle, waiting for SystemStart signal...", { systemStart: gameState?.system_start });
        }
    }, [gameState?.phase, gameState?.system_start]);

    // Distributed Ready Check (Skip timers if everyone has slotted)
    useEffect(() => {
        if (!gameState || gameState.phase !== 'slotting' || isProcessingRef.current) return;

        const checkAllReady = async () => {
            const activeParticipants = (gameState.participants || []).filter(p => p.status === 'active');
            const activeCount = activeParticipants.length;
            if (activeCount === 0) return;

            const { data: slots, error } = await supabase
                .from('diamonds_slots')
                .select('player_id')
                .eq('game_id', GAME_ID)
                .eq('round', gameState.current_round);

            if (!error && slots) {
                // Ensure all active participants have a slot record
                const slottedIds = new Set(slots.map(s => s.player_id));
                const allReady = activeParticipants.every(p => slottedIds.has(p.id));

                if (allReady) {
                    console.log(`[DIAMONDS_ENGINE] All ${activeCount} active players ready. Transitioning...`);
                    // We don't set isProcessingRef here because transitionTo handles the election
                    transitionTo('evaluation').catch(err => {
                        console.error("[DIAMONDS_ENGINE] Ready-check transition failed:", err);
                    });
                }
            }
        };

        const interval = setInterval(checkAllReady, 3000); // Check every 3s
        return () => clearInterval(interval);
    }, [gameState?.phase, gameState?.current_round, gameState?.participants]);

    // Safety watchdog for isProcessingRef
    useEffect(() => {
        const watchdog = setInterval(() => {
            if (isProcessingRef.current) {
                console.log("[DIAMONDS_ENGINE] Watchdog: Engine busy... checking status.");
            }
        }, 5000);
        return () => clearInterval(watchdog);
    }, []);

    // SAFETY BRIDGE: Prevent "Ghost Cards" in slots
    useEffect(() => {
        if (!myHand || myHand.length === 0) return;
        if (gameState?.phase !== 'slotting') return;

        const staleIndices = mySlots.map((s, i) => {
            if (!s) return -1;
            const existsInHand = myHand.some(h => h.id === s.id);
            return existsInHand ? -1 : i;
        }).filter(idx => idx !== -1);

        if (staleIndices.length > 0) {
            console.warn(`[DIAMONDS_SAFETY] Detected ${staleIndices.length} STALE cards in slots! Clearing...`);
            const nextSlots = [...mySlots];
            staleIndices.forEach(idx => nextSlots[idx] = null);
            setMySlots(nextSlots);
        }
    }, [myHand, gameState?.phase]);

    const fetchMyParticipantStatus = async () => {
        if (!user?.id) return;
        const { data, error } = await supabase
            .from('diamonds_participants')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (!error && data) {
            console.log("[DIAMONDS_SYNC] Participant status updated:", data);
            setMyPlayer(data);
            setPowerUsage({
                hasUsedRefresh: data.hasUsedRefresh || false,
                hasUsedDetector: data.hasUsedDetector || false,
                hasUsedFiveSlots: data.hasUsedFiveSlots || false
            });
        }
    };

    const fetchMyHand = async () => {
        const { data } = await supabase.from('diamonds_hands').select('cards').eq('game_id', GAME_ID).eq('player_id', user.id).maybeSingle();
        if (data) setMyHand(data.cards || []);
    };

    const fetchMySlots = async (passedState?: DiamondsGameState) => {
        const round = passedState?.current_round || gameState?.current_round || 1;
        const { data } = await supabase.from('diamonds_slots').select('slots').eq('game_id', GAME_ID).eq('player_id', user.id).eq('round', round).maybeSingle();
        if (data) {
            const newSlots = data.slots || [null, null, null, null, null];
            // Only update if different to prevent animation triggers
            setMySlots(prev => JSON.stringify(prev) === JSON.stringify(newSlots) ? prev : newSlots);
        } else {
            setMySlots(prev => prev.every(s => s === null) ? prev : [null, null, null, null, null]);
        }
    };

    const fetchOpponentSlots = async (passedState?: DiamondsGameState, passedMe?: DiamondsPlayer) => {
        const state = passedState || gameState;
        const me = passedMe || myPlayer;

        if (!state || !me?.groupId) {
            console.log("[DIAMONDS_PICKING] Skipping fetch: State/Me missing or no groupId", { state: !!state, me: !!me });
            return;
        }

        // 1. Get all group members except me
        const groupOccupants = (state.participants || []).filter(p =>
            p.groupId === me.groupId &&
            p.id !== user?.id &&
            p.status !== 'eliminated'
        );

        const others = groupOccupants.map(p => {
            return {
                playerId: p.id,
                username: p.username || 'Opponent',
                slots: (p.slots as DiamondsCard[] || []).filter(c => c !== null)
            };
        });

        console.log("[DIAMONDS_PICKING] Using persisted slots for opponents:", others.length, others);
        setOpponentSlots(others);
    };

    const handleStealCard = async (targetId: string, card: DiamondsCard) => {
        if (!user || !gameState || hasPicked) return;
        setSelectedSteal({ targetId, card });
        setIsLoading(true);

        try {
            const { data: oppHand } = await supabase.from('diamonds_hands').select('*').eq('game_id', GAME_ID).eq('player_id', targetId).maybeSingle();
            if (oppHand) {
                const newCards = (oppHand.cards as DiamondsCard[]).filter(c => c.id !== card.id);
                await supabase.from('diamonds_hands').update({ cards: newCards }).eq('id', oppHand.id);
            }

            const { data: myHandData } = await supabase.from('diamonds_hands').select('*').eq('game_id', GAME_ID).eq('player_id', user.id).maybeSingle();
            if (myHandData) {
                const hasAlready = (myHandData.cards as DiamondsCard[]).some(c => c.id === card.id);
                if (!hasAlready) {
                    const newCards = [...(myHandData.cards as DiamondsCard[]), card];
                    await supabase.from('diamonds_hands').update({ cards: newCards }).eq('id', myHandData.id);
                    setMyHand(newCards);
                }
            }

            setHasPicked(true);
            setSelectedSteal(null);
            setOpponentSlots([]);
            console.log(`[DIAMONDS_UI] Extraction Complete: ${card.id} transferred.`);
        } catch (err) {
            console.error("Extraction failed:", err);
        } finally {
            setIsLoading(false);
        }
    };


    // --- Interactions ---
    const handleSlotCard = (card: DiamondsCard, slotIndex: number) => {
        if (gameState?.phase !== 'slotting' || isLocked) return;

        // Check Zombie Limit (Max 2 uses per game)
        if (card.specialType === 'zombie') {
            const uses = myPlayer?.zombieUses || 0;
            if (uses >= 2) {
                alert("CRITICAL: ZOMBIE PROTOCOL LIMIT REACHED (MAX 2 USES PER COMPONENT)");
                return;
            }
        }

        const newSlots = [...mySlots];
        // Remove from existing if present
        const existingSlotIdx = newSlots.findIndex(s => s?.id === card.id);
        if (existingSlotIdx !== -1) newSlots[existingSlotIdx] = null;

        newSlots[slotIndex] = card;
        setMySlots(newSlots);

        // USER REQUEST: Persistent slots for better admin visibility/auto-pick
        if (user?.id && gameState?.current_round) {
            supabase.from('diamonds_slots').upsert({
                game_id: GAME_ID,
                player_id: user.id,
                round: gameState.current_round,
                slots: newSlots,
                updated_at: new Date().toISOString()
            }, { onConflict: 'game_id,player_id,round' }).then(({ error }) => {
                if (error) console.error("[DIAMONDS_PLAYER] Immediate slot sync failed:", error);
            });
        }
    };

    const handleUnslotCard = (index: number) => {
        if (gameState?.phase !== 'slotting' || isLocked) return;
        const newSlots = [...mySlots];
        newSlots[index] = null;
        setMySlots(newSlots);

        // USER REQUEST: Persistent slots for better admin visibility/auto-pick
        if (user?.id && gameState?.current_round) {
            supabase.from('diamonds_slots').upsert({
                game_id: GAME_ID,
                player_id: user.id,
                round: gameState.current_round,
                slots: newSlots,
                updated_at: new Date().toISOString()
            }, { onConflict: 'game_id,player_id,round' }).then(({ error }) => {
                if (error) console.error("[DIAMONDS_PLAYER] Immediate unslot sync failed:", error);
            });
        }
    };

    const handleDragEnd = (_: any, info: any, card: DiamondsCard) => {
        if (gameState?.phase !== 'slotting' || isLocked) return;

        // Find which slot the card was dropped on
        const dropPoint = info.point;
        let targetSlotIndex = -1;

        slotRefs.current.forEach((ref, idx) => {
            if (!ref) return;
            const rect = ref.getBoundingClientRect();
            if (
                dropPoint.x >= rect.left &&
                dropPoint.x <= rect.right &&
                dropPoint.y >= rect.top &&
                dropPoint.y <= rect.bottom
            ) {
                targetSlotIndex = idx;
            }
        });

        if (targetSlotIndex !== -1) {
            handleSlotCard(card, targetSlotIndex);
        }
    };

    const handleConfirmSlots = async () => {
        if (!user?.id || !gameState || isLocked) return;

        const slottedCount = mySlots.filter(s => s !== null).length;
        if (slottedCount === 0) {
            alert("MUST DEPLOY AT LEAST 1 ASSET FOR BATTLE");
            return;
        }

        if (slottedCount === 5) {
            if (powerUsage.hasUsedFiveSlots) {
                alert("CRITICAL: FULL ARRAY ALREADY DEPLOYED ONCE. YOU ALREADY USED 5 SLOTTED. REDUCE DEPLOYMENT ARRAY.");
                return;
            }
        }

        console.log("[DIAMONDS_PLAYER] Confirming Slots:", mySlots);
        const { error } = await supabase.from('diamonds_slots').upsert({
            game_id: GAME_ID,
            player_id: user.id,
            round: gameState.current_round,
            slots: mySlots,
            updated_at: new Date().toISOString()
        }, { onConflict: 'game_id,player_id,round' });

        if (error) {
            console.error("[DIAMONDS_PLAYER] Slot Error:", error);
            alert("FAILED TO SUBMIT SLOTS. TRY AGAIN.");
        } else {
            console.log("[DIAMONDS_PLAYER] Slots Submitted Successfully.");
            if (slottedCount === 5) {
                await supabase.from('diamonds_participants')
                    .update({ hasUsedFiveSlots: true })
                    .eq('id', user.id);

                // USER REQUEST: Persistent lock for power limits
                setTimeout(fetchMyParticipantStatus, 500);
            }
            setIsLocked(true);
        }
    };

    const handleRefreshHand = async () => {
        if (!user || gameState?.phase !== 'slotting' || isLocked) return;
        if (powerUsage.hasUsedRefresh) {
            addToast("PROTOCOL ERROR: REFRESH CAPABILITIES DEPLETED", "error");
            return;
        }

        const standardCards = myHand.filter(c => c.type === 'standard');
        const specialCards = myHand.filter(c => c.type === 'special');

        if (standardCards.length === 0) {
            addToast("PROTOCOL ERROR: AT LEAST ONE NORMAL CARD REQUIRED FOR REFRESH", "error");
            return;
        }

        setIsLoading(true);
        // setHasUsedRefreshSession(true);
        try {
            const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
            const newStandardHand: DiamondsCard[] = [];
            for (let i = 0; i < standardCards.length; i++) {
                const val = Math.floor(Math.random() * 13) + 2;
                const suit = suits[Math.floor(Math.random() * 4)];
                newStandardHand.push({
                    id: `ref_${Date.now()}_${i}`, type: 'standard',
                    rank: val === 11 ? 'J' : val === 12 ? 'Q' : val === 13 ? 'K' : val === 14 ? 'A' : val.toString(),
                    suit, value: val
                });
            }

            const newHand = [...specialCards, ...newStandardHand];

            await supabase.from('diamonds_hands').update({ cards: newHand }).eq('game_id', GAME_ID).eq('player_id', user.id);
            await supabase.from('diamonds_participants').update({ hasUsedRefresh: true }).eq('id', user.id);

            setMyHand(newHand);
            setMySlots([null, null, null, null, null]);
            await supabase.from('diamonds_slots').upsert({ game_id: GAME_ID, player_id: user.id, round: gameState.current_round, slots: [null, null, null, null, null] });

            // USER REQUEST: Core limit enforcement
            setTimeout(fetchMyParticipantStatus, 500);

            addToast("ASSETS REGENERATED. SPECIAL PROTOCOLS PRESERVED.", "success");
        } catch (err) {
            console.error("Refresh failed:", err);
            addToast("PROTOCOL CARRIER LOST. REFRESH FAILED.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUseDetector = async () => {
        if (!user || gameState?.phase !== 'slotting' || isLocked) return;
        if (powerUsage.hasUsedDetector) {
            addToast("PROTOCOL ERROR: DETECTOR CHARGE DEPLETED", "error");
            return;
        }

        setIsLoading(true);
        // setHasUsedDetectorSession(true);
        try {
            const { data: hands } = await supabase.from('diamonds_hands').select('player_id, cards').eq('game_id', GAME_ID);
            if (hands) {
                const counts: Record<string, number> = {};
                hands.forEach(h => { counts[h.player_id] = (h.cards as any[]).length; });
                setOpponentHandCounts(counts);
                setDetectorActive(true);
                await supabase.from('diamonds_participants').update({ hasUsedDetector: true }).eq('id', user.id);

                // USER REQUEST: Core limit enforcement
                setTimeout(fetchMyParticipantStatus, 500);

                addToast("SENSOR SWEEP COMPLETE. ASSET COUNTS ACQUIRED.", "success");
            }
        } catch (err) {
            console.error("Detector failed:", err);
            addToast("SENSOR LINK INTERRUPTED.", "error");
        } finally {
            setIsLoading(false);
        }
    };


    if (isLoading) return (
        <div className="min-h-screen bg-[#050508] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                <p className="text-purple-500/50 font-mono text-sm tracking-widest animate-pulse">ESTABLISHING LINK...</p>
            </div>
        </div>
    );

    // --- RENDER ---
    return (
        <div className="relative w-full min-h-screen bg-transparent flex flex-col font-sans overflow-y-auto text-white selection:bg-purple-500/30">
            {/* Background Texture - Using Hub atmosphere but keeping protocol noise */}
            <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

            {/* Header / HUD */}
            <header className="fixed top-0 left-0 right-0 z-[100] bg-black/60 backdrop-blur-md border-b border-purple-500/20 px-4 py-3 sm:px-8 sm:py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    {/* Left: Brand / Title */}
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex flex-col border-r border-white/10 pr-4">
                            <span className="text-[10px] font-black text-white/40 tracking-[0.4em] uppercase leading-none mb-1">NETWORK</span>
                            <span className="text-xs font-black text-purple-500 uppercase tracking-widest leading-none">BORDERLAND</span>
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-[10px] sm:text-xs font-cinzel font-black text-purple-500 tracking-[0.3em] uppercase leading-none mb-1">
                                DIAMONDS TRIAL
                            </h2>
                            <h1 className="text-sm sm:text-lg font-black font-oswald text-white tracking-widest uppercase leading-none">
                                LOGIC PROTOCOL
                            </h1>
                        </div>
                    </div>

                    {/* Right: Actions (Rules/Close) */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowRulesModal(true)}
                            className="p-2 sm:px-4 sm:py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded text-purple-500 transition-all active:scale-95"
                        >
                            <span className="hidden sm:inline font-mono text-[11px] tracking-widest uppercase">SYNOPSIS</span>
                            <Info size={18} className="sm:hidden" />
                        </button>

                        <button
                            onClick={() => setShowPlayerCard(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-all active:scale-95 group"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                            <span className="text-[10px] font-mono tracking-[0.2em] text-gray-300 uppercase group-hover:text-white transition-colors">
                                {user?.username?.toUpperCase() || 'PLAYER'}
                            </span>
                            <User size={14} className="text-gray-500 group-hover:text-purple-400 transition-colors" />
                        </button>
                    </div>
                </div>

                {/* Sub-Header HUD */}
                <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-white/5 flex items-center justify-around sm:justify-end sm:gap-8">
                    <div className="flex flex-col items-center sm:items-end">
                        <p className="text-[7px] sm:text-[9px] text-purple-300/40 font-mono uppercase tracking-[0.2em]">ROUND</p>
                        <p className="text-sm sm:text-xl font-black font-oswald text-white">
                            {gameState?.current_round || 1}<span className="text-purple-900 text-[10px] sm:text-sm">/5</span>
                        </p>
                    </div>

                    <div className="w-px h-6 bg-white/10 sm:hidden" />

                    <div className="flex flex-col items-center sm:items-end">
                        <p className="text-[7px] sm:text-[9px] text-purple-300/40 font-mono uppercase tracking-[0.2em]">TIMER</p>
                        <div className="flex items-center gap-1.5">
                            <Timer size={12} className="text-purple-500 animate-pulse sm:w-4 sm:h-4" />
                            <p className="text-sm sm:text-xl font-black font-oswald tabular-nums text-purple-500">
                                {timeLeft}s
                            </p>
                        </div>
                    </div>

                    <div className="w-px h-6 bg-white/10 sm:hidden" />

                    <div className="flex flex-col items-center sm:items-end bg-purple-500/10 px-3 py-1 sm:px-4 sm:py-1.5 rounded border border-purple-500/20">
                        <p className="text-[7px] sm:text-[9px] text-purple-400/70 font-mono uppercase tracking-[0.2em]">CREDITS</p>
                        <p className="text-sm sm:text-xl font-black font-oswald text-purple-400">
                            {myPlayer?.score || 0}
                        </p>
                    </div>
                </div>
            </header>

            {/* SYNOPSIS Modal (Rules) */}
            <AnimatePresence>
                {showRulesModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6"
                        onClick={() => setShowRulesModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="max-w-md w-full bg-zinc-950 border border-purple-500/30 p-8 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.2)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                                <h3 className="text-2xl font-black font-oswald tracking-widest text-purple-500 uppercase">TRIAL SYNOPSIS</h3>
                                <button onClick={() => setShowRulesModal(false)} className="text-white/40 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black font-mono text-purple-400 uppercase tracking-widest">Asset Hierarchy</p>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                                                <span className="text-xs font-black font-cinzel text-white">ZOMBIE</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-white/40">BEATS ALL NUMBERS</span>
                                        </div>
                                        <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                                <span className="text-xs font-black font-cinzel text-white">INJECTION</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-white/40">CURES ZOMBIES</span>
                                        </div>
                                        <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                                <span className="text-xs font-black font-cinzel text-white">SHOTGUN</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-white/40">ELIMINATES TARGETS</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <p className="text-[10px] font-black font-mono text-purple-400 uppercase tracking-widest">Protocol Values</p>
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                        <div className="grid grid-cols-2 gap-y-2 text-[10px] font-mono uppercase tracking-widest">
                                            <span className="text-white/40">VICTORY DELTA</span>
                                            <span className="text-right text-green-400 font-bold">+200 CR</span>
                                            <span className="text-white/40">CONFLICT LOSS</span>
                                            <span className="text-right text-red-400 font-bold">-100 CR</span>
                                            <span className="text-white/40">ELIMINATION</span>
                                            <span className="text-right text-red-600 font-extrabold">DECOMMISSIONED</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowRulesModal(false)}
                                    className="w-full py-4 mt-4 bg-purple-600 hover:bg-purple-500 text-white font-black font-oswald uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                                >
                                    ACKNOWLEDGE
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* RESET OVERLAY */}
            <AnimatePresence>
                {showResetOverlay && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-black backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
                    >
                        <AlertTriangle className="text-red-500 w-16 h-16 mb-4 animate-bounce" />
                        <h2 className="text-4xl font-black text-white tracking-widest mb-2 font-mono">SYSTEM RESET</h2>
                        <p className="text-red-500/70 font-mono text-sm tracking-[0.3em] animate-pulse">ADMIN FORCE PROTOCOL TERMINATION</p>
                        <div className="mt-8 flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                            <span className="text-[10px] text-gray-500 font-mono">RETURNING TO LOBBY...</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {gameState?.is_paused && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 w-screen h-screen z-[10000] bg-black/98 backdrop-blur-2xl flex items-center justify-center pointer-events-auto left-0 top-0"
                    >
                        <div className="text-center space-y-6 p-8">
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full animate-pulse" />
                                <h2 className="text-6xl lg:text-8xl font-black text-yellow-500 tracking-[0.2em] italic relative drop-shadow-[0_0_30px_rgba(234,179,8,0.5)]">
                                    SYSTEM PAUSED
                                </h2>
                            </div>
                            <p className="text-white/60 font-mono text-lg lg:text-xl uppercase tracking-[0.5em] animate-pulse">
                                AWAITING MASTER AUTHORIZATION
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* BRIEFING OVERLAY */}
            <AnimatePresence mode="wait">
                {gameState?.phase === 'briefing' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-[#050508]/98 backdrop-blur-2xl overflow-y-auto custom-scrollbar p-6 lg:p-12"
                    >
                        <div className="min-h-full w-full flex items-start justify-center">
                            {/* High-Tech Background Elements */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                                <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,#16161a_1px,transparent_1px),linear-gradient(to_bottom,#16161a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

                                {/* Global Scanner Sweep Effect */}
                                <motion.div
                                    animate={{ top: ["-10%", "110%"] }}
                                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent shadow-[0_0_20px_rgba(168,85,247,1)] z-[1001] opacity-50"
                                />

                                <motion.div
                                    animate={{ top: ["100%", "-20%"] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-0 right-0 h-40 bg-gradient-to-b from-transparent via-purple-500/10 to-transparent blur-3xl"
                                />
                            </div>

                            <div className="relative max-w-[1600px] w-full mx-auto space-y-8 sm:space-y-12 pt-16 pb-24 px-4 sm:px-6">
                                {/* Header Section */}
                                <motion.div
                                    initial={{ y: -30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="text-center space-y-4 relative mb-16"
                                >
                                    {/* Decorative Ring */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

                                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-purple-400/20 bg-purple-950/40 text-[10px] font-black text-purple-300 uppercase tracking-[0.4em] mb-4 backdrop-blur-md">
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />
                                        <span>Security Update: Advanced Asset Protocol</span>
                                        <span className="ml-4 pl-4 border-l border-purple-500/30 text-white animate-pulse">
                                            System Ready: {timeLeft}s
                                        </span>
                                    </div>

                                    <h1 className="font-cinzel text-3xl md:text-8xl text-white uppercase tracking-tighter leading-none relative z-10 transition-all">
                                        LOGIC <span className="text-transparent bg-clip-text bg-gradient-to-b from-purple-300 via-purple-500 to-purple-800 drop-shadow-[0_0_20px_rgba(168,85,247,0.5)] animate-pulse">PROTOCOL</span>
                                        <motion.div
                                            animate={{ opacity: [0, 0.05, 0], x: [-5, 5, -2, 0] }}
                                            transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 5 }}
                                            className="absolute inset-0 text-purple-500 blur-sm -z-10 select-none font-cinzel text-3xl md:text-8xl"
                                        >
                                            LOGIC PROTOCOL
                                        </motion.div>
                                    </h1>

                                    <div className="flex items-center justify-center gap-3">
                                        <div className="h-px w-12 bg-gradient-to-r from-transparent to-purple-500/30" />
                                        <p className="text-purple-300/40 font-cinzel text-[10px] tracking-[0.4em] font-black uppercase">
                                            [CORE LOGIC STABILIZED] :: Authorized Blueprint
                                        </p>
                                        <div className="h-px w-12 bg-gradient-to-l from-transparent to-purple-500/30" />
                                    </div>
                                </motion.div>

                                {/* MAIN BRIEFING CONTENT GRID */}
                                <div className="flex flex-col xl:flex-row items-stretch justify-center gap-8 relative z-10">
                                    {/* LEFT: Array Constraints */}
                                    <motion.div
                                        initial={{ x: -50, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="w-full xl:w-[280px] shrink-0 self-stretch"
                                    >
                                        <TerminalBox title="Array Constraints" icon={<Scan size={16} />}>
                                            <div className="overflow-hidden border border-purple-500/10 rounded-lg bg-black/40 h-full">
                                                <table className="w-full text-left font-cinzel text-[11px] border-collapse h-full">
                                                    <thead>
                                                        <tr className="bg-purple-500/10 border-b border-purple-500/20">
                                                            <th className="px-3 py-4 text-purple-400 font-black uppercase tracking-widest border-r border-purple-500/10">Protocol</th>
                                                            <th className="px-3 py-4 text-purple-400 font-black uppercase tracking-widest">Constraint</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-purple-500/10">
                                                        <tr className="hover:bg-purple-500/5 transition-colors">
                                                            <td className="px-3 py-4 text-purple-300/80 border-r border-purple-500/10 font-bold leading-tight">VARIABLE DEPLOYMENT</td>
                                                            <td className="px-3 py-4 text-white/50 leading-tight">1-5 ASSETS PER ROUND REQ.</td>
                                                        </tr>
                                                        <tr className="hover:bg-orange-500/5 transition-colors">
                                                            <td className="px-3 py-4 text-orange-400/80 border-r border-purple-500/10 font-bold uppercase leading-tight">Overload Principle</td>
                                                            <td className="px-3 py-4 text-white/50 uppercase leading-tight">ONE 5-CARD DEPLOYMENT SESSION.</td>
                                                        </tr>
                                                        <tr className="hover:bg-purple-500/5 transition-colors">
                                                            <td className="px-3 py-4 text-purple-300/80 border-r border-purple-500/10 font-bold uppercase leading-tight">Asset Recovery</td>
                                                            <td className="px-3 py-4 text-white/50 uppercase leading-tight">WINNERS STEAL 1 FROM DEFEATED.</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </TerminalBox>
                                    </motion.div>

                                    {/* CENTER COLUMN: Cards + Point Table */}
                                    <div className="flex-1 flex flex-col">
                                        {/* Asset Cards Grid */}
                                        <div className="flex flex-wrap lg:flex-nowrap justify-center items-stretch gap-4 pb-0">
                                            <BriefingCard
                                                title="ZOMBIE"
                                                id="28472A"
                                                desc="OFFENSIVE OVERRIDE. Beats any numeric card. Overrides standard defenses instantly. Vulnerable to tactical serums."
                                                delay={0.1}
                                                color="purple"
                                            />
                                            <BriefingCard
                                                title="INJECTION"
                                                id="DVL291"
                                                desc="NUMERIC STABILIZER. Resets infected arrays to baseline (2-9). Counteracts viral load and stabilizes volatility."
                                                delay={0.2}
                                                color="green"
                                            />
                                            <BriefingCard
                                                title="SHOTGUN"
                                                id="A683BF"
                                                desc="TARGET ELIMINATION. Instantly neutralizes active threats. High-priority asset for stopping imminent signatures."
                                                delay={0.3}
                                                color="orange"
                                            />
                                        </div>

                                        {/* Point Table Reference - Tightly packed */}
                                        <div className="mt-0">
                                            <TerminalBox title="Numeric Asset Reference Matrix" icon={<Activity size={16} />}>
                                                <div className="overflow-hidden border border-purple-500/10 rounded-lg bg-black/60">
                                                    <div className="flex divide-x divide-purple-500/10">
                                                        {[
                                                            { rank: '2-10', val: 'FACE VALUE' },
                                                            { rank: 'J', val: '11 PT' },
                                                            { rank: 'Q', val: '12 PT' },
                                                            { rank: 'K', val: '13 PT' },
                                                            { rank: 'A', val: '14 PT' }
                                                        ].map((item, idx) => (
                                                            <div key={idx} className="flex-1 flex flex-col items-center justify-center py-4 px-2 group hover:bg-purple-500/5 transition-all">
                                                                <span className="text-[7px] font-mono text-purple-500/40 mb-1 group-hover:text-purple-400 uppercase tracking-widest">ASSET_CLASS</span>
                                                                <span className="font-cinzel text-xl text-white font-black mb-1">{item.rank}</span>
                                                                <div className="h-[1px] w-4 bg-purple-500/20 mb-2 group-hover:w-8 transition-all" />
                                                                <span className="text-[10px] font-cinzel font-black text-white/60 group-hover:text-purple-400">{item.val}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </TerminalBox>
                                        </div>
                                    </div>

                                    {/* RIGHT: Conflict Summary */}
                                    <motion.div
                                        initial={{ x: 50, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="w-full xl:w-[320px] shrink-0 self-stretch"
                                    >
                                        <TerminalBox title="Conflict Summary" icon={<Info size={16} />}>
                                            <div className="space-y-3 p-2 h-full flex flex-col">
                                                {[
                                                    { label: "WINNER", value: "SUM(ASSETS) > OPPONENT SUM", accent: "purple" },
                                                    { label: "ZOMBIE", value: "OVERRIDES SLOT REGARDLESS OF SUM", accent: "purple" },
                                                    { label: "LIMITS", value: "1Z, 2I, 2S PER TOTAL SESSION", accent: "orange" },
                                                    { label: "SCORING", value: "SURVIVAL: +200CR | LOSS: -100CR", accent: "purple" }
                                                ].map((item, idx) => (
                                                    <div key={idx} className="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-3 rounded-lg group hover:border-purple-500/30 transition-all flex-1">
                                                        <div className={`w-1 h-full bg-${item.accent === 'purple' ? 'purple-500' : 'orange-500'} rounded-full opacity-50 group-hover:opacity-100 transition-opacity`} />
                                                        <div className="flex-1">
                                                            <p className={`font-cinzel text-[10px] font-black uppercase tracking-[0.2em] text-${item.accent === 'purple' ? 'purple-400' : 'orange-400'} mb-1`}>{item.label}</p>
                                                            <p className="font-cinzel text-[11px] text-white/50 group-hover:text-white/80 transition-colors uppercase leading-tight">{item.value}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </TerminalBox>
                                    </motion.div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* WAITING / IDLE */}
            {
                gameState?.phase === 'idle' && (
                    <div className="absolute inset-0 z-40 bg-black/95 flex flex-col items-center justify-center">
                        <div className="p-12 border border-purple-500/20 bg-purple-900/5 rounded-2xl text-center space-y-6 backdrop-blur-md">
                            <div className="w-16 h-16 mx-auto border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-2 tracking-widest font-mono uppercase">Logic Protocol Initializing...</h1>
                                <p className="text-purple-400/50 text-sm font-mono tracking-[0.2em] animate-pulse">SYNCHRONIZING DATA GRID...</p>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ELIMINATED */}
            {
                myPlayer?.status === 'eliminated' && (
                    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
                        <Skull size={64} className="text-red-600 mb-6 animate-pulse" />
                        <h1 className="text-6xl font-black text-red-600 tracking-tighter mix-blend-screen">ELIMINATED</h1>
                        <p className="text-red-500/50 mt-4 font-mono text-sm tracking-[0.5em] uppercase">Subject Decommissioned</p>
                    </div>
                )
            }

            {/* END GAME OVERLAY */}
            <AnimatePresence>
                {gameState?.phase === 'end' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 z-[6000] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center overscroll-none"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="max-w-4xl w-full space-y-12"
                        >
                            <div className="space-y-4">
                                <motion.div
                                    animate={{
                                        textShadow: ["0 0 20px rgba(168,85,247,0)", "0 0 20px rgba(168,85,247,0.5)", "0 0 20px rgba(168,85,247,0)"]
                                    }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                >
                                    <h1 className="text-5xl sm:text-7xl font-black text-white tracking-[0.3em] uppercase italic">CONGRATULATIONS</h1>
                                </motion.div>
                                <div className="h-1 w-48 bg-gradient-to-r from-transparent via-purple-500 to-transparent mx-auto" />
                                <p className="text-purple-400 font-display text-[10px] sm:text-xs tracking-[0.5em] uppercase">Trial of Diamonds :: Concluded</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {gameState.participants.sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, idx) => (
                                    <motion.div
                                        key={p.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5 + idx * 0.1 }}
                                        className={`relative p-6 border rounded-[30px] transition-all bg-white/[0.02] ${idx === 0 ? 'border-purple-500 bg-purple-500/5' : 'border-white/10'}`}
                                    >
                                        {idx === 0 && (
                                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-purple-500 text-black font-black text-[8px] uppercase tracking-widest rounded-full shadow-[0_0_20px_#a855f7]">
                                                VICTOR
                                            </div>
                                        )}
                                        <p className="text-[10px] text-white/30 font-mono mb-2 uppercase tracking-tighter">RANK 0{idx + 1}</p>
                                        <h3 className="text-2xl font-black text-white mb-2 leading-none uppercase truncate">{playerIdMap[p.id] || p.username}</h3>
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-3xl font-black text-purple-400">{p.score || 0}</span>
                                            <span className="text-[10px] text-white/20 font-mono uppercase">CR</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <button
                                onClick={() => {
                                    localStorage.removeItem('diamonds_game_id');
                                    if (onClose) onClose();
                                }}
                                className="group relative px-20 py-6 bg-purple-600 hover:bg-purple-500 text-black font-black uppercase tracking-[0.5em] transition-all duration-500 shadow-[0_0_40px_rgba(168,85,247,0.4)]"
                                style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
                            >
                                <span className="flex items-center gap-4 text-xs">
                                    Return to Citadel
                                    <ChevronRight size={20} className="group-hover:translate-x-2 transition-transform" />
                                </span>
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


            {/* PROHIBITED ACCESS OVERLAY */}
            <AnimatePresence>
                {isProhibited && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 z-[5000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="max-w-md space-y-8"
                        >
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full animate-pulse" />
                                <Skull size={80} className="text-red-500 relative animate-bounce" />
                            </div>
                            <div className="space-y-4">
                                <h1 className="text-4xl font-black text-white tracking-[0.2em] uppercase font-mono">ACCESS REVOKED</h1>
                                <div className="h-1 w-24 bg-red-500 mx-auto rounded-full" />
                                <p className="text-red-400 font-mono text-sm tracking-widest leading-relaxed">
                                    MASTER ROLES ARE PROHIBITED FROM THIS TRIAL. <br />
                                    DECRYPTION INTERRUPTED.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-12 py-4 bg-red-600/20 border border-red-500/50 text-red-500 font-black uppercase tracking-[0.3em] hover:bg-red-600/40 transition-all rounded-sm"
                            >
                                TERMINATE LINK
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* SCORING OVERLAY */}
            <AnimatePresence>
                {gameState?.phase === 'scoring' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex items-start justify-center p-4 lg:p-12 overflow-y-auto custom-scrollbar"
                    >
                        <div className="max-w-xl w-full text-center space-y-10 py-12">
                            {(() => {
                                const isWinner = gameState.round_data?.winners?.includes(user?.id) || gameState.round_data?.winners?.includes(myPlayer?.id);
                                const isEliminated = myPlayer?.status === 'eliminated';
                                const myEffects = gameState.round_data?.effects?.filter((e: any) => e.playerId === user?.id) || [];

                                return (
                                    <>
                                        <motion.div
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="space-y-6"
                                        >
                                            <h2 className={`text-4xl lg:text-6xl font-black italic uppercase tracking-tighter drop-shadow-[0_0_50px_rgba(0,0,0,1)] leading-none ${isWinner ? 'text-purple-400' : isEliminated ? 'text-red-600' : 'text-orange-500'}`}>
                                                {isWinner ? "VICTORY" : isEliminated ? "TERMINATED" : "DEFEAT"}
                                            </h2>
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="h-px w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                                <p className="text-white/40 font-mono text-xs tracking-[0.4em] font-black uppercase">ROUND {gameState.current_round} PROTOCOL SUMMARY</p>
                                                <div className="h-px w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                            </div>
                                        </motion.div>

                                        {/* Status Effects */}
                                        {myEffects.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                {myEffects.map((eff: any, idx: number) => (
                                                    <motion.div
                                                        key={idx}
                                                        initial={{ x: -20, opacity: 0 }}
                                                        animate={{ x: 0, opacity: 1 }}
                                                        transition={{ delay: 0.2 + idx * 0.1 }}
                                                        className={`flex items-center gap-3 px-4 py-2 rounded-lg border font-mono text-[10px] uppercase tracking-widest ${eff.type === 'infected' ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-green-500/10 border-green-500 text-green-400'}`}
                                                    >
                                                        <Activity size={12} />
                                                        {eff.desc}
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}

                                        {/* CONFLICT ANALYSIS TABLE */}
                                        {(() => {
                                            const battle = gameState.round_data?.results?.find((r: any) =>
                                                r.winners.includes(user?.id) || r.losers.includes(user?.id) || r.eliminatedIds.includes(user?.id)
                                            );

                                            if (!battle) return null;

                                            const is3Way = battle.slotDetails?.[0]?.p3Card !== undefined;

                                            return (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.4 }}
                                                    className="w-full bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden"
                                                >
                                                    <div className="bg-white/[0.05] px-4 py-2 border-b border-white/5 flex justify-between items-center">
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">Conflict Analysis</span>
                                                        <div className="flex gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500/20" />
                                                        </div>
                                                    </div>

                                                    <table className="w-full text-[10px] font-mono border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-white/10 text-gray-500 uppercase tracking-widest text-[8px]">
                                                                <th className="py-3 px-4 text-left font-normal uppercase">Slot</th>
                                                                <th className="py-3 px-4 text-center font-bold text-purple-400 uppercase">YOU</th>
                                                                <th className="py-3 px-4 text-center font-normal uppercase">
                                                                    {(() => {
                                                                        const oppId = battle.p2Id;
                                                                        return playerIdMap[oppId] || "OPP 1";
                                                                    })()}
                                                                </th>
                                                                {is3Way && (
                                                                    <th className="py-3 px-4 text-center font-normal uppercase">
                                                                        {(() => {
                                                                            const opp2Id = battle.p3Id;
                                                                            return playerIdMap[opp2Id] || "OPP 2";
                                                                        })()}
                                                                    </th>
                                                                )}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/[0.03]">
                                                            {battle.slotDetails?.map((slot: any, sIdx: number) => {
                                                                return (
                                                                    <tr key={sIdx} className="hover:bg-white/[0.01] transition-colors">
                                                                        <td className="py-3 px-4 text-left text-white/20 font-light tracking-tighter">PKT-0{sIdx + 1}</td>
                                                                        <td className="py-3 px-4 text-center transition-all">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-white font-black text-xs leading-none mb-0.5">
                                                                                    {slot.p1Card ? (slot.p1Card.specialType || `${slot.p1Card.rank}${slot.p1Card.suit?.charAt(0).toUpperCase()}`) : '-'}
                                                                                </span>
                                                                                <span className={`text-[8px] font-black leading-none ${slot.p1Val > 0 ? 'text-green-500' : 'text-red-500 opacity-60'}`}>{slot.p1Val >= 999 ? 'MAX' : `${slot.p1Val}pt`}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-3 px-4 text-center">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-white/40 font-bold text-xs leading-none mb-0.5">
                                                                                    {slot.p2Card ? (slot.p2Card.specialType || `${slot.p2Card.rank}${slot.p2Card.suit?.charAt(0).toUpperCase()}`) : '-'}
                                                                                </span>
                                                                                <span className={`text-[8px] font-bold leading-none ${slot.p2Val > 0 ? 'text-green-500' : 'text-red-500 opacity-40'}`}>{slot.p2Val >= 999 ? 'MAX' : `${slot.p2Val}pt`}</span>
                                                                            </div>
                                                                        </td>
                                                                        {is3Way && (
                                                                            <td className="py-3 px-4 text-center">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-white/40 font-bold text-xs leading-none mb-0.5">
                                                                                        {slot.p3Card ? (slot.p3Card.specialType || `${slot.p3Card.rank}${slot.p3Card.suit?.charAt(0).toUpperCase()}`) : '-'}
                                                                                    </span>
                                                                                    <span className={`text-[8px] font-bold leading-none ${slot.p3Val > 0 ? 'text-green-500' : 'text-red-500 opacity-40'}`}>{slot.p3Val >= 999 ? 'MAX' : `${slot.p3Val}pt`}</span>
                                                                                </div>
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="bg-purple-500/10 font-mono">
                                                                <td className="py-4 px-4 text-left text-purple-400 font-black text-[9px] tracking-widest uppercase">TOTAL ROUND SCORE</td>
                                                                <td className="py-4 px-4 text-center text-purple-400 font-black text-base drop-shadow-[0_0_10px_rgba(168,85,247,0.3)]">{battle.p1Total >= 999 ? 'MAX' : battle.p1Total}</td>
                                                                <td className="py-4 px-4 text-center text-white/30 font-bold text-base">{battle.p2Total >= 999 ? 'MAX' : battle.p2Total}</td>
                                                                {is3Way && <td className="py-4 px-4 text-center text-white/10 font-bold text-base">{battle.p3Total >= 999 ? 'MAX' : battle.p3Total}</td>}
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </motion.div>
                                            );
                                        })()}

                                        <div className="flex flex-col gap-4 py-6 border-y border-white/10">
                                            <div className="flex justify-between items-end">
                                                <div className="text-left">
                                                    <p className="text-[10px] text-gray-500 uppercase mb-1">Individual Duel</p>
                                                    <p className={`text-sm font-bold ${isWinner ? 'text-purple-400' : 'text-red-500'}`}>
                                                        {isWinner ? "+200" : isEliminated ? "-500" : "-100"} <span className="text-[8px] opacity-40">CR</span>
                                                    </p>
                                                </div>
                                                {(() => {
                                                    const duelPoints = isWinner ? 200 : isEliminated ? -500 : -100;
                                                    const synergyPoints = (myPlayer?.roundAdjustment ?? 0) - duelPoints;
                                                    // USER REQUEST: Only show synergy box in the final round (Round 5)
                                                    if ((gameState?.current_round || 0) < 5) return null;
                                                    if (synergyPoints === 0) return null;

                                                    return (
                                                        <div className="text-center bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                                                            <p className="text-[10px] text-gray-500 uppercase mb-1">Team Synergy</p>
                                                            <p className={`text-sm font-bold ${synergyPoints >= 0 ? 'text-green-500' : 'text-orange-500'}`}>
                                                                {synergyPoints > 0 ? '+' : ''}{synergyPoints} <span className="text-[8px] opacity-40 font-mono">CR</span>
                                                            </p>
                                                        </div>
                                                    );
                                                })()}
                                                <div className="text-right">
                                                    <p className="text-[14px] text-gray-400 uppercase mb-2 font-bold tracking-widest">Net Visa Adjust</p>
                                                    <p className={`text-2xl lg:text-3xl font-black ${(myPlayer?.roundAdjustment ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {(myPlayer?.roundAdjustment ?? 0) >= 0 ? '+' : ''}{myPlayer?.roundAdjustment ?? 0}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                                <span className="text-[10px] text-gray-500 uppercase tracking-widest">Protocol Balance</span>
                                                <span className="text-base font-black text-white">{myPlayer?.score || 0} <span className="text-[10px] text-gray-600">CR</span></span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center gap-2 text-purple-500/50 animate-pulse">
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
                                            <span className="text-[10px] uppercase tracking-[0.3em] font-mono">Awaiting Next Round Assignment</span>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* UI CLEANUP: Redundant Header Removed */}

            {/* MAIN GAME AREA */}
            <main className="flex-1 overflow-y-auto p-2 sm:p-4 pt-32 sm:pt-40 pb-56 relative z-10 flex flex-col items-center">

                {/* PHASE INDICATOR */}
                <div className="mb-4 text-center px-4" >
                    <motion.div
                        key={gameState?.phase}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-2"
                    >
                        {gameState?.phase !== 'dealing' && (
                            <>
                                <h2 className="text-3xl font-black text-white uppercase tracking-widest font-mono">
                                    {gameState?.phase === 'slotting' ? "DEPLOYMENT PHASE" :
                                        gameState?.phase === 'evaluation' ? "COMBAT RESOLUTION" :
                                            gameState?.phase === 'shuffle' ? "TABLE ASSIGNMENTS" :
                                                gameState?.phase?.toUpperCase()}
                                </h2>
                                <p className="text-purple-500/40 text-xs font-mono uppercase tracking-[0.3em]">
                                    {gameState?.phase === 'slotting' ? "ARRANGE YOUR 5-SLOT BATTLE ARRAY" :
                                        gameState?.phase === 'shuffle' ? "CONNECTING PARTICIPANTS TO BATTLE STATIONS" :
                                            "AWAITING SYSTEM UPDATE"}
                                </p>
                            </>
                        )}
                    </motion.div>

                    {/* POWERS UI - Deployment Phase Only */}
                    {gameState?.phase === 'slotting' && (
                        <>
                            {/* PLAYER STATUS DISPLAY BOX (LEFT MIDDLE) */}
                            <motion.div
                                initial={{ x: -100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="fixed left-4 xl:left-8 top-1/2 -translate-y-1/2 z-10 w-52 xl:w-60 flex flex-col gap-3 px-4 py-6 bg-black/60 border border-white/10 rounded-2xl backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border-glow-purple"
                            >
                                <div className="flex items-center gap-2 pb-4 border-b border-white/10">
                                    <Activity size={16} className="text-purple-500 animate-pulse" />
                                    <h3 className="text-[10px] font-display font-black text-purple-400 uppercase tracking-[0.4em]">Tactical Table Intelligence</h3>
                                </div>

                                <div className="flex flex-col gap-2 overflow-y-auto max-h-[40vh] pr-2 custom-scrollbar">
                                    {(() => {
                                        const myGroup = gameState?.participants?.find(p => p.id === user?.id)?.groupId;
                                        const otherGroupMembers = (gameState?.participants || []).filter(p => p.groupId === myGroup && p.id !== user?.id);

                                        if (otherGroupMembers.length === 0) {
                                            return <span className="text-[8px] font-mono text-white/10 uppercase tracking-widest text-center py-4">Searching for unit traces...</span>;
                                        }

                                        return otherGroupMembers.map(opp => (
                                            <div key={opp.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between group hover:border-purple-500/30 transition-all">
                                                <div className="flex flex-col">
                                                    <span className="text-white/80 font-display text-[10px] font-black uppercase tracking-tight">{playerIdMap[opp.id] || opp.username}</span>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {opp.isZombie && (
                                                            <span className="text-[6px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-1 py-0.5 rounded-sm">ZOMBIE</span>
                                                        )}
                                                        {opp.status === 'eliminated' && (
                                                            <span className="text-[6px] font-black text-orange-500 uppercase tracking-widest bg-orange-500/10 px-1 py-0.5 rounded-sm">OFFLINE</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {detectorActive && opponentHandCounts[opp.id] !== undefined ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-emerald-400 font-mono text-lg font-black leading-none">{opponentHandCounts[opp.id]}</span>
                                                        <span className="text-[6px] text-white/20 font-black uppercase tracking-widest">ASSETS</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-end opacity-40 group-hover:opacity-100 transition-opacity">
                                                        <Scan size={14} className="text-white/40 group-hover:text-purple-500" />
                                                        <span className="text-[6px] text-white/20 font-black uppercase tracking-[0.1em] mt-1">NO_UPLINK</span>
                                                    </div>
                                                )}
                                            </div>
                                        ));
                                    })()}
                                </div>

                                <div className="mt-2 pt-4 border-t border-white/5">
                                    <span className="text-[7px] font-mono text-white/10 uppercase tracking-[0.4em] animate-pulse">Scanning unit proximity...</span>
                                </div>

                                {/* Interactive corner detail */}
                                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-purple-500/40" />
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-purple-500/40" />
                            </motion.div>

                            {/* POWERS UI BOX (RIGHT MIDDLE) */}
                            <motion.div
                                initial={{ x: 100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="fixed right-4 xl:right-8 top-1/2 -translate-y-1/2 z-10 w-52 xl:w-60 flex flex-col gap-4 px-5 py-7 bg-black/60 border border-white/10 rounded-2xl backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border-glow-purple"
                            >
                                <div className="flex flex-col items-end gap-1 text-right pb-4 border-b border-white/5">
                                    <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">TACTICAL_ASSETS</span>
                                    <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest">DEPLOYMENT_MODULES</span>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <button
                                        onClick={handleRefreshHand}
                                        disabled={gameState?.phase !== 'slotting' || powerUsage.hasUsedRefresh || isLocked}
                                        className={`group relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 ${gameState?.phase !== 'slotting' || powerUsage.hasUsedRefresh || isLocked ? 'bg-white/5 border-white/5 opacity-40 cursor-not-allowed' : 'bg-purple-900/20 border-purple-500/30 hover:bg-purple-500 hover:border-purple-400 hover:shadow-[0_0_30px_#a855f7]'}`}
                                    >
                                        <Activity size={24} className={gameState?.phase !== 'slotting' || powerUsage.hasUsedRefresh || isLocked ? 'text-white/20' : 'text-purple-400 group-hover:text-black'} />
                                        <span className={`mt-2 text-[9px] font-black uppercase tracking-widest ${gameState?.phase !== 'slotting' || powerUsage.hasUsedRefresh || isLocked ? 'text-white/20' : 'text-purple-400 group-hover:text-black'}`}>
                                            {powerUsage.hasUsedRefresh ? "REFRESH_VOID" : "REFRESH_ARRAY"}
                                        </span>
                                        <div className="absolute top-2 right-2 flex gap-0.5">
                                            <div className={`w-1 h-1 rounded-full ${powerUsage.hasUsedRefresh ? 'bg-white/20' : 'bg-purple-400 animate-pulse'}`} />
                                        </div>
                                    </button>

                                    <button
                                        onClick={handleUseDetector}
                                        disabled={gameState?.phase !== 'slotting' || powerUsage.hasUsedDetector || isLocked}
                                        className={`group relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 ${gameState?.phase !== 'slotting' || powerUsage.hasUsedDetector || isLocked ? 'bg-white/5 border-white/5 opacity-40 cursor-not-allowed' : 'bg-emerald-900/20 border-emerald-500/30 hover:bg-emerald-500 hover:border-emerald-400 hover:shadow-[0_0_30px_#10b981]'}`}
                                    >
                                        <Scan size={24} className={gameState?.phase !== 'slotting' || powerUsage.hasUsedDetector || isLocked ? 'text-white/20' : 'text-emerald-400 group-hover:text-black'} />
                                        <span className={`mt-2 text-[9px] font-black uppercase tracking-widest ${gameState?.phase !== 'slotting' || powerUsage.hasUsedDetector || isLocked ? 'text-white/20' : 'text-emerald-400 group-hover:text-black'}`}>
                                            {powerUsage.hasUsedDetector ? "DETECT_DEPLETED" : "ENGAGE_DETECTOR"}
                                        </span>
                                        <div className="absolute top-2 right-2 flex gap-0.5">
                                            <div className={`w-1 h-1 rounded-full ${powerUsage.hasUsedDetector ? 'bg-white/20' : 'bg-emerald-400 animate-pulse'}`} />
                                        </div>
                                    </button>
                                </div>

                                <div className="mt-2 text-center">
                                    <span className="text-[7px] font-mono text-white/10 uppercase tracking-[0.4em] animate-pulse">
                                        {gameState?.phase === 'slotting' ? "Awaiting command input..." : "Modules standby..."}
                                    </span>
                                </div>

                                {/* Interactive corner detail */}
                                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-purple-500/40" />
                                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-purple-500/40" />
                            </motion.div>
                        </>
                    )}
                </div >

                {/* SHUFFLE / TABLE VIEW - Personalized Only */}
                {
                    gameState?.phase === 'shuffle' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full max-w-2xl px-4"
                        >
                            {(() => {
                                const myGroup = gameState.participants.find(p => p.id === user?.id)?.groupId;
                                const groupMembers = gameState.participants.filter(p => p.groupId === myGroup && p.status === 'active');

                                if (!myGroup) return (
                                    <div className="p-12 text-center bg-black/40 border border-white/5 rounded-[40px] backdrop-blur-xl">
                                        <div className="w-12 h-12 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto mb-6" />
                                        <p className="text-purple-500/40 font-mono text-sm tracking-[0.3em] uppercase">Recalibrating Table Vectors...</p>
                                    </div>
                                );

                                return (
                                    <div className="p-10 border border-purple-500/30 bg-purple-900/10 rounded-[3rem] backdrop-blur-xl relative overflow-hidden group hover:border-purple-500/50 transition-all duration-500">
                                        {/* Background Effects */}
                                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#16161a_1px,transparent_1px),linear-gradient(to_bottom,#16161a_1px,transparent_1px)] bg-[size:20px_20px] opacity-10 pointer-events-none" />
                                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Swords size={96} className="text-purple-500" />
                                        </div>

                                        <h3 className="text-purple-500 font-display text-xs tracking-[0.5em] mb-8 flex items-center gap-4">
                                            <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-pulse shadow-[0_0_15px_#a855f7]" />
                                            PROTOCOL UNIT: {myGroup}
                                        </h3>

                                        <div className="space-y-6">
                                            {groupMembers.map(m => (
                                                <div key={m.id} className="flex items-center gap-6 group/item">
                                                    <div className={`w-4 h-4 rounded-full transition-all duration-500 ${m.id === user?.id ? 'bg-purple-400 shadow-[0_0_15px_#a855f7] scale-110' : 'bg-white/10'}`} />
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-3">
                                                            <span className={`font-display text-4xl leading-none uppercase tracking-tighter transition-colors ${m.id === user?.id ? 'text-white font-black' : 'text-white/20'}`}>
                                                                {playerIdMap[m.id] || m.username || 'AGENT'}
                                                            </span>
                                                            {m.id === user?.id && (
                                                                m.isZombie ? (
                                                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-full">
                                                                        <Biohazard size={12} className="text-red-500" />
                                                                        <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">ZOMBIE</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/50 rounded-full">
                                                                        <Shield size={12} className="text-emerald-500" />
                                                                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">SURVIVOR</span>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                        {detectorActive && opponentHandCounts[m.id] !== undefined && m.id !== user?.id && (
                                                            <span className="text-[10px] font-mono text-emerald-400/60 uppercase tracking-widest mt-1">
                                                                Detected Assets: {opponentHandCounts[m.id]} Units
                                                            </span>
                                                        )}
                                                        {m.id === user?.id && (
                                                            <span className="text-[10px] font-mono text-purple-500/60 tracking-[0.3em] uppercase mt-1">Target ID</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-12 pt-8 border-t border-white/5">
                                            <span className="text-[10px] text-orange-500 font-black uppercase tracking-[0.4em] flex items-center gap-3">
                                                <AlertTriangle size={14} />
                                                {groupMembers.length === 3 ? "TRIPLE CONFLICT STANDBY" : "BATTLE PROTOCOL READY"}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </motion.div>
                    )
                }

                {/* DEALING VIEW */}
                {
                    gameState?.phase === 'dealing' && (
                        <div className="flex flex-col items-center gap-12 mt-4 w-full max-w-5xl">
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="bg-black/40 border border-white/10 p-8 sm:p-12 rounded-[40px] backdrop-blur-xl text-center w-full relative overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]"
                            >
                                {/* Animated Background Pulse */}
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="absolute inset-0 bg-purple-500/5 blur-3xl rounded-full"
                                />

                                <div className="w-full overflow-x-auto scrollbar-hide px-4 py-8 relative z-10 flex flex-nowrap items-center justify-start sm:justify-center gap-4 sm:gap-6">
                                    <AnimatePresence>
                                        {myHand.map((card, idx) => (
                                            <motion.div
                                                key={card.id}
                                                initial={{
                                                    opacity: 0,
                                                    scale: 0.2,
                                                    rotateX: 90,
                                                    rotateY: 90,
                                                    y: 100,
                                                    z: -500
                                                }}
                                                animate={{
                                                    opacity: 1,
                                                    scale: 1,
                                                    rotateX: 0,
                                                    rotateY: 0,
                                                    y: 0,
                                                    z: 0
                                                }}
                                                whileHover={{
                                                    scale: 1.1,
                                                    rotateY: 15,
                                                    rotateX: 5,
                                                    z: 50,
                                                    transition: { duration: 0.3 }
                                                }}
                                                transition={{
                                                    delay: idx * 0.15,
                                                    type: "spring",
                                                    stiffness: 80,
                                                    damping: 15
                                                }}
                                                className="perspective-1000 mb-6"
                                            >
                                                <div className="absolute -inset-2 bg-purple-500/10 blur-xl opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                                <CardVisual card={card} />
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>

                                {myHand.length === 5 && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 1 }}
                                        className="mt-6 flex items-center justify-center gap-3 text-purple-500 text-[10px] font-black tracking-[0.4em] uppercase relative z-10"
                                    >
                                        <CheckCircle2 size={16} className="animate-pulse" />
                                        SYSTEM AUTHORIZED :: PROCEED TO DEPLOYMENT
                                    </motion.div>
                                )}
                            </motion.div>
                        </div>
                    )
                }

                {/* BATTLE ARRAY (SLOTS) - Gated to relevant phases */}
                {
                    ['slotting', 'evaluation', 'picking', 'scoring'].includes(gameState?.phase || '') && (
                        <div className="mb-6 w-full max-w-5xl">
                            {/* SLOT DISPLAY (MY ARRAY) */}
                            <div className="flex justify-center gap-3 sm:gap-6">
                                {(gameState?.phase === 'picking' && hasPicked) ? null : (

                                    mySlots.map((slot, i) =>
                                        <motion.div
                                            key={`slot-${i}`}
                                            ref={el => { slotRefs.current[i] = el; }}
                                            initial={false}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className={`
                                            relative w-16 h-24 sm:w-24 sm:h-32 rounded-xl border-2 flex items-center justify-center transition-all duration-300
                                            ${slot
                                                    ? 'border-purple-500 bg-purple-900/20 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                                }
                                            ${gameState?.phase === 'slotting' && !slot && !isLocked ? 'hover:bg-purple-500/10 hover:border-purple-500/50' : ''}
                                        `}
                                        >
                                            {slot ? (
                                                <>
                                                    <CardVisual card={slot} size="full" />
                                                    {gameState?.phase === 'slotting' && !isLocked && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleUnslotCard(i); }}
                                                            className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] hover:bg-red-500 hover:scale-110 transition-all z-[60] animate-in zoom-in spin-in"
                                                        >
                                                            <X size={16} strokeWidth={3} />
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center gap-1.5 opacity-10 group-hover:opacity-30 transition-opacity text-center w-full h-full">
                                                    <div className="w-6 h-6 rounded-full border border-purple-500/30 border-t-purple-500 animate-[spin_3s_linear_infinite]" />
                                                    <span className="text-[7px] font-black uppercase tracking-widest text-purple-500">Signal...</span>
                                                </div>
                                            )}
                                            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-white/10 font-mono tracking-tighter">
                                                PKT-0{i + 1}
                                            </div>
                                        </motion.div>
                                    )
                                )}
                            </div>

                            {/* TABLE INTELLIGENCE - Moved to HUD box */}

                            {/* PICKING VIEW */}
                            {gameState?.phase === 'picking' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-8 space-y-10 w-full max-w-7xl mx-auto px-4"
                                >
                                    {(gameState.round_data?.winners?.includes(user?.id) || gameState.round_data?.winners?.includes(myPlayer?.id)) ? (
                                        /* WINNER VIEW */
                                        <div className={`
                                            ${opponentSlots.length === 1 ? 'flex justify-center' : 'grid grid-cols-1 lg:grid-cols-2'} 
                                            gap-6 w-full pr-4 scrollbar-thin scrollbar-thumb-black
                                        `}>


                                            {opponentSlots.map(opp => {
                                                const displaySlots = (opp.slots.length > 0)
                                                    ? opp.slots
                                                    : (gameState.round_data?.fallback_cards?.[opp.playerId] || []);

                                                if (displaySlots.length === 0) return null;

                                                return (
                                                    <div key={opp.playerId} className="relative group p-6 sm:p-8 border border-white/10 bg-black/40 rounded-[35px] backdrop-blur-xl hover:border-purple-500/40 transition-all duration-500 shadow-2xl overflow-hidden">
                                                        <div className="flex items-center gap-4 mb-6">
                                                            <div className="w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_10px_#a855f7]" />
                                                            <h4 className="font-display text-purple-400 text-[10px] uppercase tracking-[0.4em] font-black">
                                                                {playerIdMap[opp.playerId] || opp.username || "AGENT"} :: Neutralized
                                                            </h4>
                                                        </div>
                                                        <div className="flex flex-wrap justify-center gap-4">
                                                            {/* USER REQUEST: Show all slotted cards (filled slots) */}
                                                            {displaySlots.filter((s: any) => s !== null).map((card: any) => {
                                                                const isSelected = selectedSteal?.card.id === card.id;
                                                                return (
                                                                    <motion.div
                                                                        key={card.id}
                                                                        whileHover={{ y: -10, scale: 1.05 }}
                                                                        className={`cursor-pointer relative group/card rounded-xl p-1 transition-all ${isSelected ? 'bg-purple-500/20 ring-2 ring-purple-500 shadow-[0_0_20px_#a855f7]' : ''}`}
                                                                        onClick={() => handleStealCard(opp.playerId, card)}
                                                                    >
                                                                        {isSelected && (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setSelectedSteal(null); }}
                                                                                className="absolute -top-3 -right-3 w-8 h-8 bg-black border-2 border-purple-500 rounded-full flex items-center justify-center text-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:bg-purple-500 hover:text-white hover:scale-110 transition-all z-[60] animate-in zoom-in spin-in"
                                                                            >
                                                                                <X size={14} strokeWidth={3} />
                                                                            </button>
                                                                        )}
                                                                        <div className="scale-75 sm:scale-90">
                                                                            <CardVisual card={card} size="small" />
                                                                        </div>
                                                                        {!isSelected && (
                                                                            <div className="absolute inset-x-0 -bottom-6 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all">
                                                                                <div className="bg-purple-500 text-black px-4 py-1.5 rounded-full font-display font-black text-[8px] uppercase tracking-widest">
                                                                                    Select
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </motion.div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        /* LOSER / SPECTATOR VIEW BOX - SMALLER */
                                        <div className="flex flex-col items-center justify-center py-12 bg-black/40 border border-white/5 rounded-[40px] backdrop-blur-3xl w-full max-w-4xl mx-auto">
                                            <div className="mb-6 relative">
                                                <div className="absolute -inset-8 bg-purple-500/10 blur-3xl rounded-full" />
                                                <Biohazard size={48} className="text-purple-500/80 animate-pulse" />
                                            </div>
                                            <h3 className="font-display text-xl font-black text-white uppercase tracking-[0.3em] mb-2 text-center">Under Extraction</h3>
                                            <p className="text-purple-400/40 font-display text-[9px] uppercase tracking-widest mb-8 text-center px-8">Winners are harvesting assets from your tactical array</p>

                                            <div className="flex flex-wrap justify-center gap-4 px-4">
                                                {mySlots.map((c, i) => c && (
                                                    <div key={i} className="opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                                                        <CardVisual card={c} size="small" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(gameState.round_data?.winners?.includes(user?.id) || gameState.round_data?.winners?.includes(myPlayer?.id)) && (
                                        <div className="flex flex-col items-center gap-4 pb-12">
                                            {hasPicked ? (
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="flex items-center gap-3 px-8 py-4 bg-purple-500 text-black rounded-full font-display font-black text-xs uppercase tracking-[0.3em] shadow-[0_0_30px_#a855f7]">
                                                        <CheckCircle2 size={18} />
                                                        Extraction Finalized
                                                    </div>
                                                    <span className="text-[9px] font-mono text-white/30 uppercase tracking-[0.4em] animate-pulse">Waiting for other survivors to conclude asset harvest...</span>
                                                </div>

                                            ) : (
                                                <div className="flex flex-col items-center gap-6">
                                                    <div className="flex flex-col items-center gap-2 opacity-30 grayscale hover:opacity-100 transition-all duration-500">
                                                        <div className="flex items-center gap-3 px-8 py-4 border-2 border-purple-500/20 text-purple-500/40 rounded-full font-display font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">
                                                            Select Asset for Immediate Extraction
                                                        </div>
                                                        <span className="text-[8px] font-mono text-white/10 uppercase tracking-[0.4em]">Protocol: Direct Uplink</span>
                                                    </div>

                                                    <button
                                                        onClick={() => { setHasPicked(true); setOpponentSlots([]); }}
                                                        className="px-16 py-5 bg-white/[0.03] border border-white/5 rounded-full font-display text-[10px] font-black tracking-[0.5em] text-white/40 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all uppercase group"
                                                    >
                                                        <span className="flex items-center gap-4">
                                                            Pass Extraction
                                                            <X size={16} className="text-purple-500/50 group-hover:text-purple-500 group-hover:rotate-90 transition-all" />
                                                        </span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </div>
                    )
                }

                {/* HAND AREA - Gated to relevant phases */}
                {
                    ['slotting', 'evaluation', 'scoring'].includes(gameState?.phase || '') && gameState?.phase !== 'idle' && (
                        <div className="w-full -mt-4 flex flex-col items-center">
                            {/* Label Section - Still constrained to 6xl for alignment */}
                            <div className="w-full max-w-6xl px-4 flex items-center gap-6 mb-2">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                <span className="text-[10px] font-display font-black text-white/20 uppercase tracking-[0.5em] flex items-center gap-3">
                                    <Swords size={14} className="text-purple-500/50" />
                                    Tactical Assets Available :: {myHand.filter(c => !mySlots.some(s => s?.id === c.id)).length}
                                </span>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            </div>

                            {/* Cards Row - Robust Centering + Scroll */}
                            <div
                                ref={handScrollerRef}
                                className="w-full max-w-full overflow-x-auto custom-scrollbar touch-pan-x pb-4 pt-12 mt-4 scroll-smooth block relative z-[30] border-y border-white/5 bg-black/5 pointer-events-auto"
                                style={{ WebkitOverflowScrolling: 'touch', minHeight: '180px' }}
                            >
                                <div className="flex flex-nowrap justify-center sm:justify-center items-end gap-6 sm:gap-10 px-12 py-6 min-w-full w-fit mx-auto h-full">
                                    <AnimatePresence mode="popLayout">
                                        {myHand.map(card => {
                                            const isSlotted = mySlots.some(s => s?.id === card.id);
                                            if (isSlotted) return null;

                                            return (
                                                <motion.div
                                                    key={card.id}
                                                    layoutId={card.id}
                                                    drag={!isLocked && gameState?.phase === 'slotting'}
                                                    dragSnapToOrigin
                                                    dragListener={!isLocked}
                                                    onDragEnd={(e, info) => handleDragEnd(e, info, card)}
                                                    whileDrag={{ scale: 1.1, zIndex: 100, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.5 }}
                                                    whileHover={{ y: -10, scale: 1.05, zIndex: 10 }}
                                                    className={`shrink-0 ${isLocked ? "opacity-50 grayscale cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
                                                    onClick={() => {
                                                        if (gameState?.phase !== 'slotting' || isLocked) return;
                                                        const emptyIdx = mySlots.findIndex(s => s === null);
                                                        if (emptyIdx !== -1) handleSlotCard(card, emptyIdx);
                                                    }}
                                                >
                                                    <CardVisual card={card} />
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* ACTION BUTTON */}
                <AnimatePresence>
                    {gameState?.phase === 'slotting' && (
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="fixed bottom-8 left-0 right-0 flex justify-center z-[500] pointer-events-none"
                        >
                            <div className="relative group/container pointer-events-auto">
                                <button
                                    onClick={handleConfirmSlots}
                                    disabled={isLocked || (mySlots.filter(s => s !== null).length === 5 && powerUsage.hasUsedFiveSlots)}
                                    className={`group relative px-16 py-5 font-black uppercase tracking-[0.2em] text-sm overflow-hidden transition-all duration-500 ${isLocked || (mySlots.filter(s => s !== null).length === 5 && powerUsage.hasUsedFiveSlots) ? 'bg-gray-800 cursor-not-allowed opacity-50' : 'bg-purple-600 hover:bg-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] text-black'}`}
                                    style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
                                >
                                    {/* Scanner Sweep Effect */}
                                    <motion.div
                                        animate={{ left: ["-100%", "200%"] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                        className="absolute top-0 bottom-0 w-8 bg-white/40 blur-xl skew-x-12 pointer-events-none"
                                    />

                                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                    <span className="relative flex items-center gap-4">
                                        {isLocked ? "ASSETS LOCKED" : (mySlots.filter(s => s !== null).length === 5 && powerUsage.hasUsedFiveSlots) ? "5-SLOT LIMIT REACHED" : "AUTHORIZE DEPLOYMENT"}
                                        {isLocked || (mySlots.filter(s => s !== null).length === 5 && powerUsage.hasUsedFiveSlots) ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                                    </span>
                                </button>

                                {isLocked && (
                                    <button
                                        onClick={() => setIsLocked(false)}
                                        className="absolute -top-3 -right-3 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(220,38,38,0.6)] hover:bg-red-500 hover:scale-110 transition-all z-[60] group/undo border-2 border-white/20"
                                        title="OVERRIDE LOCK"
                                    >
                                        <X size={20} className="group-hover/undo:rotate-90 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main >
            {
                showPlayerCard && (
                    <PlayerCardModal
                        user={user}
                        onClose={() => setShowPlayerCard(false)}
                    />
                )
            }

            {/* HOLOGRAPHIC TOAST SYSTEM */}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-3 pointer-events-none">
                <AnimatePresence>
                    {protocolToasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 20, scale: 0.9, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
                            className={`px-12 py-5 rounded-none border backdrop-blur-3xl flex items-center gap-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] ${toast.type === 'error' ? 'bg-red-500/20 border-red-500 text-red-100' :
                                toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300' :
                                    'bg-purple-500/10 border-purple-500/50 text-purple-300'
                                }`}
                            style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0% 100%)' }}
                        >
                            <div className={`w-1.5 h-8 ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-emerald-500' : 'bg-purple-500'} animate-pulse shadow-[0_0_15px_currentColor]`} />
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-mono opacity-50 uppercase tracking-[0.4em]">Protocol Notification</span>
                                <span className="text-base lg:text-xl font-black uppercase tracking-[0.1em] font-mono whitespace-nowrap">
                                    {toast.message}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div >
    );
};

const BriefingCard: React.FC<{ title: string; desc: string; delay: number; id?: string; color?: 'purple' | 'green' | 'orange' | 'cyan' | 'red' }> = ({ title, desc, delay, id, color = 'cyan' }) => {
    const colorClasses = {
        cyan: 'from-purple-500/10 to-indigo-500/10 border-purple-500/20 text-purple-500',
        purple: 'from-purple-500/10 to-indigo-500/10 border-purple-500/20 text-purple-500',
        green: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-500',
        orange: 'from-orange-500/10 to-red-500/10 border-orange-500/20 text-orange-500',
        red: 'from-red-500/10 to-rose-500/10 border-red-500/20 text-red-500'
    };

    const mainColorMap = {
        cyan: 'purple',
        purple: 'purple',
        green: 'emerald',
        orange: 'orange',
        red: 'red'
    };

    const mainColor = mainColorMap[color as keyof typeof mainColorMap];

    return (
        <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            whileHover={{ y: -5, scale: 1.01 }}
            className="w-48 xl:w-56 group relative"
        >
            <div className={`relative p-6 border ${colorClasses[color as keyof typeof colorClasses]} bg-black/90 backdrop-blur-xl group-hover:bg-black/80 transition-all flex flex-col items-center justify-center min-h-[320px] shadow-2xl rounded-none`}
            >
                {/* Visual tech line across top */}
                <div className={`absolute top-0 left-0 right-0 h-[1px] bg-${mainColor}-500/30 opacity-20 group-hover:opacity-100 transition-opacity`} />

                {/* ID Label */}
                <div className="absolute top-4 left-6 right-6 flex items-center justify-between opacity-40 group-hover:opacity-100 transition-opacity">
                    <span className="text-[6px] font-black uppercase tracking-[0.2em] font-mono text-white">X-RAY STREAM</span>
                    <span className="text-[7px] font-mono text-white tracking-widest leading-none">
                        {id || Math.random().toString(16).substring(2, 8).toUpperCase()}
                    </span>
                </div>

                {/* Central Iconography */}
                <div className="relative mb-8 group-hover:scale-110 transition-transform duration-500">
                    <div className={`absolute inset-0 bg-${mainColor}-500/10 blur-xl rounded-full scale-125`} />
                    <div className={`relative p-4 border border-white/5 bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} rounded-xl`}>
                        {color === 'purple' && <Biohazard size={24} className="text-purple-400" />}
                        {color === 'red' && <Biohazard size={24} className="text-red-400" />}
                        {color === 'green' && <Syringe size={24} className="text-emerald-400" />}
                        {color === 'orange' && <Skull size={24} className="text-orange-400" />}
                        {color === 'cyan' && <Shield size={24} className="text-purple-400" />}
                    </div>
                </div>

                <h4 className={`font-cinzel text-base uppercase tracking-[0.2em] mb-4 text-white text-center leading-none`}>
                    {title}
                </h4>

                <div className={`h-[1px] w-8 bg-${mainColor}-500/40 mb-5 rounded-full`} />

                <p className="text-[11px] font-cinzel text-gray-400 group-hover:text-white/80 leading-relaxed font-bold uppercase tracking-[0.05em] text-center px-1">
                    {desc}
                </p>

                {/* Technical lines at bottom */}
                <div className="absolute bottom-4 left-6 right-6 flex items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                    <div className={`flex-1 h-[1px] bg-${mainColor}-500/30`} />
                    <div className={`w-1 h-1 rounded-full bg-${mainColor}-400`} />
                    <div className={`w-1 h-1 rounded-full bg-${mainColor}-400/50`} />
                </div>
            </div>
        </motion.div>
    );
};

const TerminalBox: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="relative group flex flex-col h-full rounded-2xl border border-white/5 bg-[#0a0a0f]/50 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2">
                <span className="text-purple-500">{icon}</span>
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">{title}</span>
            </div>
            <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
            </div>
        </div>
        <div className="p-6 flex-1">
            {children}
        </div>
    </div>
);

// --- VISUAL COMPONENTS ---

function CardVisual({ card, size = 'default' }: { card: DiamondsCard; size?: 'default' | 'small' | 'mini' | 'full' }) {
    const imgSrc = getCardImagePath(card);

    // Special Cards
    if (card.type === 'special') {
        let borderColor = 'border-gray-500';
        let glow = '';

        if (card.specialType === 'zombie') {
            borderColor = 'border-purple-500';
            glow = 'shadow-[0_0_30px_rgba(168,85,247,0.3)]';
        }
        if (card.specialType === 'injection') {
            borderColor = 'border-green-500';
            glow = 'shadow-[0_0_30px_rgba(34,197,94,0.3)]';
        }
        if (card.specialType === 'shotgun') {
            borderColor = 'border-orange-500';
            glow = 'shadow-[0_0_30px_rgba(249,115,22,0.3)]';
        }

        const sizeClasses = size === 'mini' ? 'w-14 h-20' : size === 'small' ? 'w-20 h-28' : size === 'full' ? 'w-full h-full' : 'w-20 h-28 sm:w-24 sm:h-36';
        return (
            <div className={`${sizeClasses} rounded-2xl border-2 ${borderColor} ${glow} flex flex-col items-center justify-center relative overflow-hidden bg-black group`}>

                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent z-10 opacity-30" />
                <img
                    src={imgSrc}
                    alt={card.specialType}
                    className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] pointer-events-none" />
            </div>
        );
    }

    // Standard Cards
    const sizeClasses = size === 'mini' ? 'w-14 h-20' : size === 'small' ? 'w-20 h-28' : size === 'full' ? 'w-full h-full' : 'w-20 h-28 sm:w-24 sm:h-36';
    return (
        <div className={`${sizeClasses} rounded-2xl border border-white/20 flex flex-col items-center justify-center relative overflow-hidden bg-white shadow-2xl group transition-all duration-300 hover:shadow-purple-500/20`}>
            <img
                src={imgSrc}
                alt={`${card.rank} of ${card.suit}`}
                className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 border-2 border-black/5 rounded-xl pointer-events-none" />
        </div>
    );
}
