import React, { useState, useEffect, useRef } from 'react';
import { supabaseUrl, supabaseKey, getAccessToken } from '../../supabaseClient';
import type { DiamondsGameState, DiamondsPhase, DiamondsPlayer, DiamondsCard } from '../../game/diamonds';
import { generateDiamondsDeck, dealHands } from '../../game/diamonds/actions/dealing';
import { assignGroups } from '../../game/diamonds/actions/shuffling';
import { evaluateRound } from '../../game/diamonds/actions/evaluation';
import { resolveSteals } from '../../game/diamonds/actions/picking';
import { updateScores } from '../../game/diamonds/actions/scoring';

interface DiamondsGameMasterProps {
    isEngine?: boolean;
}

const GAME_ID = 'diamonds_king';

const PHASE_TIMINGS: Record<DiamondsPhase, number> = {
    idle: 0,
    briefing: 30,
    shuffle: 15,
    dealing: 10,
    slotting: 80,
    evaluation: 45,
    picking: 25,
    scoring: 0,
    end: 0
};

export const DiamondsGameMaster: React.FC<DiamondsGameMasterProps> = ({ isEngine = false }) => {
    const [phase, setPhase] = useState<DiamondsPhase>('idle');
    const [round, setRound] = useState(1);
    const [isPaused, setIsPaused] = useState(false);
    const [participants, setParticipants] = useState<DiamondsPlayer[]>([]);
    const [roundData, setRoundData] = useState<any>({});
    const [_timeLeft, setTimeLeft] = useState(0);

    const phaseStartedAtRef = useRef<Date | null>(null);
    const phaseDurationRef = useRef<number>(0);
    const phaseRef = useRef<DiamondsPhase>('idle');
    const roundRef = useRef(1);
    const participantsRef = useRef<DiamondsPlayer[]>([]);
    const roundDataRef = useRef<any>({});
    const isProcessingRef = useRef(false);

    // Keep refs synchronized with state
    useEffect(() => {
        phaseRef.current = phase;
        roundRef.current = round;
        participantsRef.current = participants;
        roundDataRef.current = roundData;
    }, [phase, round, participants, roundData]);

    // --- State Fetching & Sync (1000ms Polling Loop) ---
    useEffect(() => {
        if (!isEngine) return;

        let isFetchingSync = false;

        const fetchState = async () => {
            if (isFetchingSync) return;
            isFetchingSync = true;
            try {
                const accessToken = await getAccessToken();
                const response = await fetch(`${supabaseUrl}/rest/v1/diamonds_game_state?id=eq.${GAME_ID}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'apikey': supabaseKey,
                        'Accept': 'application/vnd.pgrst.object+json'
                    },
                    cache: 'no-store'
                });

                if (!response.ok) {
                    console.error('[DIAMONDS ENGINE] Sync Fetch Error:', await response.text());
                    return;
                }

                const data: DiamondsGameState = await response.json();

                if (data) {
                    if (data.phase_started_at) {
                        let dStr = data.phase_started_at.replace(' ', 'T');
                        if (dStr.match(/[+-]\d{2}$/)) dStr += ':00';
                        if (!dStr.endsWith('Z') && !dStr.match(/[+-]\d{2}:?\d{2}$/)) dStr += 'Z';
                        const fetchedStart = new Date(dStr);

                        // Ignore stale state updates caused by DB read-replica lag or caching
                        if (phaseStartedAtRef.current && fetchedStart.getTime() < phaseStartedAtRef.current.getTime()) {
                            return;
                        }
                    }

                    if (data.phase && data.phase !== phaseRef.current) setPhase(data.phase);
                    if (data.current_round && data.current_round !== roundRef.current) setRound(data.current_round);
                    if (data.participants && JSON.stringify(data.participants) !== JSON.stringify(participantsRef.current)) {
                        setParticipants(data.participants);
                    }
                    if (data.round_data && JSON.stringify(data.round_data) !== JSON.stringify(roundDataRef.current)) {
                        setRoundData(data.round_data || {});
                    }
                    if (data.is_paused !== undefined) setIsPaused(data.is_paused);

                    if (data.phase_started_at && data.phase_duration_sec) {
                        let dStr = data.phase_started_at.replace(' ', 'T');
                        if (dStr.match(/[+-]\d{2}$/)) dStr += ':00';
                        if (!dStr.endsWith('Z') && !dStr.match(/[+-]\d{2}:?\d{2}$/)) dStr += 'Z';
                        const newStart = new Date(dStr);
                        if (newStart.getTime() !== phaseStartedAtRef.current?.getTime()) {
                            phaseStartedAtRef.current = newStart;
                            phaseDurationRef.current = data.phase_duration_sec;
                        }
                    }
                }
            } catch (err) {
                console.error('[DIAMONDS ENGINE] Sync Fetch Exception:', err);
            } finally {
                isFetchingSync = false;
            }
        };

        fetchState();
        const syncInterval = setInterval(fetchState, 1000);
        return () => clearInterval(syncInterval);
    }, [isEngine]);

    // --- Phase Advancement Engine (Identical to Spades advancePhase) ---
    const advancePhase = async () => {
        try {
            const currentPhase = phaseRef.current;
            const currentRound = roundRef.current;

            console.log(`[DIAMONDS ENGINE] Advancing from ${currentPhase} (Round ${currentRound})`);

            let nextPhase: DiamondsPhase = 'idle';
            let nextRound = currentRound;
            let updatedParticipants: DiamondsPlayer[] = JSON.parse(JSON.stringify(participantsRef.current || []));
            let tempRoundData: any = JSON.parse(JSON.stringify(roundDataRef.current || {}));

            const accessToken = await getAccessToken();

            if (currentPhase === 'briefing') {
                nextPhase = 'shuffle';
                nextRound = 1;
                // Fetch allowed players
                let candidateIds: string[] = [];
                const stateRes = await fetch(`${supabaseUrl}/rest/v1/diamonds_game_state?id=eq.${GAME_ID}&select=allowed_players`, {
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' }
                });
                if (stateRes.ok) {
                    const st = await stateRes.json();
                    candidateIds = st?.allowed_players || [];
                }

                // If candidateIds empty, fetch active profiles
                if (candidateIds.length === 0) {
                    const profRes = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,username&limit=10`, {
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey }
                    });
                    if (profRes.ok) {
                        const profs = await profRes.json();
                        candidateIds = (profs || []).map((p: any) => p.id);
                    }
                }

                // Fetch ALL profiles in batch (prevents HTTP 406 & missing username fallback)
                const profileMap: Record<string, { username: string; visa_points: number }> = {};
                try {
                    const profsRes = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,username,visa_points`, {
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Accept': 'application/json' }
                    });
                    if (profsRes.ok) {
                        const profsData = await profsRes.json();
                        const list = Array.isArray(profsData) ? profsData : [profsData];
                        list.forEach((p: any) => {
                            if (p.id) {
                                profileMap[p.id] = { username: p.username || p.id, visa_points: p.visa_points ?? 1000 };
                            }
                            if (p.username) {
                                profileMap[p.username] = { username: p.username, visa_points: p.visa_points ?? 1000 };
                            }
                        });
                    }
                } catch (e) {
                    console.warn('[DIAMONDS ENGINE] All profiles fetch error:', e);
                }

                // Initialize participants with real username priority
                let pNum = 1;
                const initialized: DiamondsPlayer[] = candidateIds.map(pid => {
                    const prof = profileMap[pid];
                    const realName = prof?.username && !prof.username.startsWith('Player #') ? prof.username : undefined;
                    const finalName = realName || (pid.includes('-') ? `Player ${pNum++}` : pid);
                    return {
                        id: pid,
                        username: finalName,
                        score: prof?.visa_points ?? 1000,
                        cards: [],
                        slots: [null, null, null, null, null],
                        status: 'active'
                    };
                });

                updatedParticipants = assignGroups(initialized);
                tempRoundData = { session_deck: [] };
            }
            else if (currentPhase === 'shuffle') {
                nextPhase = 'dealing';
                // Ensure groups are assigned
                updatedParticipants = assignGroups(updatedParticipants);
            }
            else if (currentPhase === 'dealing') {
                nextPhase = 'slotting';
                if (currentRound === 1) {
                    let sessionDeck: DiamondsCard[] = tempRoundData?.session_deck || [];
                    if (sessionDeck.length === 0) {
                        sessionDeck = generateDiamondsDeck(updatedParticipants.length);
                    }

                    const { updatedParticipants: dealtParticipants, remainingDeck } = dealHands(sessionDeck, updatedParticipants);
                    updatedParticipants = (dealtParticipants || []).map(p => p ? { ...p, slots: [null, null, null, null, null] } : p);

                    tempRoundData = {
                        ...tempRoundData,
                        session_deck: remainingDeck || []
                    };
                } else {
                    // Round 2+: Keep existing hand from Round 1 (do not re-deal random cards). Reset slots only.
                    updatedParticipants = (updatedParticipants || []).map(p => p ? { ...p, slots: [null, null, null, null, null] } : p);
                }

                // FAILSAFE: Guarantee every active participant gets cards assigned if cards are empty
                const freshDeck = generateDiamondsDeck(updatedParticipants.length || 1);
                updatedParticipants = updatedParticipants.map((p, idx) => {
                    if (!p) return p;
                    if (!p.cards || p.cards.length === 0) {
                        console.log(`[DIAMONDS_ENGINE] Participant ${p.username || p.id} has 0 cards! Auto-assigning hand...`);
                        const pHand = freshDeck.slice(idx * 7, (idx + 1) * 7);
                        return {
                            ...p,
                            cards: pHand.length >= 5 ? pHand : generateDiamondsDeck(1).slice(0, 7),
                            slots: [null, null, null, null, null]
                        };
                    }
                    return p;
                });
            }
            else if (currentPhase === 'slotting') {
                nextPhase = 'evaluation';
                // Autofill missing slots for AFK players immutably & consume ALL placed cards (single use)
                const slotsMap = new Map<string, (DiamondsCard | null)[]>();
                updatedParticipants = (updatedParticipants || []).map(p => {
                    if (!p || p.status !== 'active') return p;
                    let pSlots = Array.isArray(p.slots) ? [...p.slots] : [null, null, null, null, null];
                    const cardsCount = pSlots.filter(s => s !== null && s !== undefined).length;

                    let extraPenalty = 0;
                    if (cardsCount === 0) {
                        // Keep slots empty if player selected 0 cards. Duel loss in updateScores applies -100 CR (no double penalty)
                        pSlots = [null, null, null, null, null];
                        extraPenalty = -100;
                    }
                    slotsMap.set(p.id, pSlots);

                    // SPECIAL CARDS 1-TIME USE: Only discard slotted special cards from player's hand. Standard cards are retained!
                    const placedSpecialCardIds = new Set(pSlots.filter(s => s && (s.type === 'special' || s.specialType)).map(s => s!.id));
                    let updatedHand = p.cards || [];
                    if (placedSpecialCardIds.size > 0) {
                        updatedHand = updatedHand.filter(c => !placedSpecialCardIds.has(c.id));
                    }

                    return {
                        ...p,
                        cards: updatedHand,
                        slots: pSlots, // Preserve slots during evaluation & picking phases for conflict analysis and stealing
                        roundBonus: (p.roundBonus || 0) + extraPenalty
                    };
                });

                const { results, updatedParticipants: evalParticipants } = evaluateRound(updatedParticipants, slotsMap);
                const isFinalRound = currentRound === 5;
                const { updatedParticipants: scoredParticipants } = updateScores(evalParticipants, results || [], isFinalRound);

                updatedParticipants = (scoredParticipants || []).map(p => {
                    if (!p || p.status !== 'active') return p;
                    if (!p.cards || p.cards.length === 0) {
                        return { ...p, status: 'eliminated' as const };
                    }
                    return p;
                });

                const allWinners = (results || []).reduce((acc: string[], r) => [...acc, ...(r?.winners || [])], []);
                const allLosers = (results || []).reduce((acc: string[], r) => [...acc, ...(r?.losers || [])], []);
                const allEliminated = (results || []).reduce((acc: string[], r) => [...acc, ...(r?.eliminatedIds || [])], []);
                const allEffects = (results || []).reduce((acc: any[], r) => [...acc, ...(r?.effects || [])], []);

                tempRoundData = {
                    ...tempRoundData,
                    results: results || [],
                    winners: allWinners,
                    losers: allLosers,
                    effects: allEffects,
                    eliminated: Array.from(new Set([...allEliminated, ...(updatedParticipants || []).filter(p => p && p.status === 'eliminated').map(p => p.id)]))
                };
            }
            else if (currentPhase === 'evaluation') {
                nextPhase = 'picking';
                const battleResults = tempRoundData?.results || [];
                const { pendingSteals } = resolveSteals(updatedParticipants, battleResults);

                tempRoundData = {
                    ...tempRoundData,
                    pending_steals: pendingSteals
                };
            }
            else if (currentPhase === 'picking') {
                if (currentRound >= 5) {
                    nextPhase = 'end';
                } else {
                    nextPhase = 'shuffle';
                    nextRound = currentRound + 1;
                    // Reset slots for all players for the new round
                    updatedParticipants = (updatedParticipants || []).map(p => p ? { ...p, slots: [null, null, null, null, null] } : p);
                }
            }

            const nextDuration = PHASE_TIMINGS[nextPhase] || 0;
            const nowIso = new Date().toISOString();

            const updatePayload: any = {
                phase: nextPhase,
                current_round: nextRound,
                phase_started_at: nowIso,
                phase_duration_sec: nextDuration,
                participants: updatedParticipants,
                round_data: tempRoundData,
                updated_at: nowIso
            };

            // --- CRITICAL OPTIMISTIC UPDATE ---
            // Instantly advance local refs and state so the 100ms timer loop computes positive realTimeLeft
            // on the very next tick. This completely eliminates timer loops!
            const newStart = new Date(nowIso);
            phaseStartedAtRef.current = newStart;
            phaseDurationRef.current = nextDuration;
            setPhase(nextPhase);
            setRound(nextRound);
            setParticipants(updatedParticipants);
            setRoundData(tempRoundData);

            // Execute PATCH via raw REST fetch (no Supabase JS locks)
            const patchRes = await fetch(`${supabaseUrl}/rest/v1/diamonds_game_state?id=eq.${GAME_ID}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': supabaseKey,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(updatePayload)
            });

            if (!patchRes.ok) {
                console.error(`[DIAMONDS ENGINE] Update failed! Status: ${patchRes.status}`, await patchRes.text());
            } else {
                console.log(`[DIAMONDS ENGINE] Advanced successfully to ${nextPhase} (Round ${nextRound})`);
            }
        } catch (err) {
            console.error('[DIAMONDS ENGINE] Exception during advancePhase:', err);
        } finally {
            isProcessingRef.current = false;
        }
    };

    // --- 100ms Timer Loop (Identical to SpadesGameMaster) ---
    useEffect(() => {
        if (!isEngine || phase === 'idle' || phase === 'end') return;

        const timer = setInterval(() => {
            if (isPaused) return;

            let realTimeLeft = 0;
            if (phaseStartedAtRef.current && phaseDurationRef.current) {
                const now = new Date();
                const elapsed = Math.floor((now.getTime() - phaseStartedAtRef.current.getTime()) / 1000);
                realTimeLeft = Math.max(0, phaseDurationRef.current - elapsed);
            }

            setTimeLeft(realTimeLeft);

            if (realTimeLeft === 0 && !isProcessingRef.current) {
                console.log(`[DIAMONDS ENGINE] Timer hit 0s for phase ${phaseRef.current}. Advancing...`);
                isProcessingRef.current = true;
                advancePhase();
            }
        }, 100);

        return () => clearInterval(timer);
    }, [isEngine, phase, isPaused]);

    return null;
};
