// Types for Hearts "Cross-Reveal" Game
// Consolidated from src/game/hearts.ts

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

export const INITIAL_PLAYER_STATE: HeartsPlayer = {
    id: '',
    name: '',
    role: 'player',
    status: 'active',
    score: 0,
    eye_of_truth_uses: 1
};
