import type { DiamondsCard } from '../../diamonds';

// --- SLOTTING VALIDATION ---

export const validateSlots = (slots: (DiamondsCard | null)[]): boolean => {
    // 1. Max 5 Slots
    const filled = slots.filter(s => s !== null);
    if (filled.length > 5) return false;

    // 2. Zombie / Injection / Shotgun Logic constraints (if any)
    // Currently no restriction on *placing* them, only on *resolving* them.
    // e.g. You can slot a Zombie and a Shotgun.

    return true;
};

export const autoFillSlots = (hand: DiamondsCard[], currentSlots: (DiamondsCard | null)[]): (DiamondsCard | null)[] => {
    // If player didn't slot in time, auto-slot random cards?
    // Or just submit empty? 
    // Usually auto-play is nice.

    // Simple implementation: Fill empty slots with first available cards from hand
    const filled = [...currentSlots];
    const usedIds = new Set(filled.filter(c => c).map(c => c!.id));
    const available = hand.filter(c => !usedIds.has(c.id));

    for (let i = 0; i < 5; i++) {
        if (filled[i] === null && available.length > 0) {
            filled[i] = available.shift() || null;
        }
    }
    return filled;
};
