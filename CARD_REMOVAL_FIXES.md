# CRITICAL BUGS: Card Removal & Vote Persistence

## Issues from Screenshots:

### Issue 1: Inconsistent Card Removal
**Master View (Round 2):**
- ❌ Only 4 cards remaining (Angel, 4, 6, 7)
- ❌ Too many cards removed!

**Player View (Round 2):**
- ❌ All 13 cards still showing
- ❌ No cards removed!

**Expected:**
- ✅ Both should have 9 cards (removed: A, 2, 3, 4)

### Issue 2: Vote Indicators Persist
**Player View:**
- ❌ Cards 3 and 5 still show "VOTED" badges from Round 1
- ✅ Should be cleared when new round starts

---

## Root Causes:

### Cause 1: Master and Player Use Different Card States
- **Master** has `cards` state that gets updated
- **Player** has `cards` state that's NOT synced
- They don't share the same source of truth!

### Cause 2: Vote State Not Reset
- `myVote` state is not cleared between rounds
- `globalVotes` state is not cleared

### Cause 3: No Supabase Sync for Available Cards
- Card removal happens locally, not saved to Supabase
- When player refreshes/reconnects, they get all cards again

---

## SOLUTION:

### Fix 1: Supabase Source of Truth

**Add to clubs_game_status table (already done in migration):**
```sql
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS available_cards JSONB DEFAULT '["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]'::jsonb;
```

### Fix 2: Save Card Removal to Supabase

**In ClubsGameMaster.tsx, after round evaluation completes:**

```typescript
// After determining which cards to remove
const cardsToRemove = [
    selection.angel,      // Master's angel
    selection.demon,      // Master's demon  
    consensus?.playerAngel, // Player's angel
    consensus?.playerDemon  // Player's demon
].filter(Boolean) as string[];

// Calculate remaining cards
const remainingCards = RANKS.filter(rank => !cardsToRemove.includes(rank));

// Save to Supabase
const { error } = await supabase
    .from('clubs_game_status')
    .update({
        available_cards: remainingCards,
        current_round: round + 1
    })
    .eq('id', 'clubs_king');

if (error) {
    console.error('Failed to save card removal:', error);
} else {
    console.log('Round complete. Removed:', cardsToRemove);
    console.log('Remaining cards:', remainingCards);
}
```

### Fix 3: Load Available Cards on Round Start

**Both Master and Player files need this:**

```typescript
// Listen for round changes and load available cards
useEffect(() => {
    const loadAvailableCards = async () => {
        const { data, error } = await supabase
            .from('clubs_game_status')
            .select('available_cards, current_round')
            .eq('id', 'clubs_king')
            .single();

        if (data?.available_cards) {
            const availableRanks = data.available_cards as string[];
            
            // Create cards from available ranks only
            const newCards = availableRanks.map(rank => ({
                id: `clubs-${rank}`,
                suit: 'clubs' as const,
                rank,
                masterRole: null,
                playerRole: null,
                isRevealed: false,
                isRemoved: false
            }));

            setCards(newCards);
            console.log(`Round ${data.current_round}: Loaded ${newCards.length} cards`);
        }
    };

    loadAvailableCards();

    // Also subscribe to changes
    const channel = supabase
        .channel('card_sync')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'clubs_game_status',
            filter: 'id=eq.clubs_king'
        }, (payload) => {
            if (payload.new.available_cards) {
                loadAvailableCards();
            }
        })
        .subscribe();

    return () => {
        channel.unsubscribe();
    };
}, [round]);
```

### Fix 4: Clear Vote State on Round Start

**Add this to both Master and Player files:**

```typescript
// Clear votes when starting new round
useEffect(() => {
    // Clear local vote state
    setMyVote([]);
    setGlobalVotes({});
    
    console.log(`Round ${round} started - votes cleared`);
}, [round]);
```

### Fix 5: Broadcast Round Completion

**In ClubsGameMaster.tsx (Master initiates round progression):**

```typescript
const completeRound = async () => {
    // 1. Calculate scores
    const scores = calculateScores(playerVotes, masterVotes);
    
    // 2. Determine cards to remove
    const cardsToRemove = [
        selection.angel,
        selection.demon,
        consensus?.playerAngel,
        consensus?.playerDemon
    ].filter(Boolean) as string[];

    // 3. Calculate remaining cards
    const remainingCards = RANKS.filter(rank => !cardsToRemove.includes(rank));

    // 4. Update Supabase (single source of truth)
    await supabase
        .from('clubs_game_status')
        .update({
            current_round: round + 1,
            available_cards: remainingCards,
            master_score: score + scores.masterScore,
            player_total_score: masterScore + scores.playerScore
        })
        .eq('id', 'clubs_king');

    // 5. Broadcast to all clients
    await supabase.channel('game_room').send({
        type: 'broadcast',
        event: 'round_complete',
        payload: {
            round: round + 1,
            removedCards: cardsToRemove,
            availableCards: remainingCards,
            scores: scores
        }
    });

    // 6. Update local state
    setRound(round + 1);
    setScore(score + scores.playerScore);
    setMasterScore(masterScore + scores.masterScore);
};
```

---

## Implementation Plan:

### Step 1: Add Supabase Card Sync (Master File)
**Location:** ClubsGameMaster.tsx
**Where:** After round evaluation completes
**Action:** Save `available_cards` to Supabase

### Step 2: Load Cards from Supabase (Both Files)
**Location:** ClubsGameMaster.tsx AND ClubsGame.tsx
**Where:** useEffect on round change
**Action:** Load cards from `available_cards` column

### Step 3: Clear Votes on Round Start (Both Files)
**Location:** Both files
**Where:** useEffect on round change
**Action:** Reset `myVote` and `globalVotes` to empty

### Step 4: Subscribe to Card Updates (Player File)
**Location:** ClubsGame.tsx
**Where:** useEffect
**Action:** Listen for Supabase changes to `available_cards`

---

## Testing Checklist:

```
Round 1:
□ Both master and player see 13 cards
□ Master selects A, 2
□ Players select 3, 4
□ Voting works
□ Evaluation shows correct cards

Round 1 Complete:
□ Cards A, 2, 3, 4 are removed
□ Supabase updated with remaining cards: [5,6,7,8,9,10,J,Q,K]
□ Vote indicators cleared

Round 2 Start:
□ Master sees 9 cards (5-K)
□ Player sees 9 cards (5-K) ✅ SAME as master
□ No vote indicators showing
□ Fresh voting state
```

---

## Quick Fix (Temporary):

If you need a quick fix RIGHT NOW, add this to BOTH files at the start of each round:

```typescript
// Reset to common state
const resetForNewRound = () => {
    // Load all cards minus removed ones
    const removed = ['A', '2', '3', '4']; // Hardcode for Round 2
    const available = RANKS.filter(r => !removed.includes(r));
    
    setCards(available.map(rank => ({
        id: `clubs-${rank}`,
        suit: 'clubs' as const,
        rank,
        masterRole: null,
        playerRole: null,
        isRevealed: false,
        isRemoved: false
    })));
    
    setMyVote([]);
    setGlobalVotes({});
};
```

But the PROPER fix is to use Supabase as the single source of truth!
