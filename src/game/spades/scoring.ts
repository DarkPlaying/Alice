// Spades Scoring Utilities
// Pure functions for card scoring and bid validation

import type { Card, PlayersMap } from './types';

/**
 * Calculate the score change for a given card.
 * 
 * Rules:
 * - Face cards (J, Q, K, A): 500 points flat (replaces suit-based scoring)
 * - Red cards (hearts, diamonds): +200 points
 * - Black cards (spades, clubs): -100 points
 * 
 * @param card - The card to score
 * @returns The score change (positive or negative)
 */
/**
 * Calculate the score change for a given card.
 * 
 * Rules:
 * - Red Face Cards (Hearts/Diamonds): -500 points
 * - Black Face Cards (Spades/Clubs): +1000 points
 * - Red Non-Face Cards: +600 points
 * - Black Non-Face Cards: -100 points
 * 
 * @param card - The card to score
 * @returns The score change (positive or negative)
 */
export function scoreCard(card: Card): number {
    const isFace = ['J', 'Q', 'K', 'A'].includes(card.rank);

    // Face Card Logic
    if (isFace) {
        if (card.color === 'black') return 1000;
        return -500;
    }

    // Non-Face Logic
    if (card.color === 'red') {
        return 600;
    }

    // Black Non-Face
    return -100;
}

/**
 * Apply the game failure penalty to players with 0 cards at the end of Round 5.
 * 
 * Rule: After Round 5, if a player has 0 cards collected, apply a -500 point penalty.
 * 
 * @param players - The current players map
 * @returns Updated players map with penalties applied
 */
export function applyGameFailurePenalty(players: PlayersMap): PlayersMap {
    const updated = { ...players };

    Object.keys(updated).forEach(playerId => {
        if (updated[playerId].cards.length === 0) {
            updated[playerId].score -= 500;
        }
    });

    return updated;
}

/**
 * Validate that a bid does not result in a negative score.
 * 
 * Rule: Players cannot bid more than their current score (projected_score must be >= 0).
 * 
 * @param currentScore - The player's current score
 * @param bidAmount - The bid amount to validate
 * @returns True if the bid is valid, false otherwise
 */
export function validateBid(currentScore: number, bidAmount: number): boolean {
    return (currentScore - bidAmount) >= 0;
}

/**
 * Calculate the projected score after a bid.
 * 
 * @param currentScore - The player's current score
 * @param bidAmount - The bid amount
 * @returns The projected score (clamped to 0 minimum)
 */
export function calculateProjectedScore(currentScore: number, bidAmount: number): number {
    return Math.max(0, currentScore - bidAmount);
}

/**
 * Apply bid deductions to all players.
 * Note: Based on game rules, all players pay their bid regardless of winning.
 * 
 * @param players - The current players map
 * @returns Updated players map with bid deductions applied
 */
export function applyBidDeductions(players: PlayersMap): PlayersMap {
    const updated = { ...players };

    Object.keys(updated).forEach(playerId => {
        const player = updated[playerId];
        if (player.bid && player.bid > 0) {
            player.score = player.score - player.bid;
        }
    });

    return updated;
}

/**
 * Award a card to the winning player and apply the card's score change.
 * 
 * @param players - The current players map
 * @param winnerId - The ID of the winning player
 * @param card - The card to award
 * @returns Updated players map with the card and score change applied
 */
export function awardCard(players: PlayersMap, winnerId: string, card: Card): PlayersMap {
    const updated = { ...players };

    if (updated[winnerId]) {
        updated[winnerId].cards.push(card);
        updated[winnerId].score += scoreCard(card);
    }

    return updated;
}
