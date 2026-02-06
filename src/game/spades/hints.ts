// Spades Hint Generation
// Pure functions for generating human-readable hints for target cards

import type { Card } from './types';

/**
 * Generate a human-readable hint for a given card.
 * 
 * The hint reveals partial information about the target card to help players
 * make informed bidding decisions.
 * 
 * Examples:
 * - "Ace (Face Card) · Red Suit"
 * - "Value < 8 · Black Suit"
 * - "Queen (Face Card) · Red Suit"
 * 
 * @param card - The target card to generate a hint for
 * @returns A human-readable hint string
 */
export function buildHint(card: Card): string {
    const hints: string[] = [];

    // Face card detection
    if (['J', 'Q', 'K', 'A'].includes(card.rank)) {
        const faceNames: Record<string, string> = {
            'J': 'Jack',
            'Q': 'Queen',
            'K': 'King',
            'A': 'Ace'
        };
        // Rule: Only mention it is a face card, DO NOT mention color
        return `${faceNames[card.rank]} (Face Card)`;
    }

    // Numeric value hints
    const numVal = parseInt(card.rank);
    if (!isNaN(numVal)) {
        if (numVal < 8) {
            hints.push('Value < 8');
        } else {
            hints.push('Value ≥ 8');
        }
    }

    // Color hint (Only for non-face cards)
    hints.push(card.color === 'red' ? 'Red Suit' : 'Black Suit');

    return hints.join(' · ');
}

/**
 * Generate a full deck of 52 cards.
 * 
 * @returns Array of 52 cards (13 ranks × 4 suits)
 */
export function generateDeck(): Card[] {
    const suits: Array<'hearts' | 'diamonds' | 'clubs' | 'spades'> = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck: Card[] = [];

    suits.forEach(suit => {
        ranks.forEach(rank => {
            const color: 'red' | 'black' = (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black';
            const value = getCardValue(rank);
            deck.push({ suit, rank, value, color });
        });
    });

    return deck;
}

/**
 * Get the numeric value of a card rank for tie-breaking purposes.
 * 
 * @param rank - The card rank
 * @returns Numeric value (1-13)
 */
function getCardValue(rank: string): number {
    if (rank === 'A') return 14; // Aces high
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    return parseInt(rank);
}

/**
 * Remove a card from the deck.
 * 
 * @param deck - The current deck
 * @param card - The card to remove
 * @returns New deck with the card removed
 */
export function removeCardFromDeck(deck: Card[], card: Card): Card[] {
    return deck.filter(c =>
        !(c.suit === card.suit && c.rank === card.rank)
    );
}

/**
 * Select a random card from the deck.
 * 
 * @param deck - The current deck
 * @returns A random card from the deck, or null if deck is empty
 */
export function selectRandomCard(deck: Card[]): Card | null {
    if (deck.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * deck.length);
    return deck[randomIndex];
}

/**
 * Generate a sorted/curated sequence of 5 target cards for a group.
 * 
 * Rules:
 * - 5 Rounds Total.
 * - 2 Cards < 8 (Low)
 * - 1 Card > 8 (High/Mid-High, excluding Face cards if possible, or just >8)
 * - 1 Positive Face Card (Black J, Q, K, A)
 * - 1 Negative Face Card (Red J, Q, K, A)
 * - Order is RANDOM.
 * 
 * @param deck - The main deck to draw from.
 * @returns Object containing the 5 selected cards and the remaining deck.
 */
// --- Optimized Round Type Logic ---

export type TargetType = 'pos_face' | 'neg_face' | 'high' | 'low';

/**
 * Generate the randomized sequence of target types for the 5-round game.
 * Ensures the exact distribution: 1 Pos Face, 1 Neg Face, 1 High (>8), 2 Low (<8).
 */
export function generateRoundTypesSequence(): TargetType[] {
    const types: TargetType[] = ['pos_face', 'neg_face', 'high', 'low', 'low'];
    // Fisher-Yates shuffle
    for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
    }
    return types;
}

/**
 * Select a single card from the deck matching the requested type.
 */
export function selectCardByType(deck: Card[], type: TargetType): { card: Card, remainingDeck: Card[] } | null {
    let currentDeck = [...deck];

    const predicate = (c: Card): boolean => {
        const rankVal = parseInt(c.rank);
        const isFace = ['J', 'Q', 'K', 'A'].includes(c.rank);

        switch (type) {
            case 'pos_face': // Black Face (J, Q, K, A)
                return isFace && c.color === 'black';
            case 'neg_face': // Red Face (J, Q, K, A)
                return isFace && c.color === 'red';
            case 'high': // > 8 (9, 10). Exclude Face (covered above) to be distinct
                return !isFace && !isNaN(rankVal) && rankVal > 8;
            case 'low': // < 8 (2..7)
                return !isFace && !isNaN(rankVal) && rankVal < 8;
            default:
                return false;
        }
    };

    const candidates = currentDeck.filter(predicate);
    if (candidates.length === 0) {
        // Fallback: If strict type not found, try soft fallback or just random?
        // User requirements are strict. But game must go on.
        console.warn(`[SPADES HINTS] No card found for type ${type}. Returning random.`);
        return null;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    currentDeck = removeCardFromDeck(currentDeck, chosen);

    return { card: chosen, remainingDeck: currentDeck };
}

// Keep legacy for compatibility if needed, but we will switch to above.
export function generateCuratedRoundTargets(deck: Card[]): { selected: Card[], remainingDeck: Card[] } {
    // ... Legacy unused ...
    return { selected: [], remainingDeck: deck };
}
