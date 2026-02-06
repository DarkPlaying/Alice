import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Play, Users } from 'lucide-react';

import {
    type Card,
    type PlayersMap,
    type RoundData,
    type SpadesPhase,
    applyGameFailurePenalty,
    buildHint,
    generateDeck,
    selectRandomCard,
    removeCardFromDeck,
    awardCard,
    applyBidDeductions,
    generateRoundTypesSequence,
    selectCardByType,
    type TargetType
} from '../../game/spades';

interface SpadesGameMasterProps {
    onComplete: (score: number) => void;
    user?: any;
}

const GAME_ID = 'spades_main';
const MAX_ROUNDS = 5;

// Phase durations in seconds
const PHASE_DURATIONS: Record<SpadesPhase, number> = {
    idle: 0,
    briefing: 60,
    shuffle: 30,
    hint: 10,
    bidding: 60,
    reveal: 15,
    completed: 0
};

export const SpadesGameMaster: React.FC<SpadesGameMasterProps> = ({ onComplete, user }) => {
    // --- State ---
    const [phase, setPhase] = useState<SpadesPhase>('idle');
    const [round, setRound] = useState(1);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [players, setPlayers] = useState<PlayersMap>({});
    const [roundData, setRoundData] = useState<RoundData>({}); // Map of groupId -> Round Info

    // Refs for avoiding stale closures
    const phaseRef = useRef<SpadesPhase>('idle');
    const roundRef = useRef(1);
    const deckRef = useRef<Card[]>(generateDeck());
    const isProcessingRef = useRef(false);
    const phaseStartedAtRef = useRef<Date | null>(null);
    const phaseDurationRef = useRef<number>(0);

    // Store pre-calculated target cards for each group (5 per group)
    const groupTargetsRef = useRef<Record<number, Card[]>>({});
    // Store the Global Round Type Sequence (shuffled 5 types)
    const roundTypesRef = useRef<TargetType[]>(generateRoundTypesSequence());

    // Sync refs
    useEffect(() => { phaseRef.current = phase; }, [phase]);
    useEffect(() => { roundRef.current = round; }, [round]);

    // --- Helper: Assign Groups & Generate Targets ---
    const assignPlayerGroups = (currentPlayers: PlayersMap): PlayersMap => {
        // Fisher-Yates Shuffle for robust randomization
        const ids = Object.keys(currentPlayers);
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        const n = ids.length;
        const newPlayers = { ...currentPlayers };

        let groups: string[][] = [];

        if (n < 2) {
            groups.push(ids);
        } else if (n === 2 || n === 3) {
            groups.push(ids);
        } else if (n === 4) {
            groups.push(ids.slice(0, 2));
            groups.push(ids.slice(2, 4));
        } else if (n === 5) {
            groups.push(ids.slice(0, 3));
            groups.push(ids.slice(3, 5));
        } else {
            // N > 5: Partition into 3s and 2s
            let remaining = ids;
            while (remaining.length > 0) {
                if (remaining.length === 2 || remaining.length === 4) {
                    groups.push(remaining.slice(0, 2));
                    remaining = remaining.slice(2);
                } else {
                    groups.push(remaining.slice(0, 3));
                    remaining = remaining.slice(3);
                }
            }
        }

        // Reset Group Targets for THIS round
        groupTargetsRef.current = {};

        // Determine the Target Type for this round (Global)
        // roundRef.current is 1-indexed. Array is 0-indexed.
        // Safety check: if round > 5, fallback to random.
        const currentType = roundTypesRef.current[(roundRef.current - 1)] || 'low';

        // Assign Group IDs and Generate Curated Targets
        groups.forEach((groupParams, idx) => {
            const groupId = idx + 1;
            groupParams.forEach(pid => {
                if (newPlayers[pid]) newPlayers[pid].groupId = groupId;
            });

            // Generate 1 Card for this group matching the Round Type
            let result = selectCardByType(deckRef.current, currentType);

            // Fallback if deck runs dry of that type (should differ only if >50 cards played)
            if (!result) {
                const rnd = selectRandomCard(deckRef.current);
                if (rnd) {
                    result = { card: rnd, remainingDeck: removeCardFromDeck(deckRef.current, rnd) };
                }
            }

            if (result) {
                // Store as an array [card] specifically for this round
                groupTargetsRef.current[groupId] = [result.card];
                deckRef.current = result.remainingDeck;
                console.log(`[SPADES MASTER] Group ${groupId} Target Generated (${currentType}): ${result.card.rank}${result.card.suit}`);
            } else {
                console.error(`[SPADES MASTER] Deck Empty! Group ${groupId} gets no card.`);
            }
        });

        console.log('[SPADES MASTER] Groups Assigned:', groups.map((g, i) => `G${i + 1}: ${g.length}`));
        console.log('[SPADES MASTER] Remaining Main Deck Size:', deckRef.current.length);

        return newPlayers;
    };

    // --- Initial State Fetch ---
    useEffect(() => {
        const fetchInitialState = async () => {
            const { data, error } = await supabase
                .from('spades_game_state')
                .select('*')
                .eq('id', GAME_ID)
                .maybeSingle();

            if (error) {
                console.error('[SPADES MASTER] Fetch error:', error);
                return;
            }

            if (data) {
                console.log('[SPADES MASTER] Restoring state:', data.phase, 'Round:', data.current_round);

                if (data.phase) setPhase(data.phase);
                if (data.current_round) setRound(data.current_round);
                if (data.players) setPlayers(data.players);
                if (data.round_data) setRoundData(data.round_data || {});
                if (data.is_paused !== undefined) setIsPaused(data.is_paused);

                // Restore timer state
                if (data.phase_started_at && data.phase_duration_sec) {
                    phaseStartedAtRef.current = new Date(data.phase_started_at);
                    phaseDurationRef.current = data.phase_duration_sec;
                }
            }
        };

        fetchInitialState();
    }, []);

    // --- Realtime Subscriptions ---
    useEffect(() => {
        console.log('[SPADES MASTER] Setting up Realtime subscriptions...');

        const channel = supabase
            .channel('spades_master')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'spades_game_state',
                filter: `id = eq.${GAME_ID}`
            }, (payload) => {
                const newData = payload.new;

                // Admin controls
                if (newData.is_paused !== undefined) setIsPaused(newData.is_paused);

                // Admin start signal
                if (newData.system_start === true && phaseRef.current === 'idle' && !isProcessingRef.current) {
                    isProcessingRef.current = true;
                    initializeGame();
                }

                // Admin reset signal
                if (newData.phase === 'idle' && newData.system_start === false && phaseRef.current !== 'idle') {
                    resetGame();
                }

                // Update players if changed externally (from bids)
                if (newData.players) setPlayers(newData.players);

                // Update round data if changed externally
                if (newData.round_data) setRoundData(newData.round_data || {});
            })
            .subscribe((status) => {
                console.log('[SPADES MASTER] Subscription status:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // --- Game Timer ---
    useEffect(() => {
        if (phase === 'idle' || phase === 'completed') return;

        const timer = setInterval(() => {
            if (isPaused) return;

            const startedAt = phaseStartedAtRef.current;
            const duration = phaseDurationRef.current;

            if (startedAt && duration > 0) {
                const now = new Date();
                const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
                const remaining = Math.max(0, duration - elapsed);

                setTimeLeft(remaining);

                if (remaining === 0 && !isProcessingRef.current) {
                    isProcessingRef.current = true; // Lock immediately

                    // Define next phase logic locally
                    let next: SpadesPhase = 'idle';
                    let nextRound = roundRef.current;
                    const p = phaseRef.current;

                    if (p === 'briefing') next = 'shuffle'; // R1: Briefing -> Shuffle
                    else if (p === 'shuffle') next = 'hint';
                    else if (p === 'hint') next = 'bidding';
                    else if (p === 'bidding') next = 'reveal';
                    else if (p === 'reveal') {
                        if (roundRef.current < MAX_ROUNDS) {
                            next = 'shuffle';
                            nextRound = roundRef.current + 1;
                        } else {
                            next = 'completed';
                        }
                    }

                    transitionToPhase(next, nextRound).catch(err => {
                        console.error("[SPADES MASTER] TRANSITION FAILED:", err);
                        isProcessingRef.current = false;
                    });
                }

                // Heartbeat sync
                if (remaining > 0 && remaining % 3 === 0) {
                    const display = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
                    supabase.from('spades_game_state')
                        .update({ timer_display: display })
                        .eq('id', GAME_ID)
                        .eq('phase', phaseRef.current)
                        .then(({ error }) => {
                            if (error) console.warn("Heartbeat sync failed", error.message);
                        });
                }
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [phase, isPaused]);

    // --- Phase Transition Logic ---
    const handlePhaseExpiry = async () => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
            const currentPhase = phaseRef.current;
            const currentRound = roundRef.current;

            switch (currentPhase) {
                case 'briefing': await transitionToPhase('hint'); break;
                case 'shuffle':
                    console.log('[SPADES MASTER] Shuffling teams...');
                    const shuffledPlayers = assignPlayerGroups(players);
                    setPlayers(shuffledPlayers);
                    await transitionToPhase('hint', undefined, { players: shuffledPlayers });
                    break;
                case 'hint': await transitionToPhase('bidding'); break;
                case 'bidding': await resolveBidding(); break;
                case 'reveal':
                    if (currentRound >= MAX_ROUNDS) {
                        await endGame();
                    } else {
                        await transitionToPhase('shuffle', currentRound + 1);
                    }
                    break;
            }
        } catch (error) {
            console.error('[SPADES MASTER] Phase transition error:', error);
        } finally {
            isProcessingRef.current = false;
        }
    };

    // --- Phase Transition Helper ---
    const transitionToPhase = async (nextPhase: SpadesPhase, overrideRound?: number, extraData: any = {}) => {
        const duration = PHASE_DURATIONS[nextPhase];
        const now = new Date();
        const nextRound = overrideRound ?? roundRef.current;

        // 1. Prepare Update Payload
        let updateData: any = {
            phase: nextPhase,
            phase_started_at: now.toISOString(),
            phase_duration_sec: duration,
            current_round: nextRound,
            is_paused: false,
            paused_remaining_sec: null,
            timer_display: `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`,
            ...extraData // players, round_data might be here
        };

        // Deep copy state
        let tempRoundData = extraData.round_data ? { ...extraData.round_data } : { ...roundData };
        let tempPlayers = extraData.players ? { ...extraData.players } : { ...players };

        // --- Logic: Briefing (Shuffle Groups) ---
        if (nextPhase === 'briefing') {
            // Re-assign groups at start of briefing for new round?
            // Wait, requirement says "5 round bedding must be random".
            // Does this mean we keep the SAME group for 5 rounds, or shuffle?
            // Previous instruction: "Round-Based Shuffling: Re-shuffle players into new pods at the start of each round."
            // But this new instruction says "logic in each pair 5 round bedding".
            // If we shuffle every round, we can't have a 5-round sequence for a specific pair.
            // INTERPRETATION: Groups are assigned ONCE at start (or re-assigned, but targets are 5-deep).
            // Actually, if we shuffle groups every round, we need to generate a target for that NEW group for that SPECIFIC round.
            // But the requirement "2 less 8, one + face, one - face..." implies a set of 5 rounds *as a whole*.
            // This implies groups should persist OR we need to guarantee the *global* round index 1-5 maps to these types regardless of group.
            // Let's assume we maintain the "Shuffle Groups" logic for dynamic play, BUT we generate the *target card* based on the Round Number to fit the distribution?
            // NO, the user said "randomly... format".
            // If players shuffle, "Group 1" in Round 2 is different people than "Group 1" in Round 1.
            // So the "sequence" applies to the *Table* (Group ID) for the duration of the game.

            // Re-assign groups logic (PRESERVED from previous step)
            tempPlayers = assignPlayerGroups(tempPlayers);
            updateData.players = tempPlayers;

            // Clear old round data
            tempRoundData = {};
            updateData.round_data = tempRoundData;
        }

        // --- Logic: Hint (Pop Target from Curated Sequence) ---
        if (nextPhase === 'hint') {
            const newGroupData: RoundData = {};

            // Identify active groups
            const groupIds = new Set<number>();
            Object.values(tempPlayers as PlayersMap).forEach(p => {
                if (p.groupId) groupIds.add(p.groupId);
            });

            // Generate card for each group
            groupIds.forEach(gid => {
                // Peek at the pre-generated sequence
                // We generated 5 cards in assignPlayerGroups. 
                // However, assignPlayerGroups is called EVERY briefing (every round).
                // If we recall assignPlayerGroups every round, we regenerate the 5-card sequence every round. 
                // That might be wrong if we want a "5 round structure".
                // ERROR: If we shuffle groups every round, we can't guarantee a 5-round narrative for a specific group.
                // BUT, the prompt says "re-shuffle players into new pods at the start of each round".
                // AND "5 round bedding must be random of two less 8...".
                // Solution: We generate a 5-card sequence *per Group ID* (Table 1, Table 2).
                // Even though players move tables, Table 1 will follow the pattern.
                // Since we call assignPlayerGroups each round, we need to adapt it to NOT regenerate if it implies a full reset.
                // Actually, assignPlayerGroups generates `result.selected` (5 cards).
                // We should just take the FIRST card from that generation since we only need 1 for this round.
                // Wait, if we regenerate every round, we might get "Red Face" every round if we are unlucky (random).
                // To enforce the distribution across 5 rounds, we need to coordinate the rounds.
                // Better approach: Generate the distribution based on the ROUND NUMBER?
                // No, "randomly".
                // Only way to ensure 2 low, 1 high, etc over 5 rounds is if the sequence is fixed at Game Start.
                // But groups are re-made every round.
                // So Table 1 in Round 2 is "new".
                // Let's assume the "Table" (e.g. Table 1) maintains the deck integrity.
                // So if we are in Round X, we take the Xth card from the sequence generated at GAME START.
                // ISSUE: assignPlayerGroups is called at 'briefing'.
                // If we move assignPlayerGroups to only happen once (Game Start), we lose shuffling.
                // If we keep shuffling, we are re-generating targets.
                // COMPROMISE: We will generate the 5-card sequence *inside* assignPlayerGroups, BUT...
                // Actually, if we just want the *current round* to have a target, we should just ask:
                // "What 'type' of card should Round X be?" -> Can't do that if it's random order.
                // OK, we will assume the "Curated Sequence" applies to the *Table* (Group ID) for the full 5 rounds.
                // Even if players swap in/out, Table 1 will see the 5-card pattern.
                // So we need to Generate Targets ONLY ONCE at Game Start, or persist them.
                // assignPlayerGroups is currently resetting `groupTargetsRef.current = {}`.
                // FIX: Only generate targets if they don't exist? Or keyed by Round?
                // Since we shuffle groups, the number of groups might change (e.g. players drop out?).
                // Let's trust `assignPlayerGroups` to handle the player shuffling.
                // But regarding targets, let's Generate a MASTER SEQUENCE for "Table 1", "Table 2", etc.
                // independent of the players. 
                // We can do this in `initializeGame`!
                // But `assignPlayerGroups` determines HOW MANY groups there are.
                // Let's modify: `assignPlayerGroups` shuffles players. `initializeGame` or a specific logic manages the decks.

                // Let's stick to the simplest interpretation that works:
                // When AssignGroups runs, it generates 5 cards. We use card [0] for this round.
                // This essentially makes every round random and INDEPENDENT.
                // IT DOES NOT enforce "2 low, 1 high... over 5 rounds" if we regenerate every round.
                // TO FIX: We need to pull from a Persistent Source.
                // `groupTargetsRef` is a Ref. It persists across renders.
                // But `assignPlayerGroups` is clearing it!
                // FIX: Remove `groupTargetsRef.current = {}` from assignPlayerGroups if it's just a shuffle.
                // Only generate if missing.

                // BUT: assignPlayerGroups calculates `groups` (array of arrays).
                // If player count changes, group count changes.
                // If Group 3 didn't exist in Round 1, it needs a sequence now.
                // If Group 3 existed but is now gone, we drop it.

                // REVISED PLAN in CODE below:
                // 1. In assignPlayerGroups, do NOT clear `groupTargetsRef`.
                // 2. Determine needed groups.
                // 3. For each group ID needed:
                //    If `groupTargetsRef.current[groupId]` exists AND has cards, keep it.
                //    Else, generate NEW 5-card sequence.
                //    Wait, if we are in Round 3, and we generate a new sequence, we have 5 cards.
                //    We should probably slice it to match remaining rounds? Or just use it?
                //    Let's just use the first available card.

                // Refinements applied in the code below.

                const targets = groupTargetsRef.current[gid];
                if (targets && targets.length > 0) {
                    const targetCard = targets[0]; // Peek/Pop
                    // Actually pop it from ref?
                    // Let's pop it in the logic below or here.

                    newGroupData[gid] = {
                        target_card: targetCard,
                        hint: buildHint(targetCard),
                        winner_id: null,
                        ties: []
                    };

                    // Remove used card from sequence (so next round gets next card)
                    groupTargetsRef.current[gid] = targets.slice(1);
                } else {
                    // Fallback if ran out of cards (shouldn't happen if 5 generated and 5 rounds)
                    const random = selectRandomCard(deckRef.current);
                    if (random) {
                        newGroupData[gid] = {
                            target_card: random,
                            hint: buildHint(random),
                            winner_id: null,
                            ties: []
                        };
                    }
                }
            });

            tempRoundData = newGroupData;
            updateData.round_data = tempRoundData;
        }

        // --- Logic: Bidding (Reset Bids) ---
        if (nextPhase === 'bidding') {
            Object.keys(tempPlayers).forEach(pid => {
                tempPlayers[pid].bid = null;
            });
            updateData.players = tempPlayers;
        }

        // 2. Database Sync
        const { error } = await supabase.from('spades_game_state').update(updateData).eq('id', GAME_ID);

        // Fallback for Schema Cache errors (timer_display) replaced with simpler handling
        if (error && (error.message?.includes('timer_display') || error.code === 'PGRST204')) {
            delete updateData.timer_display;
            await supabase.from('spades_game_state').update(updateData).eq('id', GAME_ID);
        }

        if (error && !updateData.timer_display) {
            console.error(`[SPADES MASTER] Failed transition to ${nextPhase} `, error);
            return;
        }

        // 3. Local State Update
        phaseStartedAtRef.current = now;
        phaseDurationRef.current = duration;
        phaseRef.current = nextPhase;
        roundRef.current = nextRound;

        setPhase(nextPhase);
        setTimeLeft(duration);
        setRound(nextRound);
        setRoundData(tempRoundData);
        setPlayers(tempPlayers);
    };

    // --- Bid Resolution ---
    const resolveBidding = async () => {
        console.log('[SPADES MASTER] Resolving bidding...');

        // Apply global deductions first
        let updatedPlayers = applyBidDeductions(players);

        // Group players by ID
        const groups: Record<number, string[]> = {};
        Object.values(players).forEach(p => {
            if (p.groupId) {
                if (!groups[p.groupId]) groups[p.groupId] = [];
                groups[p.groupId].push(p.id);
            }
        });

        // Resolve winners per group
        const newRoundData = { ...roundData };

        Object.entries(groups).forEach(([gidStr, memberIds]) => {
            const gid = parseInt(gidStr);
            const groupData = newRoundData[gid];
            if (!groupData || !groupData.target_card) return;

            let highestBid = 0; // Require > 0 to win
            let winners: string[] = [];

            memberIds.forEach(pid => {
                const bid = updatedPlayers[pid]?.bid || 0;
                if (bid > highestBid) {
                    highestBid = bid;
                    winners = [pid];
                } else if (bid === highestBid && bid > 0) {
                    winners.push(pid);
                }
            });

            let winnerId: string | null = null;
            let ties: string[] = [];

            if (winners.length === 0) {
                // No valid bids (>0) - Card Dismissed
                console.log(`[SPADES MASTER] No valid bids for Group ${gid}. Card dismissed.`);
                deckRef.current = removeCardFromDeck(deckRef.current, groupData.target_card);
                winnerId = null;
                ties = [];
            } else if (winners.length === 1) {
                winnerId = winners[0];
                updatedPlayers = awardCard(updatedPlayers, winnerId, groupData.target_card);
                deckRef.current = removeCardFromDeck(deckRef.current, groupData.target_card);
            } else if (winners.length > 1) {
                // TIE: Randomly select ONE winner
                const sortedWinners = winners.sort(); // Sort for consistency in logs, but selection is random
                const randomIndex = Math.floor(Math.random() * sortedWinners.length);
                winnerId = sortedWinners[randomIndex];
                ties = sortedWinners.filter(id => id !== winnerId); // Others are just losers now (or tracked as ties?) 
                // User said: "System decides".
                // We will treat the others as having lost. 
                // We can keep them in 'ties' array for UI display if needed ("Tie broken by system")

                updatedPlayers = awardCard(updatedPlayers, winnerId, groupData.target_card);
                deckRef.current = removeCardFromDeck(deckRef.current, groupData.target_card);
            }

            newRoundData[gid] = {
                ...groupData,
                winner_id: winnerId,
                ties: ties
            };
        });

        setPlayers(updatedPlayers);
        setRoundData(newRoundData);

        // --- PERSISTENCE: Live Visa Points Update (Round-Based) ---
        // Updates visa_points at the end of every round to ensure data safety.
        console.log('[SPADES MASTER] Starting persistence...');
        try {
            const playerIds = Object.values(updatedPlayers).map(p => p.id).filter(id => id.length > 5);
            console.log('[SPADES MASTER] Player IDs:', playerIds);

            if (playerIds.length > 0) {
                // Fetch emails for player IDs from users table
                const { data: usersData, error: usersError } = await supabase
                    .from('users')
                    .select('id, email')
                    .in('id', playerIds);

                console.log('[SPADES MASTER] Users data:', usersData, usersError);

                if (usersError || !usersData) {
                    console.error('[SPADES MASTER] Failed to fetch user emails:', usersError);
                    return;
                }

                // Create email-to-score map
                const emailScoreMap: Record<string, number> = {};
                usersData.forEach((user: any) => {
                    const player = Object.values(updatedPlayers).find(p => p.id === user.id);
                    if (player && user.email) {
                        emailScoreMap[user.email] = player.score;
                    }
                });

                console.log('[SPADES MASTER] Email-score map:', emailScoreMap);

                // Update profiles by email
                for (const [email, score] of Object.entries(emailScoreMap)) {
                    const { error } = await supabase
                        .from('profiles')
                        .update({ visa_points: score })
                        .eq('email', email);

                    if (error) {
                        console.error(`[SPADES MASTER] Failed to update ${email}:`, error);
                    } else {
                        console.log(`[SPADES MASTER] ✅ Updated ${email} to ${score} points`);
                    }
                }
            }
        } catch (err) {
            console.error('[SPADES MASTER] Persistence error:', err);
        }

        await transitionToPhase('reveal', undefined, {
            players: updatedPlayers,
            round_data: newRoundData
        });
    };

    // --- Game Initialization ---
    const initializeGame = async () => {
        try {
            // Fetch allowed players
            const { data: stateData } = await supabase.from('spades_game_state').select('allowed_players').eq('id', GAME_ID).single();
            const allowedIds: string[] = stateData?.allowed_players || [];

            // Fetch real usernames and points via EMAIL lookup (Fix for ID mismatch)
            let userMap: Record<string, string> = {};
            let pointsMap: Record<string, number> = {};

            if (allowedIds.length > 0) {
                // 1. Fetch Users (ID -> Email, Map ID -> Username)
                const { data: userData } = await supabase
                    .from('users')
                    .select('id, email, username')
                    .in('id', allowedIds);

                const emails: string[] = [];
                const lowerEmailToOriginal: Record<string, string> = {};

                if (userData) {
                    userData.forEach((u: any) => {
                        userMap[u.id] = u.username;
                        if (u.email) {
                            emails.push(u.email);
                            lowerEmailToOriginal[u.email.toLowerCase()] = u.email;
                        }
                    });
                }

                // 2. Fetch Profiles by Email (Strict Case-Insensitive Logic via OR)
                if (emails.length > 0) {
                    // PROBLEM: .in() is case sensitive.
                    // SOLUTION: Construct an OR filter with ilike for each email.
                    // Format: email.ilike.val1,email.ilike.val2,...
                    const orFilter = emails.map(e => `email.ilike.${e}`).join(',');

                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('email, visa_points')
                        .or(orFilter);

                    if (profileData) {
                        // Create Map: LowerCase Email -> Points
                        const emailPoints: Record<string, number> = {};
                        profileData.forEach((p: any) => {
                            if (p.email) emailPoints[p.email.toLowerCase()] = p.visa_points;
                        });

                        // Map back to ID: ID -> Email -> Points
                        if (userData) {
                            userData.forEach((u: any) => {
                                if (u.email) {
                                    const lower = u.email.toLowerCase();
                                    if (emailPoints[lower] !== undefined) {
                                        pointsMap[u.id] = emailPoints[lower];
                                    }
                                }
                            });
                        }
                    }
                }
            }

            let newPlayers: PlayersMap = {};
            allowedIds.forEach(uid => {
                newPlayers[uid] = {
                    id: uid,
                    username: userMap[uid] || `Player ${uid.slice(0, 4).toUpperCase()}`,
                    score: pointsMap[uid] !== undefined ? pointsMap[uid] : 1000,
                    start_score: pointsMap[uid] !== undefined ? pointsMap[uid] : 1000,
                    cards: [],
                    bid: null,
                    status: 'active',
                    groupId: null // Assigned in briefing
                };
            });

            // Master join check
            if (user?.id && !newPlayers[user.id]) {
                // Fetch Master Profile Points via Email Lookup
                let masterPoints = 1000;

                // 1. Get Master Email
                const { data: masterUser } = await supabase
                    .from('users')
                    .select('email, username')
                    .eq('id', user.id)
                    .single();

                if (masterUser?.email) {
                    // 2. Get Profile Points
                    const { data: masterProfile } = await supabase
                        .from('profiles')
                        .select('visa_points')
                        .eq('email', masterUser.email)
                        .single();

                    if (masterProfile?.visa_points !== undefined) {
                        masterPoints = masterProfile.visa_points;
                    }
                }

                newPlayers[user.id] = {
                    id: user.id,
                    username: user.username || masterUser?.username || 'GAME MASTER',
                    score: masterPoints,
                    start_score: masterPoints,
                    cards: [],
                    bid: null,
                    status: 'active',
                    groupId: null
                };
            }

            setPlayers(newPlayers);
            setRound(1);
            deckRef.current = generateDeck();

            // New Game Sequence
            roundTypesRef.current = generateRoundTypesSequence();
            console.log('[SPADES MASTER] Round Sequence:', roundTypesRef.current);

            // Start briefing (which triggers group assignment)
            await transitionToPhase('briefing');
            isProcessingRef.current = false;
        } catch (error) {
            console.error('[SPADES MASTER] Init failed:', error);
            isProcessingRef.current = false;
        }
    };

    // --- Game End ---
    const endGame = async () => {
        const finalPlayers = applyGameFailurePenalty(players);

        // PERSISTENCE: Update VISA Points & Stats
        console.log('[SPADES MASTER] Persisting Game Results...');
        try {
            const playerIds = Object.keys(finalPlayers);
            if (playerIds.length > 0) {
                // 1. Fetch current stats to increment correctly
                const { data: profiles, error: fetchError } = await supabase
                    .from('profiles')
                    .select('id, wins, losses')
                    .in('id', playerIds);

                if (fetchError) throw fetchError;

                const profileMap: Record<string, { wins: number, losses: number }> = {};
                profiles?.forEach(p => { profileMap[p.id] = p; });

                // 2. Update each player
                for (const pid of playerIds) {
                    const p = finalPlayers[pid];
                    const currentStats = profileMap[pid] || { wins: 0, losses: 0 };

                    // Win Condition: Score > 0 (Survived)
                    // Loss Condition: Score <= 0 (Failed)
                    const isWin = p.score > 0;

                    const newWins = (currentStats.wins || 0) + (isWin ? 1 : 0);
                    const newLosses = (currentStats.losses || 0) + (isWin ? 0 : 1);

                    // Update Profile
                    await supabase.from('profiles').update({
                        visa_points: p.score, // Persist final score
                        wins: newWins,
                        losses: newLosses
                    }).eq('id', pid);
                }
                console.log('[SPADES MASTER] Persistence Complete.');
            }
        } catch (err) {
            console.error('[SPADES MASTER] Persistence Failed:', err);
        }

        await transitionToPhase('completed', undefined, {
            players: finalPlayers,
            phase_started_at: null,
            timer_display: 'COMPLETED'
        });
        onComplete(finalPlayers[user?.id]?.score || 0);
    };

    // --- Reset ---
    const resetGame = () => {
        setPhase('idle');
        setPlayers({});
        setRound(1);
        setTimeLeft(0);
        deckRef.current = generateDeck();
        setRoundData({});
        isProcessingRef.current = false;
    };

    const handleManualStart = () => { if (phase === 'idle') initializeGame(); };

    // --- UI ---
    return (
        <div className="bg-slate-900 min-h-screen text-slate-100 p-6 font-mono">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
                    <div>
                        <h1 className="text-3xl font-black italic uppercase text-blue-500">SURVIVAL ACTIONS // MASTER</h1>
                        <div className="flex items-center gap-4 text-sm mt-2 text-slate-400">
                            <span>PHASE: <span className="text-white font-bold">{phase.toUpperCase()}</span></span>
                            <span>ROUND: <span className="text-white font-bold">{round}/{MAX_ROUNDS}</span></span>
                            {isPaused && <span className="text-yellow-500">PAUSED</span>}
                        </div>
                    </div>
                    <div className="text-5xl font-black text-white">
                        {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                    </div>
                </div>

                {phase === 'idle' && (
                    <button onClick={handleManualStart} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded flex items-center gap-2 mb-8">
                        <Play size={18} /> INITIATE PROTOCOL
                    </button>
                )}

                {/* Groups Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Iterate over active groups in roundData OR players list */}
                    {Object.keys(roundData).length > 0 ? (
                        Object.entries(roundData).map(([gid, info]) => {
                            if (!info) return null;
                            return (
                                <div key={gid} className="bg-slate-800 border border-slate-700 rounded p-4">
                                    <h3 className="text-blue-400 font-bold mb-4 uppercase tracking-widest border-b border-slate-700 pb-2">
                                        TABLE {gid}
                                    </h3>
                                    {/* Target Card */}
                                    <div className="mb-4 text-center">
                                        <div className="text-xs text-slate-500 uppercase">TARGET</div>
                                        {info.target_card ? (
                                            <div className="text-xl font-black text-white">
                                                {info.target_card.rank} {info.target_card.suit}
                                            </div>
                                        ) : <div className="text-slate-600 italic">Hidden</div>}
                                    </div>
                                    {/* Players in Group */}
                                    <div className="space-y-2">
                                        {Object.values(players).filter(p => p.groupId === parseInt(gid)).map(p => (
                                            <div key={p.id} className={`flex justify - between text - sm p - 2 rounded ${info.winner_id === p.id ? 'bg-yellow-500/20 border border-yellow-500' : 'bg-slate-900'} `}>
                                                <span>{p.username}</span>
                                                <div className="flex gap-2">
                                                    <span className="text-yellow-500">Bid: {p.bid ?? '-'}</span>
                                                    <span className="text-blue-400">{p.score}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="col-span-3 text-center py-12 text-slate-600 border border-slate-800 rounded border-dashed">
                            NO ACTIVE GROUPS ASSIGNED
                            <div className="mt-2 text-xs">Players: {Object.keys(players).length}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
