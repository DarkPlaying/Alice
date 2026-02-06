import type { DiamondsPlayer, BattleResult } from '../../diamonds';

// --- EVALUATION LOGIC ---

export const evaluateRound = (
    participants: DiamondsPlayer[],
    slotsMap: Map<string, any[]>
): { results: BattleResult[], updatedParticipants: DiamondsPlayer[] } => {

    const results: BattleResult[] = [];
    console.log(`[DIAMONDS_EVAL] Starting Evaluation for ${participants.length} participants.`);
    let allUpdatedPlayers = [...participants];

    // 1. Group Players & Attach Slots
    const groups: Record<number, DiamondsPlayer[]> = {};
    activePlayers(participants).forEach(p => {
        if (p.groupId) {
            if (!groups[p.groupId]) groups[p.groupId] = [];
            const slots = slotsMap.get(p.id) || [null, null, null, null, null];
            groups[p.groupId].push({ ...p, slots });
        }
    });

    // 2. Evaluate Each Group
    for (const gId in groups) {
        const group = groups[gId];
        let res: BattleResult;

        if (group.length === 2) {
            res = evaluateBattle(group[0], group[1]);
        } else if (group.length === 3) {
            res = evaluateBattle3Way(group[0], group[1], group[2]);
        } else {
            console.warn(`[DIAMONDS_EVAL] Invalid group size: ${group.length} (Group ${gId})`);
            continue;
        }

        results.push(res);

        // 3. Apply Outcome Effects to Participants
        group.forEach(p => {
            const pIndex = allUpdatedPlayers.findIndex(up => up.id === p.id);
            if (pIndex === -1) return;

            const current = { ...allUpdatedPlayers[pIndex] };
            current.slots = [...(p.slots || [])]; // Direct copy

            // Check for specific effects from the battle results
            const groupEffects = res.effects?.filter(e => e.playerId === p.id || (e.playerId === 'both' && (p.id === group[0].id || p.id === group[1].id)) || (e.playerId === 'multi' && group.some(gp => gp.id === p.id)));

            groupEffects?.forEach(effect => {
                if (effect.type === 'eliminated') {
                    current.status = 'eliminated';
                } else if (effect.type === 'infected') {
                    current.isZombie = true;
                } else if (effect.type === 'cured') {
                    current.isZombie = false;

                    // USER REQUEST: Transform zombie to normal card < 10 (also replace the zombie with that card)
                    // We extract the new value and slot index from the description
                    const newValMatch = effect.desc?.match(/TO (\d+)/);
                    const slotIdxMatch = effect.desc?.match(/SLOT (\d+)/);

                    const newVal = newValMatch ? parseInt(newValMatch[1]) : 2;
                    const slotIdx = slotIdxMatch ? parseInt(slotIdxMatch[1]) : -1;

                    if (slotIdx !== -1 && current.slots[slotIdx]?.specialType === 'zombie') {
                        const ts = Date.now().toString().slice(-4);
                        current.slots[slotIdx] = {
                            id: `trans_${ts}_${p.id.slice(0, 3)}_${slotIdx}`,
                            type: 'standard',
                            rank: newVal.toString(),
                            suit: 'hearts', // Default transformed suit
                            value: newVal
                        };
                        console.log(`[DIAMONDS_EVAL] Transformed Zombie in slot ${slotIdx} to rank ${newVal} for ${current.username}`);
                    }
                }
            });

            // If they played a zombie, mark regular usage (for tracking "2 uses max")
            if (p.slots.some(s => s?.specialType === 'zombie')) {
                current.zombieUses = (current.zombieUses || 0) + 1;
            }

            allUpdatedPlayers[pIndex] = current;
        });
    }

    return { results, updatedParticipants: allUpdatedPlayers };
};

