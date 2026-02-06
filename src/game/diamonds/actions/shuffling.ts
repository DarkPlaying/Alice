import type { DiamondsCard, DiamondsPlayer } from '../../diamonds';

// --- DECK SHUFFLING ---
export const shuffleDeck = (deck: DiamondsCard[]): DiamondsCard[] => {
    // Fisher-Yates Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

// --- PAIRING LOGIC (1v1 or 1v1v1) ---
export const assignGroups = (participants: DiamondsPlayer[]): DiamondsPlayer[] => {
    // 1. Filter only active players
    const active = participants.filter(p => p.status === 'active');

    // 2. Shuffle players to randomize match-ups
    const shuffledPlayers = [...active].sort(() => Math.random() - 0.5);

    // 3. Assign Groups
    console.log(`[DIAMONDS_SHUFFLER] Grouping ${shuffledPlayers.length} active players.`);

    // Map to store assigned group IDs
    const groupMap: Record<string, number> = {};
    let groupId = 1;

    let i = 0;
    while (i < shuffledPlayers.length) {
        // How many players left?
        const remaining = shuffledPlayers.length - i;

        // If 3 players left, MAKE THEM A THREESOME (1v1v1)
        if (remaining === 3) {
            console.log(`[DIAMONDS_SHUFFLER] Creating 3-way battle (Group ${groupId})`);
            groupMap[shuffledPlayers[i].id] = groupId;
            groupMap[shuffledPlayers[i + 1].id] = groupId;
            groupMap[shuffledPlayers[i + 2].id] = groupId;
            i += 3;
            groupId++;
        }
        // Standard Pair (1v1)
        else if (remaining >= 2) {
            groupMap[shuffledPlayers[i].id] = groupId;
            groupMap[shuffledPlayers[i + 1].id] = groupId;
            i += 2;
            groupId++;
        }
        // Lone player (Should technically be 3 unless started with 1?)
        // If 1 player remains, they get a "Bye" or sit out? 
        // Logic says "if 22 then 11, if 23 then 10 pairs then 1 3 pairs".
        // This implies strict handling. Our remaining===3 check catches the odd one out at the end.
        // What if total is 1? Solitaire?
        else {
            console.warn("[DIAMONDS_SHUFFLER] Lone player detected. Assigning solo group.");
            groupMap[shuffledPlayers[i].id] = groupId;
            i++;
            groupId++;
        }
    }

    // 4. Return updated participants list (preserving inactive ones too)
    return participants.map(p => {
        if (groupMap[p.id]) {
            return { ...p, groupId: groupMap[p.id] };
        }
        return p; // Inactive keep old groupId or null? Maybe null to be safe.
    });
};
