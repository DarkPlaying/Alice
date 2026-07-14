import React, { useState, useEffect, useRef } from 'react';
import { supabase, supabaseUrl, supabaseKey, getAccessToken } from '../../supabaseClient';
import {
    type PlayersMap,
    type RoundData,
    type SpadesPhase,
    selectRandomCard,
    buildHint,
    removeCardFromDeck,
    awardCard,
    applyGameFailurePenalty,
    type Card,
    generateDeck
} from '../../game/spades';

interface SpadesGameMasterProps {
    isEngine?: boolean;
}

const GAME_ID = 'spades_main';

export const SpadesGameMaster: React.FC<SpadesGameMasterProps> = ({ isEngine = false }) => {
    const [phase, setPhase] = useState<SpadesPhase>('idle');
    const [round, setRound] = useState(1);
    const [isPaused, setIsPaused] = useState(false);
    const [players, setPlayers] = useState<PlayersMap>({});
    const [roundData, setRoundData] = useState<RoundData>({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [_hostError, setHostError] = useState<string | null>(null);

    const phaseStartedAtRef = useRef<Date | null>(null);
    const phaseDurationRef = useRef<number>(0);
    const phaseRef = useRef<SpadesPhase>('idle');
    const roundRef = useRef(1);
    const playersRef = useRef<PlayersMap>({});
    const roundDataRef = useRef<RoundData>({});
    const isProcessingRef = useRef(false);
    const deckRef = useRef<Card[]>(generateDeck());

    // Sync refs
    useEffect(() => {
        phaseRef.current = phase;
        roundRef.current = round;
        playersRef.current = players;
        roundDataRef.current = roundData;
    }, [phase, round, players, roundData]);

    const assignPlayerGroups = (currentPlayers: PlayersMap): PlayersMap => {
        // Fisher-Yates Shuffle for robust randomization
        const ids = Object.keys(currentPlayers);
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        if (ids.length === 0) return currentPlayers;

        const n = ids.length;
        const newPlayers = { ...currentPlayers };
        let groups: string[][] = [];

        if (n < 2) {
            groups.push(ids);
        } else {
            // USER REQUEST: Use 3 and 2 only (Not 4). Maximize 3s.
            let num3s = Math.floor(n / 3);
            let remainder = n % 3;
            let num2s = 0;

            if (remainder === 1) {
                if (num3s >= 1) {
                    num3s -= 1;
                    num2s = 2;
                }
            } else if (remainder === 2) {
                num2s = 1;
            }

            let currentIdx = 0;
            for (let k = 0; k < num3s; k++) {
                groups.push(ids.slice(currentIdx, currentIdx + 3));
                currentIdx += 3;
            }
            for (let k = 0; k < num2s; k++) {
                groups.push(ids.slice(currentIdx, currentIdx + 2));
                currentIdx += 2;
            }

            if (currentIdx < n) {
                if (groups.length > 0) {
                    groups[groups.length - 1].push(...ids.slice(currentIdx));
                } else {
                    groups.push(ids.slice(currentIdx));
                }
            }
        }

        groups.forEach((groupParams, idx) => {
            const groupId = idx + 1;
            groupParams.forEach(pid => {
                if (newPlayers[pid]) newPlayers[pid].groupId = groupId;
            });
        });
        return newPlayers;
    };

    // Polling and State Sync
    useEffect(() => {
        if (!isEngine) return;

        let isFetchingSync = false;

        const fetchState = async () => {
            if (isFetchingSync) return;
            isFetchingSync = true;
            try {
                const accessToken = await getAccessToken();
                const response = await fetch(`${supabaseUrl}/rest/v1/spades_game_state?id=eq.${GAME_ID}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'apikey': supabaseKey,
                        'Accept': 'application/vnd.pgrst.object+json'
                    },
                    cache: 'no-store'
                });
                
                if (!response.ok) {
                    console.error('[SPADES MASTER] Fetch Error:', await response.text());
                    return;
                }
                
                const data = await response.json();

                if (data) {
                    if (data.phase_started_at) {
                        let dStr = data.phase_started_at.replace(' ', 'T');
                        if (dStr.match(/[+-]\d{2}$/)) dStr += ':00';
                        if (!dStr.endsWith('Z') && !dStr.match(/[+-]\d{2}:?\d{2}$/)) dStr += 'Z';
                        const fetchedStart = new Date(dStr);
                        
                        // Ignore stale updates (e.g. from cache or read replica lag)
                        if (phaseStartedAtRef.current && fetchedStart.getTime() < phaseStartedAtRef.current.getTime()) {
                            return;
                        }
                    }

                    if (data.phase && data.phase !== phaseRef.current) setPhase(data.phase);
                    if (data.current_round && data.current_round !== roundRef.current) setRound(data.current_round);
                    
                    if (data.players && JSON.stringify(data.players) !== JSON.stringify(playersRef.current)) {
                        setPlayers(data.players);
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
            } finally {
                isFetchingSync = false;
            }
        };

        fetchState();
        const syncInterval = setInterval(fetchState, 1000);
        return () => clearInterval(syncInterval);
    }, [isEngine]);

    const advancePhase = async () => {
        try {
            console.log('[SPADES MASTER] Attempting to advance phase from:', phaseRef.current);
            let pendingTask: (() => Promise<void>) | null = null;
            const durationMap: Record<string, number> = {
                'briefing': 60,
                'shuffle': 15,
                'hint': 30,
                'bidding': 45,
                'reveal': 15,
                'completed': 0
            };

            let nextPhase: SpadesPhase = 'idle';
            let nextRound = roundRef.current;
            let tempRoundData: RoundData = { ...roundDataRef.current };
            let playersPayload = JSON.parse(JSON.stringify(playersRef.current));

            const currentPhase = phaseRef.current;

        if (currentPhase === 'briefing') {
            nextPhase = 'shuffle';
            // CRITICAL: Assign groups for Round 1!
            playersPayload = assignPlayerGroups(playersPayload);
            tempRoundData = {};
        }
        else if (currentPhase === 'shuffle') {
            nextPhase = 'hint';
            const groupIds = new Set<number>();
            Object.values(playersPayload).forEach((p: any) => { if (p.groupId) groupIds.add(p.groupId); });

            tempRoundData = {};

            // If we don't have enough cards in the deck, generate more
            while (deckRef.current.length < groupIds.size) {
                console.log(`[SPADES MASTER] Deck running low (${deckRef.current.length} cards), adding a new deck...`);
                deckRef.current = [...deckRef.current, ...generateDeck()];
            }

            groupIds.forEach(gid => {
                const targetCard = selectRandomCard(deckRef.current);
                if (targetCard) {
                    tempRoundData[gid] = {
                        target_card: targetCard,
                        hint: buildHint(targetCard),
                        winner_id: null,
                        ties: []
                    };
                    deckRef.current = removeCardFromDeck(deckRef.current, targetCard);
                }
            });
        }
        else if (currentPhase === 'hint') {
            nextPhase = 'bidding';
            Object.keys(playersPayload).forEach(pid => {
                playersPayload[pid].bid = null;
            });
        }
        else if (currentPhase === 'bidding') {
            console.log('[SPADES MASTER] bidding phase logic started');
            nextPhase = 'reveal';
            const groups: Record<number, string[]> = {};
            Object.values(playersPayload).forEach((p: any) => {
                if (p.groupId) {
                    if (!groups[p.groupId]) groups[p.groupId] = [];
                    groups[p.groupId].push(p.id);
                }
            });
            console.log('[SPADES MASTER] groups created:', groups);

            Object.entries(groups).forEach(([gidStr, memberIds]) => {
                const gid = parseInt(gidStr);
                const groupData = tempRoundData[gid];
                if (!groupData || !groupData.target_card) return;

                let highestBid = 0;
                let winners: string[] = [];

                memberIds.forEach(pid => {
                    const bid = playersPayload[pid]?.bid || 0;
                    if (bid > highestBid) { highestBid = bid; winners = [pid]; }
                    else if (bid === highestBid && bid > 0) winners.push(pid);
                });

                let winnerId: string | null = null;
                let sortedWinners: string[] = [];

                if (winners.length >= 1) {
                    sortedWinners = winners.sort();
                    const randomIndex = Math.floor(Math.random() * sortedWinners.length);
                    winnerId = sortedWinners[randomIndex];

                    playersPayload = awardCard(playersPayload, winnerId, groupData.target_card);
                    console.log(`[SPADES MASTER] Awarded ${groupData.target_card.rank}${groupData.target_card.suit} to ${winnerId}. New points: ${playersPayload[winnerId].score}`);
                }

                memberIds.forEach(pid => {
                    if (playersPayload[pid]) {
                        const bidAmount = playersPayload[pid].bid || 0;
                        if (bidAmount > 0 && pid === winnerId) {
                            playersPayload[pid].score -= bidAmount;
                            console.log(`[SPADES MASTER] Deducted ${bidAmount} bid from winner ${pid}. Final Score: ${playersPayload[pid].score}`);
                        }
                    }
                });

                tempRoundData[gid] = {
                    ...groupData,
                    winner_id: winnerId,
                    ties: winners.length > 1 ? sortedWinners : []
                };
            });
            console.log('[SPADES MASTER] completed groups processing. tempRoundData:', tempRoundData);

            pendingTask = async () => {
                try {
                    const playerIds = Object.values(playersPayload).map((p: any) => p.id).filter(id => id && id.length > 5);
                    if (playerIds.length > 0) {
                        const accessToken = await getAccessToken();
                        
                        // Fetch profiles in one request
                        const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=in.(${playerIds.join(',')})&select=id,email,wins,losses,visa_points`, {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'apikey': supabaseKey,
                                'Accept': 'application/json'
                            }
                        });

                        if (profileRes.ok) {
                            const profilesData = await profileRes.json();
                            
                            // Process each player sequentially to avoid connection limits
                            for (const profile of profilesData) {
                                const player = Object.values(playersPayload).find((p: any) => p.id === profile.id);
                                if (player && profile.email) {
                                    const initialScore = profile.visa_points || 0;
                                    const finalScore = (player as any).score || 0;
                                    const isWin = finalScore >= initialScore;

                                    let newWins = profile.wins || 0;
                                    let newLosses = profile.losses || 0;

                                    if (isWin) newWins += 1;
                                    else newLosses += 1;

                                    // Update profile using fetch
                                    await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(profile.email)}`, {
                                        method: 'PATCH',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${accessToken}`,
                                            'apikey': supabaseKey,
                                            'Prefer': 'return=minimal'
                                        },
                                        body: JSON.stringify({
                                            visa_points: finalScore,
                                            wins: newWins,
                                            losses: newLosses
                                        })
                                    });
                                }
                            }
                        } else {
                            console.error('[SPADES MASTER] Failed to fetch profiles for persistence:', await profileRes.text());
                        }
                    }
                } catch (err) {
                    console.error('[SPADES MASTER] Persistence error:', err);
                }
            };
            console.log('[SPADES MASTER] Pending task for persistSpadesHost assigned.');
        }
        else if (currentPhase === 'reveal') {
            if (nextRound < 5) {
                nextPhase = 'shuffle';
                nextRound = nextRound + 1;
                playersPayload = assignPlayerGroups(playersPayload);
                tempRoundData = {};
            } else {
                nextPhase = 'completed';
                playersPayload = applyGameFailurePenalty(playersPayload);
            }
        }

        const nextDuration = durationMap[nextPhase] || 0;
        console.log(`[SPADES MASTER] preparing updatePayload. nextPhase: ${nextPhase}, nextDuration: ${nextDuration}`);

        const updatePayload: any = {
            phase: nextPhase,
            current_round: nextPhase === 'completed' ? 5 : nextRound,
            phase_started_at: new Date().toISOString(),
            phase_duration_sec: nextDuration,
            timer_display: `${Math.floor(nextDuration / 60)}:${String(nextDuration % 60).padStart(2, '0')}`,
            round_data: tempRoundData,
            players: playersPayload
        };
        console.log('[SPADES MASTER] updatePayload prepared.');

        // OPTIMISTIC UPDATE: Instantly jump to the next phase on Admin UI
        const newStart = new Date(updatePayload.phase_started_at);
        phaseStartedAtRef.current = newStart;
        phaseDurationRef.current = nextDuration;
        setPhase(nextPhase);
        setRound(updatePayload.current_round);
        setPlayers(playersPayload);
        setRoundData(tempRoundData);

        const executeUpdate = async () => {
            console.log('[SPADES MASTER] executeUpdate triggered! updatePayload:', updatePayload);
            try {
                console.log(`[SPADES MASTER] Getting session for raw fetch...`);
                const accessToken = await getAccessToken();
                
                console.log(`[SPADES MASTER] Calling raw fetch PATCH...`);
                const response = await fetch(`${supabaseUrl}/rest/v1/spades_game_state?id=eq.spades_main`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                        'apikey': supabaseKey,
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(updatePayload)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.error(`[SPADES MASTER] Update failed! Status: ${response.status}`, errText);
                    
                    // Fallback without timer_display if it's a schema error
                    if (errText.includes('timer_display') || response.status === 400) {
                        console.warn('[SPADES MASTER] Retrying without timer_display...');
                        const fallback: any = { ...updatePayload };
                        delete fallback.timer_display;
                        const retryResponse = await fetch(`${supabaseUrl}/rest/v1/spades_game_state?id=eq.spades_main`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${accessToken}`,
                                'apikey': supabaseKey,
                                'Prefer': 'return=minimal'
                            },
                            body: JSON.stringify(fallback)
                        });
                        if (!retryResponse.ok) {
                             console.error('[SPADES MASTER] Fallback update failed:', await retryResponse.text());
                        } else {
                             console.log('[SPADES MASTER] Fallback Update succeeded!');
                        }
                    }
                } else {
                    console.log(`[SPADES MASTER] Update succeeded!`);
                }
            } catch (err) {
                console.error('[SPADES MASTER] Promise rejected during update:', err);
            } finally {
                isProcessingRef.current = false;
            }
        };

        await executeUpdate();

        if (pendingTask) {
            console.log('[SPADES MASTER] Executing pending background task (persistSpadesHost) after state update...');
            pendingTask();
        }

        } catch (syncError) {
            console.error('[SPADES MASTER] CRITICAL SYNCHRONOUS ERROR in advancePhase:', syncError);
            isProcessingRef.current = false;
        }
    };

    // Timer Engine Logic
    useEffect(() => {
        if (!isEngine || phase === 'idle' || phase === 'completed') return;

        const timer = setInterval(() => {
            if (isPaused) return;

            let realTimeLeft = 0;
            if (phaseStartedAtRef.current && phaseDurationRef.current) {
                const now = new Date();
                // Ensure phaseStartedAtRef is correctly treated as UTC when created or compared
                const elapsed = Math.floor((now.getTime() - phaseStartedAtRef.current.getTime()) / 1000);
                realTimeLeft = Math.max(0, phaseDurationRef.current - elapsed);
            }
            
            setTimeLeft(realTimeLeft);

            if (realTimeLeft === 0 && !isProcessingRef.current) {
                console.log(`[SPADES MASTER] Timer reached 0:00 for phase ${phaseRef.current}. Advancing...`);
                isProcessingRef.current = true;
                advancePhase();
            } else if (realTimeLeft === 0 && isProcessingRef.current) {
                // Log if it's stuck waiting for the previous advancePhase to finish
                // console.warn(`[SPADES MASTER] Timer at 0:00, but isProcessingRef is still TRUE. Waiting...`);
            }
        }, 100);

        return () => clearInterval(timer);
    }, [isEngine, phase, isPaused]);

    return null; // Purely a logic component, no UI
};