// --- 1v1 BATTLE ---
const evaluateBattle = (p1: DiamondsPlayer, p2: DiamondsPlayer): BattleResult => {
    const res: BattleResult = {
        winners: [],
        losers: [],
        eliminatedIds: [],
        effects: [],
        slotDetails: [],
        p1Total: 0,
        p2Total: 0
    };
    let p1Sum = 0;
    let p2Sum = 0;

    // A. Shotgun Check (Zombie Hunter Logic)
    // USER REQUEST: If player has zombie (in hand or slots) and opponent uses gun, eliminate player.
    const p1HasZombie = p1.slots.some(s => s?.specialType === 'zombie') || p1.cards.some(c => c.specialType === 'zombie');
    const p2HasZombie = p2.slots.some(s => s?.specialType === 'zombie') || p2.cards.some(c => c.specialType === 'zombie');
    const p1UsedGun = p1.slots.some(s => s?.specialType === 'shotgun');
    const p2UsedGun = p2.slots.some(s => s?.specialType === 'shotgun');

    if (p1UsedGun && p2HasZombie) {
        res.winners.push(p1.id);
        res.eliminatedIds.push(p2.id);
        res.effects?.push({ playerId: p2.id, type: 'eliminated', desc: 'ELIMINATED BY SHOTGUN' });
    }
    if (p2UsedGun && p1HasZombie) {
        res.winners.push(p2.id);
        res.eliminatedIds.push(p1.id);
        res.effects?.push({ playerId: p1.id, type: 'eliminated', desc: 'ELIMINATED BY SHOTGUN' });
    }

    // Determine outcomes early if eliminated
    if (res.eliminatedIds.length > 0) {
        if (res.winners.length > 1) {
            res.winners = [];
            res.losers.push(p1.id, p2.id);
        } else if (res.winners.length === 1) {
            const soleWinner = res.winners[0];
            const soleLoser = soleWinner === p1.id ? p2.id : p1.id;
            res.losers.push(soleLoser);
        } else {
            res.losers.push(p1.id, p2.id);
        }
        // Still fill slot details for UI
        for (let i = 0; i < 5; i++) {
            res.slotDetails?.push({
                p1Val: 0, p2Val: 0,
                p1Card: p1.slots[i], p2Card: p2.slots[i],
                outcome: 'Eliminated'
            });
        }
        return res;
    }

    // B. Slot Comparison
    for (let i = 0; i < 5; i++) {
        let c1 = p1.slots[i];
        let c2 = p2.slots[i];
        let v1 = c1?.value || 0;
        let v2 = c2?.value || 0;

        // Zombie vs Zombie (Clash)
        if (c1?.specialType === 'zombie' && c2?.specialType === 'zombie') {
            v1 = 0; v2 = 0;
            res.effects?.push({ playerId: 'both', type: 'infected', desc: 'ZOMBIE CLASH (0-0)' });
        }
        // Zombie vs Injection (Cure / Transformation)
        else if (c1?.specialType === 'zombie' && c2?.specialType === 'injection') {
            const newVal = Math.floor(Math.random() * 8) + 2;
            v2 = 0;
            // PRIORITY: If P1 is already eliminated by shotgun, don't cure
            if (res.eliminatedIds.includes(p1.id)) {
                v1 = 0;
            } else {
                v1 = newVal;
                res.effects?.push({
                    playerId: p1.id,
                    type: 'cured',
                    desc: `ZOMBIE NEUTRALIZED TO ${newVal} IN SLOT ${i}`,
                    originalCardId: c1.id,
                    slotIndex: i
                });
            }
        }
        else if (c2?.specialType === 'zombie' && c1?.specialType === 'injection') {
            const newVal = Math.floor(Math.random() * 8) + 2;
            v1 = 0;
            if (res.eliminatedIds.includes(p2.id)) {
                v2 = 0;
            } else {
                v2 = newVal;
                res.effects?.push({
                    playerId: p2.id,
                    type: 'cured',
                    desc: `ZOMBIE NEUTRALIZED TO ${newVal} IN SLOT ${i}`,
                    originalCardId: c2.id,
                    slotIndex: i
                });
            }
        }
        // Zombie vs Normal (Spread)
        else if (c1?.specialType === 'zombie' && c2?.type === 'standard') {
            v1 = 999; v2 = 0;
            if (!res.eliminatedIds.includes(p2.id)) {
                res.effects?.push({ playerId: p2.id, type: 'infected', desc: 'INFECTED BY ZOMBIE' });
            }
        }
        else if (c2?.specialType === 'zombie' && c1?.type === 'standard') {
            v2 = 999; v1 = 0;
            if (!res.eliminatedIds.includes(p1.id)) {
                res.effects?.push({ playerId: p1.id, type: 'infected', desc: 'INFECTED BY ZOMBIE' });
            }
        }

        // Shotgun / Injection (Normal case - usage 1 time logic handled in DiamondsGame)
        if (c1?.specialType === 'shotgun' || (c1?.specialType === 'injection' && c2?.specialType !== 'zombie')) v1 = 0;
        if (c2?.specialType === 'shotgun' || (c2?.specialType === 'injection' && c1?.specialType !== 'zombie')) v2 = 0;

        p1Sum += v1;
        p2Sum += v2;

        res.slotDetails?.push({
            p1Val: v1, p2Val: v2,
            p1Card: c1, p2Card: c2,
            outcome: v1 > v2 ? 'P1 slot win' : v2 > v1 ? 'P2 slot win' : 'Draw'
        });
    }

    res.p1Total = p1Sum;
    res.p2Total = p2Sum;

    // C. Determine Winner
    if (p1Sum > p2Sum) { res.winners.push(p1.id); res.losers.push(p2.id); }
    else if (p2Sum > p1Sum) { res.winners.push(p2.id); res.losers.push(p1.id); }
    else { res.losers.push(p1.id, p2.id); }

    return res;
};

