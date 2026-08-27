// =========================================================
// JOKER GAME (THE ULTIMATE PROTOCOL) TYPES & DATA INTERFACES
// =========================================================

export type JokerPhase = 
    | 'idle'
    | 'briefing'
    | 'choosing'
    | 'reveal'
    | 'minigame'
    | 'scoring'
    | 'end';

export type SpecialDoorCardType = 'red' | 'green' | 'skip' | 'freeze' | 'trump' | 'game';

export interface DoorData {
    direction: 'up' | 'down' | 'left' | 'right';
    cost: number;
    cardType: 'standard' | 'special';
    specialType?: SpecialDoorCardType;
    specialCards?: SpecialDoorCardType[];
    label?: string;
    isBlocked?: boolean;
    isLocked?: boolean;
}

export interface MapCell {
    r: number;
    c: number;
    type: 'empty' | 'wall' | 'entry' | 'exit' | 'path';
    entryIndex?: number; // 1, 2, 3
    exitIndex?: number;  // 1, 2, 3
    doors: DoorData[];
    isBlockedCell?: boolean;
    specialCards?: SpecialDoorCardType[];
}

export interface JokerPlayer {
    id: string;
    username: string;
    avatar_url?: string;
    currentR: number;
    currentC: number;
    entryIndex: number; // 1, 2, 3
    targetExitIndex: number; // 1, 2, 3
    score: number;
    status: 'active' | 'eliminated' | 'escaped';
    inventory: SpecialDoorCardType[];
    hasUsedGreenCard?: boolean;
    hasUsedSkipCard?: boolean;
    nextRoundCostMultiplier?: number; // Red card = 2X/4X/6X, Freeze = 5X
    blockedDoorsByRed?: ('up' | 'right' | 'down' | 'left')[];
    blockedByPlayerName?: string;
    blockedByPlayerId?: string;
    trumpSwappedBy?: string;
    trumpSwappedFromRoom?: { r: number; c: number };
    trumpSwappedToRoom?: { r: number; c: number };
    frozenBy?: string;
    frozenByPlayerId?: string; // Freeze card = 5X
    frozenUntilRound?: number;
    hasReachedExit?: boolean;
    pendingDoorChoice?: {
        door: DoorData;
        finalCost: number;
        isSkip: boolean;
        isLocked?: boolean;
        isProcessed?: boolean;
    };
    lastDoorChoice?: {
        door: DoorData;
        finalCost: number;
        isSkip: boolean;
        isLocked?: boolean;
        isProcessed?: boolean;
    };
    boughtDoorChoice?: {
        door: DoorData;
        finalCost: number;
        isSkip: boolean;
        isLocked?: boolean;
        isProcessed?: boolean;
    };
    minigameHistory?: Record<number, 'win' | 'loss'>;
}

export interface JokerGameState {
    id: string;
    phase: JokerPhase;
    current_round: number; // 1 to 14
    phase_started_at: string;
    phase_duration_sec: number;
    is_paused: boolean;
    system_start: boolean;
    map_rotation: number; // 0, 90, 180, 270
    map_matrix: any;
    old_map_matrix?: MapCell[][];
    new_map_matrix?: MapCell[][];
    participants: JokerPlayer[];
    allowed_players: string[];
    is_demo_mode?: boolean;
    game_logs: Array<{ id: string; msg: string; timestamp: number }>;
    winner_id?: string | null;
    winner_username?: string | null;
    claimed_cards?: Record<string, string>;
}
