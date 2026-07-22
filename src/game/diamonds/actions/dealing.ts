import type { DiamondsCard, DiamondsPlayer } from '../../diamonds';

// --- DECK GENERATION ---
// Each player gets exactly 7 standard cards + 1 special card.
export const generateDiamondsDeck = (playerCount: number): DiamondsCard[] => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    let specialsPool: DiamondsCard[] = [];
    let standardPool: DiamondsCard[] = [];
    const ts = Date.now().toString().slice(-6);

    console.log(`[DIAMONDS_DEALER] Generating POOL for ${playerCount} players.`);

    // 1. GENERATE SPECIALS
    // N players = N special cards total
    const specialTypes = ['zombie', 'injection', 'shotgun'];
    const selectedSpecials: string[] = [];

    if (playerCount > 0) {
        selectedSpecials.push('zombie'); // Always 1 zombie
    }
    if (playerCount === 2) {
        selectedSpecials.push(Math.random() > 0.5 ? 'injection' : 'shotgun');
    } else if (playerCount >= 3) {
        selectedSpecials.push('injection');
        selectedSpecials.push('shotgun');
        // If more than 3, randomly assign the rest
        for (let i = 3; i < playerCount; i++) {
            selectedSpecials.push(specialTypes[Math.floor(Math.random() * specialTypes.length)]);
        }
    }

    selectedSpecials.forEach((sType, index) => {
        specialsPool.push({
            id: `spec_${ts}_${index}`, 
            type: 'special', 
            value: 0, // Base value (Zombie will be evaluated as 999 later)
            specialType: sType as any, 
            suit: 'special',
            metadata: { usesRemaining: 1 }
        });
    });

    // 2. GENERATE STANDARD CARDS
    // N players = N * 7 standard cards
    const standardNeeded = playerCount * 7;
    let standardAdded = 0;
    let suitIdx = 0;
    let rankIdx = 0;
    let deckCycle = 0;

    while (standardAdded < standardNeeded) {
        const suit = suits[suitIdx];
        const rank = ranks[rankIdx];

        let value = parseInt(rank);
        if (rank === 'J') value = 11;
        if (rank === 'Q') value = 12;
        if (rank === 'K') value = 13;
        if (rank === 'A') value = 14;

        standardPool.push({
            id: `std_${ts}_${deckCycle}_${rank}_${suit}`,
            type: 'standard',
            rank,
            suit,
            value
        });

        standardAdded++;
        rankIdx++;
        if (rankIdx >= ranks.length) {
            rankIdx = 0;
            suitIdx++;
            if (suitIdx >= suits.length) {
                suitIdx = 0;
                deckCycle++; 
            }
        }
    }

    // Shuffle both pools independently
    specialsPool = specialsPool.sort(() => Math.random() - 0.5);
    standardPool = standardPool.sort(() => Math.random() - 0.5);

    // Combine them (Specials first, standard next). The dealer will pick 1 special and 7 standard.
    return [...specialsPool, ...standardPool];
};

// --- HAND DEALING ---
export const dealHands = (
    sessionDeck: DiamondsCard[],
    participants: DiamondsPlayer[]
): { updatedParticipants: DiamondsPlayer[], remainingDeck: DiamondsCard[], handsPayload: any[] } => {

    // First N cards in sessionDeck are the specials (because we pushed them first in generateDiamondsDeck).
    // The rest are standard cards.
    // However, to be safe, we'll split them by type:
    let specials = sessionDeck.filter(c => c.type === 'special');
    let standards = sessionDeck.filter(c => c.type === 'standard');
    
    const handsPayload: any[] = [];

    const updatedParticipants = participants.map(p => {
        if (p.status !== 'active') return p;

        // Deal exactly 1 special and 7 standard cards
        const mySpecial = specials.splice(0, 1);
        const myStandards = standards.splice(0, 7);
        const hand = [...mySpecial, ...myStandards].sort(() => Math.random() - 0.5); // shuffle the player's hand

        console.log(`[DIAMONDS_DEALER] Dealt 8 cards to ${p.username}:`);
        hand.forEach(c => {
            const label = c.type === 'special' ? `!!! ${c.specialType?.toUpperCase()} !!!` : `${c.rank}${c.suit}`;
            console.log(`   - ${label}`);
        });

        handsPayload.push({
            player_id: p.id,
            cards: hand
        });

        return {
            ...p,
            cards: hand, // IMPORTANT: update the cards locally in memory for immediate state mapping
            slots: [null, null, null, null, null],
            hasUsedFiveSlots: false
        };
    });

    const remainingDeck = [...specials, ...standards];
    console.log(`[DIAMONDS_DEALER] Remaining Deck Size: ${remainingDeck.length}`);

    return { updatedParticipants, remainingDeck, handsPayload };
};
