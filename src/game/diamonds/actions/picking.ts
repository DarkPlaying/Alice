import type { DiamondsPlayer, DiamondsCard } from '../../diamonds';

// --- PICKING PHASE LOGIC ---

export const resolveSteals = (
    participants: DiamondsPlayer[],
    battleResults: any[] // Using any for loose coupling with evaluation result type, or import it
): { updatedParticipants: DiamondsPlayer[], pendingSteals: any[] } => {

    // In Diamonds, "Picking" is an interactive phase.
    // Ideally, the engine should just set the status to "picking" and provide the data 
    // for the UI to render the "Steal Modal".

    // However, if we need to AUTO-RESOLVE due to timeout (headless admin), 
    // we need logic here. Or if we are just *preparing* the state.

    // Rule: "winner choose cards and loser wait for winner to pick cards - shows an option to pick any card from player b"

    console.log(`[DIAMONDS_PICKING] Resolving steals for ${participants.length} players...`);
    const pendingSteals: any[] = [];

    battleResults.forEach(res => {
        // Simple 1v1 case
        if (res.winners.length === 1 && res.losers.length > 0) {
            const winnerId = res.winners[0];
            const loserIds = res.losers; // Array

            // Find stats
            const winner = participants.find(p => p.id === winnerId);
            const losers = participants.filter(p => loserIds.includes(p.id));

            if (winner && losers.length > 0) {
                // Collect ALL slotted cards from losers
                const targetCards: { ownerId: string, card: DiamondsCard }[] = [];

                losers.forEach(l => {
                    l.slots.forEach(c => {
                        if (c) {
                            // "injection and shot gun cards are 0 points ,it is only speacial cards not calucate as points"
                            // Can they be stolen? User didn't say NO. 
                            // But usually you want high value cards.
                            // Assuming all slotted cards are available.
                            targetCards.push({ ownerId: l.id, card: c });
                        }
                    });
                });

                if (targetCards.length > 0) {
                    console.log(`[DIAMONDS_PICKING] Player ${winner.username} can steal from ${losers.map(l => l.username).join(', ')} (${targetCards.length} targets found)`);
                    pendingSteals.push({
                        pickerId: winnerId,
                        targets: targetCards.map(t => ({
                            id: t.card.id,
                            rank: t.card.rank,
                            suit: t.card.suit,
                            value: t.card.value,
                            specialType: t.card.specialType,
                            ownerId: t.ownerId
                        })),
                        canSkip: true // "if player a don't select any card , don't remove any cards"
                    });
                }
            }
        }
        // 3-way with 2 winners? (Ties) 
        // Logic: "Players with max score win". If 2 winners, do they both steal from loser?
        // User didn't specify. Assuming top winner gets priority or only solo winner steals.
        // For simplicity: If multiple winners, maybe NO steal or split? 
        // Let's assume steal is only for clear solo winner for now to avoid conflicts.
    });

    return { updatedParticipants: participants, pendingSteals };
};