// --- 3 Way Battle ---
const evaluateBattle3Way = (p1: DiamondsPlayer, p2: DiamondsPlayer, p3: DiamondsPlayer): BattleResult => {
    const res: BattleResult = {
        winners: [],
        losers: [],
        eliminatedIds: [],
        effects: [],
        slotDetails: [],
        p1Total: 0,
        p2Total: 0,
        p3Total: 0
    };
    const players = [p1, p2, p3];

    // 1. Shotgun Check (Hand-wide) - Multi-Hunter De-duplication
    players.forEach(p => {
        if (p.slots.some(s => s?.specialType === 'shotgun')) {
            let successfullyEliminatedNewTarget = false;
            players.forEach(target => {
                if (target.id === p.id) return;
                const targetHasZombie = target.slots.some(s => s?.specialType === 'zombie') || target.cards.some(c => c.specialType === 'zombie');
                if (targetHasZombie) {
                    // USER REQUEST: ensure only one elimination point (one winner per kill)
                    if (!res.eliminatedIds.includes(target.id)) {
                        res.eliminatedIds.push(target.id);
                        res.effects?.push({ playerId: target.id, type: 'eliminated', desc: 'ELIMINATED BY SHOTGUN' });
                        successfullyEliminatedNewTarget = true;
                    }
                }
            });
            // Credit this hunter as a winner only if they secured a kill that others didn't already take
            if (successfullyEliminatedNewTarget) {
                if (!res.winners.includes(p.id)) res.winners.push(p.id);
            }
        }
    });

    // 2. Slot Logic
    const sums = [0, 0, 0];
    for (let i = 0; i < 5; i++) {
        const cards = players.map(p => p.slots[i]);
        const vals = cards.map(c => c?.type === 'standard' ? c.value : 0);
        const zombies = cards.map(c => c?.specialType === 'zombie');
        const injections = cards.map(c => c?.specialType === 'injection');

        const zombieCount = zombies.filter(z => z).length;
        const injectionCount = injections.filter(i => i).length;

        if (zombieCount > 0 && injectionCount > 0) {
            // Hunter De-duplication + Shotgun Priority
            const slotCuredTargets: string[] = [];

            // Check established injections for this slot
            injections.forEach((isI, hunterIdx) => {
                if (!isI) return;
                let securedACure = false;

                zombies.forEach((isZ, targetIdx) => {
                    if (!isZ || res.eliminatedIds.includes(players[targetIdx].id)) return;

                    // If this zombie hasn't been cured in this slot yet, this hunter gets the credit
                    if (!slotCuredTargets.includes(players[targetIdx].id)) {
                        slotCuredTargets.push(players[targetIdx].id);
                        securedACure = true;

                        const newVal = Math.floor(Math.random() * 8) + 2;
                        vals[targetIdx] = newVal;
                        res.effects?.push({
                            playerId: players[targetIdx].id,
                            type: 'cured',
                            desc: `ZOMBIE NEUTRALIZED TO ${newVal} IN SLOT ${i}`,
                            originalCardId: cards[targetIdx]?.id,
                            slotIndex: i
                        });
                    }
                });

                vals[hunterIdx] = 0;
                if (securedACure) {
                    if (!res.winners.includes(players[hunterIdx].id)) res.winners.push(players[hunterIdx].id);
                }
            });
        }
        else if (zombieCount > 1) {
            zombies.forEach((isZ, idx) => { if (isZ) vals[idx] = 0; });
            players.forEach((_, idx) => {
                if (!zombies[idx] && cards[idx]?.type === 'standard' && !res.eliminatedIds.includes(players[idx].id)) {
                    vals[idx] = 0;
                    if (!res.effects?.some(e => e.playerId === players[idx].id && e.type === 'infected')) {
                        res.effects?.push({ playerId: players[idx].id, type: 'infected', desc: 'INFECTED BY ZOMBIE CLASH' });
                    }
                }
            });
            if (!res.effects?.some(e => e.type === 'infected' && e.playerId === 'multi')) {
                res.effects?.push({ playerId: 'multi', type: 'infected', desc: 'ZOMBIE CLASH' });
            }
        }
        else if (zombieCount === 1) {
            const zIdx = zombies.indexOf(true);
            vals[zIdx] = 999;
            players.forEach((_, idx) => {
                if (idx !== zIdx && cards[idx]?.type === 'standard' && !res.eliminatedIds.includes(players[idx].id)) {
                    vals[idx] = 0;
                    if (!res.effects?.some(e => e.playerId === players[idx].id && e.type === 'infected')) {
                        res.effects?.push({ playerId: players[idx].id, type: 'infected', desc: 'INFECTED BY ZOMBIE' });
                    }
                }
            });
        }
        cards.forEach((c, idx) => {
            // Shotgun/Injection values are 0 (usage handled in main Game component)
            if (c?.specialType === 'shotgun' || (c?.specialType === 'injection' && !zombies.includes(true))) vals[idx] = 0;
        });

        sums[0] += vals[0];
        sums[1] += vals[1];
        sums[2] += vals[2];

        res.slotDetails?.push({
            p1Val: vals[0], p2Val: vals[1], p3Val: vals[2],
            p1Card: cards[0], p2Card: cards[1], p3Card: cards[2],
            outcome: `Slot ${i + 1} Comparison`
        });
    }

    res.p1Total = sums[0];
    res.p2Total = sums[1];
    res.p3Total = sums[2];

    // 3. Determine Winner(s)
    // Players who successfully used Shotgun/Injection are already in res.winners.
    // We combine them with players who have the highest valid sums.
    const validSums = sums.map((s, idx) => res.eliminatedIds.includes(players[idx].id) ? -1 : s);
    const max = Math.max(...validSums);

    players.forEach((p, i) => {
        if (res.eliminatedIds.includes(p.id)) return;
        if (validSums[i] === max && max >= 0) {
            if (!res.winners.includes(p.id)) res.winners.push(p.id);
        } else if (!res.winners.includes(p.id)) {
            res.losers.push(p.id);
        }
    });

    return res;
};

const activePlayers = (list: DiamondsPlayer[]) => list.filter(p => p.status === 'active');

