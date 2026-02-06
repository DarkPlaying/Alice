// Spades Game Type Definitions
// Centralized types for Spades game state, players, and rounds

export type SpadesPhase = 'idle' | 'briefing' | 'shuffle' | 'hint' | 'bidding' | 'reveal' | 'completed';

export interface Card {
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    rank: string; // 'A', '2'-'10', 'J', 'Q', 'K'
    value: number;
    color: 'red' | 'black';
}

export interface PlayerState {
    id: string;
    username: string;
    score: number;
    start_score?: number;
    cards: Card[];
    bid: number | null;
    status: 'active' | 'eliminated';
    groupId: number | null; // The table/pod this player is assigned to
}

export type PlayersMap = Record<string, PlayerState>;

export interface GroupRoundInfo {
    target_card: Card | null;
    hint: string | null;
    winner_id: string | null;
    ties: string[]; // Player IDs in a tie
}

export type RoundData = Record<string, GroupRoundInfo>; // Map of groupId (stringified) -> Round Info

export interface GameState {
    id: string;
    phase: SpadesPhase;
    current_round: number;
    is_paused: boolean;
    system_start: boolean;
    players: PlayersMap;
    round_data: RoundData;
    deck: Card[];
    phase_started_at: string | null; // ISO8601 UTC timestamp
    phase_duration_sec: number | null;
    paused_remaining_sec: number | null;
    allowed_players?: string[];
    updated_at: string;
}

export interface BidEntry {
    id: string;
    game_id: string;
    player_id: string;
    round: number;
    bid_amount: number;
    created_at: string;
}

export interface PresenceState {
    userId: string;
    name: string;
    avatar?: string;
    isAdmin: boolean;
}
