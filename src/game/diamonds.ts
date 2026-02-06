
export type DiamondsPhase = 'idle' | 'briefing' | 'shuffle' | 'dealing' | 'slotting' | 'evaluation' | 'picking' | 'scoring' | 'end';

export type SpecialCard = 'zombie' | 'injection' | 'shotgun';

export interface DiamondsCard {
    id: string;
    type: 'standard' | 'special';
    rank?: string;
    suit?: string;
    value: number;
    specialType?: SpecialCard;
    isRevealed?: boolean;
    metadata?: {
        usesRemaining: number;
    };
}

export interface BattleResult {
    winners: string[];
    losers: string[];
    eliminatedIds: string[];
    p1Total?: number;
    p2Total?: number;
    p3Total?: number;
    effects?: {
        playerId: string;
        type: 'infected' | 'cured' | 'eliminated';
        desc: string;
        originalCardId?: string;
        slotIndex?: number;
    }[];
    slotDetails?: {
        p1Val: number;
        p2Val: number;
        p3Val?: number;
        p1Card?: DiamondsCard | null;
        p2Card?: DiamondsCard | null;
        p3Card?: DiamondsCard | null;
        outcome: string;
    }[];
}

export interface DiamondsPlayer {
    id: string;
    username: string;
    score: number;
    cards: DiamondsCard[];
    slots: (DiamondsCard | null)[];
    status: 'active' | 'eliminated' | 'survived';
    role?: 'admin' | 'player' | 'master';
    groupId?: number;
    zombieUses?: number;
    isZombie?: boolean;
    hasUsedFiveSlots?: boolean;
    hasUsedRefresh?: boolean;
    hasUsedDetector?: boolean;
    roundAdjustment?: number;
}

export interface DiamondsGameState {
    id: string;
    phase: DiamondsPhase;
    current_round: number;
    participants: DiamondsPlayer[];
    active_game_id?: string;
    round_data?: any;
    updated_at?: string;
    phase_started_at?: string;
    phase_duration_sec?: number;
    is_paused?: boolean;
    system_start?: boolean;
}


export const getCardImagePath = (card: DiamondsCard): string => {
    if (card.type === 'special') {
        const nameMap: Record<string, string> = { 'zombie': 'zombie.png', 'injection': 'injection.png', 'shotgun': 'gun.png' };
        return `/special cards/${nameMap[card.specialType || 'zombie']}`;
    } else {
        const suit = card.suit ? card.suit.charAt(0).toUpperCase() + card.suit.slice(1).toLowerCase() : 'Diamonds';
        const rank = card.rank || 'A';
        return `/borderland_cards/${suit}_${rank}.png`;
    }
};

