import type { Card, PlayersMap } from './types';

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/**
 * Generates a full 52-card deck
 */
export const generateDeck = (): Card[] => {
    const deck: Card[] = [];
    SUITS.forEach(suit => {
        RANKS.forEach(rank => {
            const color = (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black';
            deck.push({ suit, rank, color });
        });
    });
    return deck;
};

/**
 * Selects a random card and removes it from the deck
 */
export const selectRandomCard = (deck: Card[]): { card: Card; remainingDeck: Card[] } => {
    const index = Math.floor(Math.random() * deck.length);
    const card = deck[index];
    const remainingDeck = [...deck.slice(0, index), ...deck.slice(index + 1)];
    return { card, remainingDeck };
};

/**
 * Randomly pairs alive players
 */
export const generatePairs = (players: PlayersMap): [string, string][] => {
    const aliveIds = Object.keys(players).filter(id => players[id].alive);
    const shuffled = [...aliveIds].sort(() => Math.random() - 0.5);
    const pairs: [string, string][] = [];

    while (shuffled.length >= 2) {
        pairs.push([shuffled.pop()!, shuffled.pop()!]);
    }

    // Handle odd player by pairing with 'SYSTEM'
    if (shuffled.length === 1) {
        pairs.push([shuffled.pop()!, 'SYSTEM']);
    }

    return pairs;
};

/**
 * Evaluates if a guess is correct
 */
export const evaluateGuess = (actualCard: Card, guessSuit: string): 'correct' | 'wrong' => {
    return actualCard.suit === guessSuit ? 'correct' : 'wrong';
};

/**
 * Updates player scores and status after a round
 */
export const processRoundEvaluation = (
    players: PlayersMap,
    cards: { [userId: string]: Card },
    guesses: { [userId: string]: string | null }
): PlayersMap => {
    const updatedPlayers = { ...players };

    Object.keys(updatedPlayers).forEach(userId => {
        const player = updatedPlayers[userId];
        if (!player.alive) return;

        const actualCard = cards[userId];
        const guess = guesses[userId];

        if (actualCard && guess && evaluateGuess(actualCard, guess) === 'correct') {
            player.score += 100;
        } else {
            // Eliminated if wrong or missing guess
            player.alive = false;
        }
    });

    return updatedPlayers;
};

/**
 * Derives a consistent pair ID from two player IDs
 */
export const getPairId = (id1: string, id2: string): string => {
    const sorted = [id1, id2].sort();
    return `pair_${sorted[0]}_${sorted[1]}`;
};
