import type { DiamondsPlayer, BattleResult } from '../../diamonds';

// --- SCORING LOGIC ---

export const updateScores = (
    participants: DiamondsPlayer[],
    battleResults: BattleResult[],
    isFinalRound: boolean = false
): { updatedParticipants: DiamondsPlayer[] } => {

    // Score Rules:
    // Win: +200
    // Lose: -100
    // Eliminated: -500 (Set status to eliminated)

    const updated = participants.map(p => {
        let newScore = p.score;
        let pStatus = p.status;

        // Find result for this player
        // Find result for this player (Robust Matching)
        const res = battleResults.find(r =>
            (r.p1Id && r.p1Id.toLowerCase() === p.id.toLowerCase()) ||
            (r.p2Id && r.p2Id.toLowerCase() === p.id.toLowerCase()) ||
            (r.p3Id && r.p3Id.toLowerCase() === p.id.toLowerCase()) ||
            r.winners.some(id => id.toLowerCase() === p.id.toLowerCase() || id === p.username) ||
            r.losers.some(id => id.toLowerCase() === p.id.toLowerCase() || id === p.username) ||
            r.eliminatedIds.some(id => id.toLowerCase() === p.id.toLowerCase() || id === p.username)
        );

        if (res) {
            // 1. Elimination Check
            if (res.eliminatedIds.some(id => id.toLowerCase() === p.id.toLowerCase() || id === p.username)) {
                newScore -= 500;
                pStatus = 'eliminated';
            }
            // 2. Win Check
            else if (res.winners.some(id => id.toLowerCase() === p.id.toLowerCase() || id === p.username)) {
                newScore += 200;
            }
            // 3. Loss Check
            else if (res.losers.some(id => id.toLowerCase() === p.id.toLowerCase() || id === p.username)) {
                newScore -= 100;
            }
        } else {
            console.warn(`[DIAMONDS_SCORING] No battle result found for player: ${p.username} (${p.id})`);
        }

        return {
            ...p,
            score: newScore,
            status: pStatus
        };
    });

    return {
        updatedParticipants: updated.map(p => {
            const startScore = participants.find(op => op.id === p.id)!.score;
            return {
                ...p,
                roundAdjustment: p.score - startScore
            };
        })
    };
};
