import type { DiamondsPlayer, BattleResult } from '../../diamonds';

// --- SCORING LOGIC ---

export const updateScores = (
    participants: DiamondsPlayer[],
    battleResults: BattleResult[]
): { updatedParticipants: DiamondsPlayer[] } => {

    // Score Rules:
    // Win: +200
    // Lose: -100
    // Eliminated: -500 (Set status to eliminated)

    const updated = participants.map(p => {
        let newScore = p.score;
        let pStatus = p.status;

        // Find result for this player
        const res = battleResults.find(r =>
            r.winners.includes(p.id) ||
            r.losers.includes(p.id) ||
            r.eliminatedIds.includes(p.id)
        );

        if (res) {
            // 1. Elimination Check
            if (res.eliminatedIds.includes(p.id)) {
                newScore -= 500;
                pStatus = 'eliminated';
            }
            // 2. Win Check
            else if (res.winners.includes(p.id)) {
                newScore += 200;
            }
            // 3. Loss Check
            else if (res.losers.includes(p.id)) {
                newScore -= 100;
            }
        }

        return {
            ...p,
            score: newScore,
            status: pStatus
        };
    });

    // 4. Team-Based Bonus (USER REQUEST)
    // Survivors win if count > Zombie count
    const activeParticipants = updated.filter(p => p.status !== 'eliminated');
    const survivors = activeParticipants.filter(p => !p.isZombie);
    const zombies = activeParticipants.filter(p => p.isZombie);

    // If no active players, skip bonus
    if (activeParticipants.length === 0) return { updatedParticipants: updated };

    const survivorTeamWins = survivors.length > zombies.length;

    const finalUpdate = updated.map(p => {
        const startScore = participants.find(op => op.id === p.id)!.score;

        if (p.status === 'eliminated') {
            return {
                ...p,
                roundAdjustment: p.score - startScore
            };
        }

        let teamAdjust = 0;
        if (survivorTeamWins) {
            teamAdjust = !p.isZombie ? 300 : -100;
        } else {
            teamAdjust = p.isZombie ? 300 : -100;
        }

        const currentScoreWithTeam = p.score + teamAdjust;

        return {
            ...p,
            score: currentScoreWithTeam,
            roundAdjustment: currentScoreWithTeam - startScore
        };
    });

    return { updatedParticipants: finalUpdate };
};
