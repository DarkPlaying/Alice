export type HeartsPhase = 'idle' | 'briefing' | 'shuffle' | 'reveal' | 'choosing' | 'result' | 'end';

export interface Card {
    rank: string;
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    value: number; // for sorting/logic
}

export interface HeartsPlayer {
    id: string; // Firebase UID
    email?: string; // Capturing for persistence safety
    name: string;
    role: 'player' | 'master' | 'admin';
    status: 'active' | 'eliminated' | 'survived';
    score: number;
    eye_of_truth_uses: number; // Master=2, Player=1
    groupId?: string; // ID of the group (e.g., '1', '2')

    // Cross-Reveal Mechanic:
    // own_card is HIDDEN from self (unless Eye used)
    // cards_visible: Array of { playerId, card } that this player can see
    cards_visible?: { playerId: string, card: Card }[];
    last_total_score?: number; // Added for delta calculation
    start_score?: number;     // Added for authoritative Round 1 tracking
}

export interface HeartsGameState {
    id: string; // 'hearts_main'
    phase: HeartsPhase;
    current_round: number;
    system_start: boolean;
    is_paused: boolean;
    active_game_id?: string; // Session ID for history

    participants: HeartsPlayer[];
    groups: Record<string, string[]>; // { [groupId]: [pid1, pid2, pid3] }
    cards: Record<string, Card>;      // { [pid]: Card } (The card assigned to the player)
    guesses: Record<string, { rank?: string, suit?: string }>;  // { [pid]: { rank, suit } }
    eliminated: string[];             // [pid]
    winners: string[];                // [pid]
    chat_counts: Record<string, number>; // { [pid]: count } - Reset each round

    // Timestamp for synchronization
    phase_started_at?: string;
    phase_duration_sec?: number;
    paused_remaining_sec?: number;
    timer_display?: string;
    end_reason?: 'survival' | 'master_defeat' | 'master_victory' | 'max_rounds';
}

// --- Utils ---

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

export const selectRandomCard = (deck: Card[]): Card | null => {
    if (deck.length === 0) return null;
    return deck[Math.floor(Math.random() * deck.length)];
};

export const removeCardFromDeck = (deck: Card[], cardToRemove: Card): Card[] => {
    return deck.filter(c => !(c.rank === cardToRemove.rank && c.suit === cardToRemove.suit));
};

export const shuffleDeck = (deck: Card[]): Card[] => {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
};

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

    // Logic from SpadesGameMaster.tsx
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

export const INITIAL_PLAYER_STATE: HeartsPlayer = {
    id: '',
    name: '',
    role: 'player',
    status: 'active',
    score: 0,
    eye_of_truth_uses: 1
};
