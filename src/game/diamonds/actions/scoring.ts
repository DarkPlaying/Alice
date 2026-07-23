import type { DiamondsPlayer, BattleResult } from '../../diamonds';

// --- SCORING LOGIC ---

export const updateScores = (
    participants: DiamondsPlayer[],
    battleResults: BattleResult[],
    isFinalRound: boolean = false
): { updatedParticipants: DiamondsPlayer[] } => {

    const updated = participants.map(p => {
        let pStatus = p.status;

        // Find result for this player (Robust Matching)
        const res = battleResults.find(r =>
            (r.p1Id && r.p1Id.toLowerCase() === p.id.toLowerCase()) ||
            (r.p2Id && r.p2Id.toLowerCase() === p.id.toLowerCase()) ||
            (r.p3Id && r.p3Id.toLowerCase() === p.id.toLowerCase()) ||
            r.winners.some(id => id.toLowerCase() === p.id.toLowerCase() || id === p.username) ||
            r.losers.some(id => id.toLowerCase() === p.id.toLowerCase() || id === p.username) ||
            r.eliminatedIds.some(id => id.toLowerCase() === p.id.toLowerCase() || id === p.username)
        );

        let baseAdj = 0;
        if (res) {
            const totalParticipantsInBattle = [res.p1Id, res.p2Id, res.p3Id].filter(Boolean).length;
            const isTotalDraw = res.winners.length === totalParticipantsInBattle;

            if (res.eliminatedIds.some(id => id.toLowerCase() === p.id.toLowerCase() || id === p.username)) {
                baseAdj = -500;
                pStatus = 'eliminated';
            } else if (isTotalDraw) {
                baseAdj = 0; // Total 3-way or 2-way draw
            } else if (res.winners.some(id => id.toLowerCase() === p.id.toLowerCase() || id === p.username)) {
                baseAdj = 200; // Outright win or tied high score win
            } else if (res.losers.some(id => id.toLowerCase() === p.id.toLowerCase() || id === p.username)) {
                baseAdj = -100; // Defeat
            }
        } else {
            console.warn(`[DIAMONDS_SCORING] No battle result found for player: ${p.username} (${p.id})`);
        }

        const totalAdj = baseAdj + (p.roundBonus || 0);
        const newScore = (p.score ?? 1000) + totalAdj;

        return {
            ...p,
            score: newScore,
            status: pStatus,
            roundAdjustment: totalAdj
        };
    });

    return { updatedParticipants: updated };
};
