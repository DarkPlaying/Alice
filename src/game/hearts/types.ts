// Types for Hearts "Cross-Reveal" Game

export type HeartsPhase =
    | 'idle'
    | 'briefing'
    | 'connection'
    | 'playing'
    | 'guess'
    | 'evaluation'
    | 'completed';

export interface Card {
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    rank: string;
    color: 'red' | 'black';
}

export interface PlayerState {
    id: string;
    username: string;
    score: number;
    start_score?: number; // Added for revert functionality
    alive: boolean;
    eye_used: boolean;
    role: 'admin' | 'master' | 'player';
    bid?: number | null; // Placeholder for compatibility or future use
}

export interface PlayersMap {
    [userId: string]: PlayerState;
}

export interface Message {
    senderId: string;
    text: string;
    timestamp: string;
}

export interface PairMessages {
    texts: Message[];
    count: number;
}

export interface RoundData {
    pairings: [string, string][]; // List of player ID pairs
    cards: { [userId: string]: Card }; // Map of user ID to their hidden card
    messages: { [pairId: string]: PairMessages }; // pairId is derived from sorted sorted IDs: `pair_ID1_ID2`
    guesses: { [userId: string]: string | null }; // Map of user ID to their suit guess
}

export interface HeartsGameState {
    id: string;
    phase: HeartsPhase;
    current_round: number;
    is_paused: boolean;
    system_start: boolean;
    players: PlayersMap;
    round_data: RoundData;
    phase_started_at: string | null;
    phase_duration_sec: number;
    paused_remaining_sec: number | null;
    updated_at: string;
}

export interface PresenceState {
    userId: string;
    name: string;
    role: string;
    isAdmin: boolean;
}
