# Implementation Complete - Symmetric Scoring System

## ✅ **Changes Made:**

### 1. Card Interface (RESTORED)
```typescript
interface Card {
    id: string;
    suit: 'clubs';
    rank: string;
    masterRole: 'angel' | 'demon' | null;  // ✅ Role Master assigns
    playerRole: 'angel' | 'demon' | null;  // ✅ Role Players assign
    isRevealed: boolean;
    isRemoved: boolean;
}
```

### 2. State Added
```typescript
const [usedCards, setUsedCards] = useState<Set<string>>(new Set());
```

### 3. initializeBoard Function
- ✅ Creates cards with `masterRole: null` and `playerRole: null`
- ✅ Filters out used cards in subsequent rounds

### 4. Evaluation UI Fixed
- ✅ Line 1319: Master's Angel → `x.masterRole === 'angel'`
- ✅ Line 1327: Master's Demon → `x.masterRole === 'demon'`
- ✅ Line 1348: Player's Angel → `x.playerRole === 'angel'`
- ✅ Line 1357: Player's Demon → `x.playerRole === 'demon'`

---

## ⏭️ **Next Steps:**

### Step 1: Add Scoring Function

Add this after the `resolveTargets()` function (around line 750):

```typescript
// Calculate scores based on votes matching target roles
const calculateScores = (
    playerVotes: string[],  // Cards players voted for
    masterVotes: string[]   // Cards master voted for
) => {
    let playerScore = 0;
    let masterScore = 0;
    
    const scoreBreakdown = {
        player: [] as string[],
        master: [] as string[]
    };

    // Player scoring: Did they find Master's targets?
    playerVotes.forEach(cardId => {
        const card = cards.find(c => c.rank === cardId || c.id === cardId);
        if (!card) return;

        if (card.masterRole === 'angel') {
            playerScore += 300;
            scoreBreakdown.player.push(`Found Master's ANGEL (${card.rank}): +300`);
        } else if (card.masterRole === 'demon') {
            playerScore -= 50;
            scoreBreakdown.player.push(`Hit Master's DEMON (${card.rank}): -50`);
        }
    });

    // Master scoring: Did they find Player's targets?
    masterVotes.forEach(cardId => {
        const card = cards.find(c => c.rank === cardId || c.id === cardId);
        if (!card) return;

        if (card.playerRole === 'angel') {
            masterScore += 300;
            scoreBreakdown.master.push(`Found Player's ANGEL (${card.rank}): +300`);
        } else if (card.playerRole === 'demon') {
            masterScore -= 50;
            scoreBreakdown.master.push(`Hit Player's DEMON (${card.rank}): -50`);
        }
    });

    return {
        playerScore,
        masterScore,
        scoreBreakdown
    };
};
```

### Step 2: Add Card Removal Function

```typescript
// Remove voted cards from next round
const processRoundEnd = () => {
    // Get all cards that have roles assigned
    const masterTargets = cards
        .filter(c => c.masterRole !== null)
        .map(c => c.rank);
    
    const playerTargets = cards
        .filter(c => c.playerRole !== null)
        .map(c => c.rank);

    // Combine all targets for removal
    const allTargets = [...new Set([...masterTargets, ...playerTargets])];

    // Update used cards
    setUsedCards(prev => {
        const newSet = new Set(prev);
        allTargets.forEach(rank => newSet.add(rank));
        return newSet;
    });

    // Reinitialize board for next round
    const newCards = initializeBoard(round + 1, new Set([...usedCards, ...allTargets]));
    setCards(newCards);
    setRound(prev => prev + 1);

    console.log(`Round ${round} complete. Removed cards:`, allTargets);
    console.log(`Next round will have ${newCards.length} cards`);
};
```

### Step 3: Wire Up to Round End

Find where the round evaluation completes (likely in a useEffect or button handler) and add:

```typescript
// After showing evaluation results
const scores = calculateScores(
    resolvedPlayerVotes,  // Top 2 cards players voted for
    resolvedMasterVotes   // Top 2 cards master voted for
);

// Update cumulative scores
setScore(prev => prev + scores.playerScore);
setMasterScore(prev => prev + scores.masterScore);

// Show score breakdown to users
console.log('Player Score:', scores.scoreBreakdown.player);
console.log('Master Score:', scores.scoreBreakdown.master);

// After delay, proceed to next round
setTimeout(() => {
    processRoundEnd();
}, 5000);  // 5 second delay to show results
```

### Step 4: Ensure Different Card Selection

When master selects cards, validate they're different from player consensus:

```typescript
// In master selection handler
const validateMasterSelection = (angelCard: string, demonCard: string) => {
    const playerAngel = consensus?.playerAngel;
    const playerDemon = consensus?.playerDemon;

    if (angelCard === playerAngel || angelCard === playerDemon ||
        demonCard === playerAngel || demonCard === playerDemon) {
        showToast('Cannot select same cards as players!', 'error');
        return false;
    }
    return true;
};

// Before confirming master selection
if (!validateMasterSelection(selection.angel, selection.demon)) {
    return;  // Block selection
}
```

---

## 🎮 **Game Flow Verification:**

### Round 1:
1. **Master selects:** A (Angel), 2 (Demon)
2. **Players select:** 3 (Angel), 4 (Demon)
3. **Players vote for:** A, 2 (trying to find master's angel)
4. **Master votes for:** 3, 4 (trying to find player's angel)
5. **Scoring:**
   - Players: Found A (+300), hit 2 (-50) = +250
   - Master: Found 3 (+300), hit 4 (-50) = +250
6. **Card Removal:** A, 2, 3, 4 removed from deck

### Round 2:
- Available cards: 5, 6, 7, 8, 9, 10, J, Q, K (9 cards)
- Repeat process...

---

## 📊 **Testing Checklist:**

```
□ Master can select 2 different cards
□ Players can select 2 different cards (via consensus)
□ Master and Player selections are DIFFERENT
□ Evaluation shows correct cards for each side
□ Voting works correctly
□ Scoring calculates based on correct roles
□ Used cards are removed from next round
□ Round 2 shows only remaining cards
□ Scores accumulate correctly
```

---

## 🐛 **Known Issues to Watch:**

1. **Same Card Selection**: Currently no validation prevents master/player selecting same cards
2. **usedCards Not Used**: The warning will go away once we call `processRoundEnd()`
3. **Round Transitions**: Need to wire up the scoring and removal to actual round progression logic

---

**Status:** ✅ Core system fixed - Ready for scoring and card removal integration!
