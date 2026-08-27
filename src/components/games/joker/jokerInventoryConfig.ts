// =========================================================
// JOKER GAME CENTRALIZED INVENTORY CONTROL & CONFIGURATION
// =========================================================
import type { SpecialDoorCardType } from './jokerTypes';

export interface SpecialCardMeta {
    type: SpecialDoorCardType;
    name: string;
    desc: string;
    img: string;
    color: string;
    borderGlow: string;
}

// 1. Centralized Default Starting Inventory given to every active candidate
export const DEFAULT_STARTING_INVENTORY: SpecialDoorCardType[] = ['green', 'skip', 'freeze'];

export function getDefaultStartingInventory(isDemoMode: boolean = false): SpecialDoorCardType[] {
    if (isDemoMode) {
        return ['green', 'skip', 'red', 'freeze', 'trump', 'game'];
    }
    return ['green', 'skip', 'freeze'];
}

// 2. Centralized Metadata for all 5 Labyrinth Special Cards
export class SpecialCardMetadata {
    static readonly ALL_CARDS: SpecialCardMeta[] = [
        {
            type: 'green',
            name: 'GREEN CARD',
            desc: 'FREE PASSAGE (0 CR COST) & CLEARS RED MULTIPLIER',
            img: '/specialcard_joker/green.png',
            color: 'border-emerald-300 bg-emerald-50/80 text-emerald-950 shadow-sm',
            borderGlow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]'
        },
        {
            type: 'skip',
            name: 'SKIP CARD',
            desc: 'ADVANCE +2 CELLS INSTANTLY',
            img: '/specialcard_joker/skip.png',
            color: 'border-cyan-300 bg-cyan-50/80 text-cyan-950 shadow-sm',
            borderGlow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]'
        },
        {
            type: 'freeze',
            name: 'FREEZE CARD',
            desc: 'FREEZE TARGET 5X COST',
            img: '/specialcard_joker/freeze.png',
            color: 'border-indigo-300 bg-indigo-50/80 text-indigo-950 shadow-sm',
            borderGlow: 'shadow-[0_0_20px_rgba(99,102,241,0.3)]'
        },
        {
            type: 'red',
            name: 'RED CARD',
            desc: 'BLOCK TARGET PLAYER DOOR (2X/4X/6X COST)',
            img: '/specialcard_joker/red.png',
            color: 'border-red-300 bg-red-50/80 text-red-950 shadow-sm',
            borderGlow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]'
        },
        {
            type: 'trump',
            name: 'TRUMP CARD',
            desc: 'SWAP ROOM POSITION WITH TARGET OPPONENT',
            img: '/specialcard_joker/trumph.png',
            color: 'border-amber-300 bg-amber-50/80 text-amber-950 shadow-sm',
            borderGlow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]'
        },
        {
            type: 'game',
            name: 'GAME CARD',
            desc: 'REVEALS 30S ROTATED MAP & YOUR ASSIGNED EXIT GATE',
            img: '/specialcard_joker/game.png',
            color: 'border-purple-300 bg-purple-50/80 text-purple-950 shadow-sm',
            borderGlow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]'
        }
    ];

    static getCardMeta(type: SpecialDoorCardType): SpecialCardMeta {
        return this.ALL_CARDS.find(c => c.type === type) || this.ALL_CARDS[0];
    }
}

// 3. Centralized Inventory Helper Utilities

export function getCardCountInInventory(inventory: SpecialDoorCardType[] = [], cardType: SpecialDoorCardType): number {
    return (inventory || []).filter(c => c === cardType).length;
}

export function addCardToInventory(inventory: SpecialDoorCardType[] = [], cardType: SpecialDoorCardType): SpecialDoorCardType[] {
    return [...(inventory || []), cardType];
}

export function removeOneCardFromInventory(inventory: SpecialDoorCardType[] = [], cardType: SpecialDoorCardType): SpecialDoorCardType[] {
    const idx = (inventory || []).indexOf(cardType);
    if (idx === -1) return [...(inventory || [])];
    return inventory.filter((_, i) => i !== idx);
}

export function removeAllCardsOfTypeFromInventory(inventory: SpecialDoorCardType[] = [], cardType: SpecialDoorCardType): SpecialDoorCardType[] {
    return (inventory || []).filter(c => c !== cardType);
}

// Unified Red & Freeze Multiplier Calculation:
// Red: 1 Red = 2X, 2 Red = 4X, 3+ Red = 6X (Max 6X)
// Freeze: Adds +5X to target (5X if no penalty, or +5X to active Red penalty e.g. 6X + 5 = 11X)
export function calculateRedCostMultiplier(inventory: SpecialDoorCardType[] = [], cellRedCount: number = 0, isFrozen: boolean = false): number {
    const totalRedCount = getCardCountInInventory(inventory, 'red') + cellRedCount;
    let baseRedMult = 1;
    if (totalRedCount >= 3) baseRedMult = 6;
    else if (totalRedCount === 2) baseRedMult = 4;
    else if (totalRedCount === 1) baseRedMult = 2;

    if (isFrozen) {
        return baseRedMult > 1 ? baseRedMult + 5 : 5;
    }

    return baseRedMult;
}
