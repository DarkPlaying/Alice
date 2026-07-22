import type { DiamondsPlayer, BattleResult } from '../../diamonds';

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

        // 3. Apply Outcome Effects to Participants (Bonus points and Hand destruction)
        group.forEach(p => {
            const pIndex = allUpdatedPlayers.findIndex(up => up.id === p.id);
            if (pIndex === -1) return;

            const current = { ...allUpdatedPlayers[pIndex] };
            current.slots = [...(p.slots || [])]; // Direct copy
            
            // Apply bonus points
            if (res.effects) {
                const myBonuses = res.effects.filter(e => e.type === 'cured' && e.desc.includes('BONUS') && e.playerId === p.id);
                myBonuses.forEach(b => {
                    const match = b.desc.match(/\+(\d+)/);
                    if (match) {
                        current.score += parseInt(match[1]);
                        console.log(`[DIAMONDS_EVAL] Added bonus ${match[1]} to ${current.username}`);
                    }
                });

                // Apply hand destruction (Shotgun kills Zombie in hand)
                const handDestruction = res.effects.filter(e => e.type === 'eliminated' && e.playerId === p.id && e.desc === 'ZOMBIE DESTROYED IN HAND');
                if (handDestruction.length > 0) {
                    current.cards = current.cards.filter(c => c.specialType !== 'zombie');
                    console.log(`[DIAMONDS_EVAL] Zombie destroyed in hand for ${current.username}`);
                }
            }

            allUpdatedPlayers[pIndex] = current;
        });
    }

    return { results, updatedParticipants: allUpdatedPlayers };
};

// --- 1v1 BATTLE ---
const evaluateBattle = (p1: DiamondsPlayer, p2: DiamondsPlayer): BattleResult => {
    return processBattle([p1, p2]);
};

// --- 3 Way BATTLE ---
const evaluateBattle3Way = (p1: DiamondsPlayer, p2: DiamondsPlayer, p3: DiamondsPlayer): BattleResult => {
    return processBattle([p1, p2, p3]);
};

// --- GENERIC BATTLE PROCESSOR ---
const processBattle = (players: DiamondsPlayer[]): BattleResult => {
    const res: BattleResult = {
        winners: [],
        losers: [],
        eliminatedIds: [],
        effects: [],
        p1Id: players[0].id,
        p2Id: players[1].id,
        p3Id: players.length > 2 ? players[2].id : undefined,
        slotDetails: [],
        p1Total: 0,
        p2Total: 0,
        p3Total: 0
    };

    const sums = new Array(players.length).fill(0);
    const neutralizedZombies = new Map<string, Set<number>>(); // playerId -> Set of slot indexes
    players.forEach(p => neutralizedZombies.set(p.id, new Set()));

    // A. Identify special users
    const shotgunUsers = players.filter(p => p.slots.some(s => s?.specialType === 'shotgun'));
    const injectionUsers = players.filter(p => p.slots.some(s => s?.specialType === 'injection'));

    // B. Apply Special Effects
    // Shotgun destroys Zombie anywhere (hand or slot)
    shotgunUsers.forEach(hunter => {
        players.forEach(target => {
            if (hunter.id === target.id) return;

            let gotBonus = false;

            // Check slots
            target.slots.forEach((s, idx) => {
                if (s?.specialType === 'zombie') {
                    neutralizedZombies.get(target.id)?.add(idx);
                    if (!gotBonus) {
                        res.effects?.push({ playerId: hunter.id, type: 'cured', desc: `SHOTGUN BONUS +100` });
                        gotBonus = true;
                    }
                    res.effects?.push({ playerId: target.id, type: 'cured', desc: `ZOMBIE NEUTRALIZED IN SLOT ${idx} BY SHOTGUN`, slotIndex: idx });
                }
            });

            // Check hand
            const hasZombieInHand = target.cards.some(c => c.specialType === 'zombie' && !target.slots.some(s => s?.id === c.id));
            if (hasZombieInHand) {
                res.effects?.push({ playerId: target.id, type: 'eliminated', desc: `ZOMBIE DESTROYED IN HAND` });
            }
        });
    });

    // Injection neutralizes Zombie ONLY in slot
    injectionUsers.forEach(medic => {
        players.forEach(target => {
            if (medic.id === target.id) return;

            target.slots.forEach((s, idx) => {
                if (s?.specialType === 'zombie' && !neutralizedZombies.get(target.id)?.has(idx)) {
                    neutralizedZombies.get(target.id)?.add(idx);
                    res.effects?.push({ playerId: medic.id, type: 'cured', desc: `INJECTION BONUS +200` });
                    res.effects?.push({ playerId: target.id, type: 'cured', desc: `ZOMBIE NEUTRALIZED IN SLOT ${idx} BY INJECTION`, slotIndex: idx });
                }
            });
        });
    });

    // C. Evaluate Slots
    for (let i = 0; i < 5; i++) {
        const slotVals = players.map((p, pIdx) => {
            const card = p.slots[i];
            if (!card) return 0;
            if (card.specialType === 'shotgun' || card.specialType === 'injection') return 0; // Value is 0
            if (card.specialType === 'zombie') {
                return neutralizedZombies.get(p.id)?.has(i) ? 0 : 999;
            }
            return card.value || 0;
        });

        // Add to sums
        slotVals.forEach((val, pIdx) => sums[pIdx] += val);

        // Record details
        res.slotDetails?.push({
            p1Val: slotVals[0],
            p2Val: slotVals[1],
            p3Val: players.length > 2 ? slotVals[2] : undefined,
            p1Card: players[0].slots[i],
            p2Card: players[1].slots[i],
            p3Card: players.length > 2 ? players[2].slots[i] : undefined,
            outcome: `Slot ${i + 1} Evaluated`
        });
    }

    res.p1Total = sums[0];
    res.p2Total = sums[1];
    if (players.length > 2) res.p3Total = sums[2];

    // D. Determine Winner
    const maxScore = Math.max(...sums);
    players.forEach((p, idx) => {
        if (sums[idx] === maxScore) {
            res.winners.push(p.id);
        } else {
            res.losers.push(p.id);
        }
    });

    return res;
};

const activePlayers = (list: DiamondsPlayer[]) => list.filter(p => p.status === 'active');
