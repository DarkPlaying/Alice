import type { Card } from './types';
export * from './types';

// Logic: COPIED FROM SPADES GAME (SpadesGameMaster.tsx) per User Request
// Handles partitioning into groups of 2 and 3.
export const assignGroups = (playerIds: string[]) => {
    // Fisher-Yates Shuffle for robust randomization (Matches Spades)
    const ids = [...playerIds];
    for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const n = ids.length;

    const groupsList: string[][] = [];

    if (n < 2) {
        groupsList.push(ids);
    } else if (n === 2 || n === 3) {
        groupsList.push(ids);
    } else if (n === 4) {
        groupsList.push(ids.slice(0, 2));
        groupsList.push(ids.slice(2, 4));
    } else if (n === 5) {
        groupsList.push(ids.slice(0, 3));
        groupsList.push(ids.slice(3, 5));
    } else {
        // N > 5: Partition into 3s and 2s
        let remaining = ids;
        while (remaining.length > 0) {
            if (remaining.length === 2 || remaining.length === 4) {
                // Force a Pair if we have 2 or 4 left
                groupsList.push(remaining.slice(0, 2));
                remaining = remaining.slice(2);
            } else {
                // Otherwise take a Trio
                groupsList.push(remaining.slice(0, 3));
                remaining = remaining.slice(3);
            }
        }
    }

    // Convert list to Record<string, string[]> map
    const groups: Record<string, string[]> = {};
    groupsList.forEach((members, index) => {
        groups[String(index + 1)] = members;
    });

    return groups;
};

export const generateDeck = (): Card[] => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];

    suits.forEach(suit => {
        ranks.forEach((rank, index) => {
            deck.push({ rank, suit, value: index + 2 });
        });
    });

    return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
};

export const evaluateGuess = (actualCard: Card, guessSuit: string): 'correct' | 'wrong' => {
    return actualCard.suit === guessSuit ? 'correct' : 'wrong';
};
