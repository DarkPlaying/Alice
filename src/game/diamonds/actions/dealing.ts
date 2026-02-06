import type { DiamondsCard, DiamondsPlayer } from '../../diamonds';

// --- DECK GENERATION ---
// Strict Limit: 1 Zombie, 2 Injections, 2 Shotguns for the ENTIRE game.
export const generateDiamondsDeck = (playerCount: number): DiamondsCard[] => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    let deck: DiamondsCard[] = [];
    const ts = Date.now().toString().slice(-6);

    // Calculate EXACT cards needed for 5 rounds
    const rounds = 5;
    const cardsPerPlayer = 7;
    const totalNeeded = playerCount * cardsPerPlayer;

    console.log(`[DIAMONDS_DEALER] Generating POOL for ${playerCount} players. Rounds: ${rounds}, Hand Size: ${cardsPerPlayer}`);
    console.log(`[DIAMONDS_DEALER] Total Cards Required: ${totalNeeded}`);

    // 1. ADD STRICT SPECIALS (Total 5 Cards) with Metadata
    deck.push({
        id: `zom_${ts}`, type: 'special', value: 0, specialType: 'zombie', suit: 'special',
        metadata: { usesRemaining: 1 } // USER REQUEST: No 2nd use
    });
    deck.push({
        id: `inj_${ts}_1`, type: 'special', value: 0, specialType: 'injection', suit: 'special',
        metadata: { usesRemaining: 1 }
    });
    deck.push({
        id: `inj_${ts}_2`, type: 'special', value: 0, specialType: 'injection', suit: 'special',
        metadata: { usesRemaining: 1 }
    });
    deck.push({
        id: `sht_${ts}_1`, type: 'special', value: 0, specialType: 'shotgun', suit: 'special',
        metadata: { usesRemaining: 1 }
    });
    deck.push({
        id: `sht_${ts}_2`, type: 'special', value: 0, specialType: 'shotgun', suit: 'special',
        metadata: { usesRemaining: 1 }
    });

    // 2. FILL WITH UNIQUE STANDARD CARDS
    // We iterate through suits and ranks to create unique cards until totalNeeded is met.
    let standardAdded = 0;
    const specialsCount = 5;
    const standardNeeded = Math.max(0, totalNeeded - specialsCount);

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

        deck.push({
            id: `std_${ts}_${deckCycle}_${rank}_${suit}`,
            type: 'standard',
            rank,
            suit,
            value
        });

        standardAdded++;

        // Cycle through standard deck
        rankIdx++;
        if (rankIdx >= ranks.length) {
            rankIdx = 0;
            suitIdx++;
            if (suitIdx >= suits.length) {
                suitIdx = 0;
                deckCycle++; // Start a "new" standard deck if one isn't enough
            }
        }
    }

    console.log(`[DIAMONDS_DEALER] Deck Inventory:`);
    console.log(`   - Zombie: 1`);
    console.log(`   - Injections: 2`);
    console.log(`   - Shotguns: 2`);
    console.log(`   - Standard: ${standardAdded}`);
    console.log(`   - Total Pool Size: ${deck.length}`);

    return weightedShuffle(deck, playerCount);
};

// --- WEIGHTED SHUFFLE ---
// FORCES specials into Round 1 (Top playerCount * 7 cards)
const weightedShuffle = (deck: DiamondsCard[], playerCount: number): DiamondsCard[] => {
    const specials = deck.filter(c => c.type === 'special');
    const standards = deck.filter(c => c.type === 'standard');

    // Shuffle both pools independently
    const shufSpecials = [...specials].sort(() => Math.random() - 0.5);
    const shufStandards = [...standards].sort(() => Math.random() - 0.5);

    // Round 1 deal size: playerCount * 7 cards.
    // We use a minimum of 2 players (14 cards) threshold to ensure specials aren't pushed back.
    const round1PoolThreshold = Math.max(2, playerCount) * 7;

    let result: DiamondsCard[] = [];

    // Inject all 5 specials into the TOP of the deck
    const round1Standards = shufStandards.splice(0, Math.max(0, round1PoolThreshold - specials.length));
    const round1Pool = [...round1Standards, ...shufSpecials].sort(() => Math.random() - 0.5);

    result = [...round1Pool, ...shufStandards];

    console.log(`[DIAMONDS_DEALER] !!! ROUND 1 FORCE COMPLETE (Threshold: ${round1PoolThreshold}) !!!`);
    const specialPositions = result.map((c, i) => ({
        index: i,
        type: c.type,
        special: c.specialType || '-',
        id: c.id
    })).filter(x => x.type === 'special');

    console.table(specialPositions);

    return result;
};

// --- HAND DEALING ---
export const dealHands = (
    sessionDeck: DiamondsCard[],
    participants: DiamondsPlayer[]
): { updatedParticipants: DiamondsPlayer[], remainingDeck: DiamondsCard[], handsPayload: any[] } => {

    let cleanDeck = [...sessionDeck];
    const handsPayload: any[] = [];

    const updatedParticipants = participants.map(p => {
        if (p.status !== 'active') return p;

        // Deal 7 cards (Total arsenal for the game)
        const hand = cleanDeck.splice(0, 7);

        console.log(`[DIAMONDS_DEALER] Dealt 7 cards to ${p.username}:`);
        hand.forEach(c => {
            const label = c.type === 'special' ? `!!! ${c.specialType?.toUpperCase()} (Uses: ${c.metadata?.usesRemaining}) !!!` : `${c.rank}${c.suit}`;
            console.log(`   - ${label}`);
        });

        handsPayload.push({
            player_id: p.id,
            cards: hand
        });

        return {
            ...p,
            slots: [null, null, null, null, null],
            hasUsedFiveSlots: false
        };
    });

    console.log(`[DIAMONDS_DEALER] Remaining Deck Size: ${cleanDeck.length}`);

    return { updatedParticipants, remainingDeck: cleanDeck, handsPayload };
};
