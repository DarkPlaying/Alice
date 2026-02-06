# CORRECT GAME MECHANIC - Alice in Borderland Clubs

## Game Flow (ACTUAL):

### Round Start:
```
Master has cards: A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K
Players have cards: A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K (same deck, both views)
```

### Phase 1: SECRET TARGET SELECTION

**Master's Turn:**
1. Master selects 2 cards from their view
2. Assigns roles to THOSE specific cards:
   - Example: Select A → Assign as "Angel"
   - Example: Select 2 → Assign as "Demon"
3. These become `masterRole` on those specific cards
4. Players CANNOT see which cards Master chose
5. Top most-voted angel cards and master cards are locked

**Players' Turn:**
1. Players (via consensus) select 2 DIFFERENT cards
2. Assign roles to THEIR cards:
   - Example: Select 3 → Assign as "Angel"
   - Example: Select 4 → Assign as "Demon"
3. These become `playerRole` on those specific cards
4. Master CANNOT see which cards Players chose
5. Top most-voted angel cards and master cards are locked

**After Phase 1:**
```javascript
cards = [
  { rank: 'A', masterRole: 'angel', playerRole: null },    // Master's target
  { rank: '2', masterRole: 'demon', playerRole: null },    // Master's target
  { rank: '3', masterRole: null, playerRole: 'angel' },    // Player's target
  { rank: '4', masterRole: null, playerRole: 'demon' },    // Player's target
  { rank: '5', masterRole: null, playerRole: null },       // Unused
  // ... rest of cards
]
```

### Phase 2: VOTING/GUESSING

**Players Vote:**
- Players try to FIND Master's Angel (card A) and demon (card 2)
- Players vote for cards they think are Master's targets
- Each player can vote for 2 cards
- Top 2 most-voted cards are revealed

**Master Votes:**
- Master tries to FIND Player's Angel (card 3)
- Master votes for cards they think are Player's targets
- Master can vote for multiple cards
- Top 2 most-voted cards are revealed

### Phase 3: EVALUATION & SCORING
**Players Score:**
- If players found Master's Angel (card A) → +300 points
- If players found Master's Demon (card 2) → -50 points
- If players found both Master's Angel and Demon → +250 points
- Assign scores based on individually not team (those who voted correctly) 

**Master Score:**
- If master found Player's Angel (card 3) → +300 points
- If master found Player's Demon (card 4) → -50 points
- If master found both Player's Angel and Demon → +250 points
- Assign scores based on individually not team (those who voted correctly) 

**player card remove**
- after score assign remove angel card and demon card of master from player view before next round starts

**master card remove**
- after score assign remove angel card and demon card of player from master view before next round starts

**Reveal Master's Targets:**
- Show cards A (Angel) and 2 (Demon)

**Reveal Player's Targets:**
- Show cards 3 (Angel) and 4 (Demon)

**Calculate Player Score:**
```javascript
let playerScore = 0;

// Check if players found Master's Angel
if (playersVotedFor.includes('A')) {  // A has masterRole='angel'
    playerScore += 300;
}

// Check if players hit Master's Demon
if (playersVotedFor.includes('2')) {  // 2 has masterRole='demon'
    playerScore -= 50;
}

// Final: 300 - 50 = +250 if they voted both
```

**Calculate Master Score:**
```javascript
let masterScore = 0;

// Check if master found Player's Angel
if (masterVotedFor.includes('3')) {  // 3 has playerRole='angel'
    masterScore += 300;
}

// Check if master hit Player's Demon
if (masterVotedFor.includes('4')) {  // 4 has playerRole='demon'
    masterScore -= 50;
}

// Final: 300 - 50 = +250 if they voted both
```

---

## Current Code Issue:

**Problem:** Line 1342 and 1350 are WRONG

**Current (BROKEN):**
```typescript
// Line 1342 - Looking for player's angel in MASTER's section
const c = cards.find(x => x.rank === selection.angel);  // ❌ Shows Master's card in Player section
```

**This makes BOTH sections show the SAME cards!**

**Correct:**
```typescript
// Master's section - show cards with masterRole
const masterAngel = cards.find(x => x.masterRole === 'angel');
const masterDemon = cards.find(x => x.masterRole === 'demon');

// Player's section - show cards with playerRole  
const playerAngel = cards.find(x => x.playerRole === 'angel');
const playerDemon = cards.find(x => x.playerRole === 'demon');
```

---

## FIX NEEDED:

We need to **REVERT** the changes and **KEEP** `masterRole` and `playerRole` in the Card interface.

The issue wasn't the roles - it was that the SAME card was getting BOTH roles assigned!

**Root Cause:**
The code was assigning both `masterRole` AND `playerRole` to the same cards, which caused:
- Master selects A → Gets `masterRole='angel'` ✅
- Player consensus picks A → Also gets `playerRole='angel'` ❌
- Now card A has BOTH roles → Everyone scores!

**Solution:**
1. Keep `masterRole` and `playerRole` in Card interface
2. Ensure Master and Players select DIFFERENT cards
3. Display Master's cards (with masterRole) in Master section
4. Display Player's cards (with playerRole) in Player section
5. Score based on votes matching the correct roles

---

## Correct Implementation:

### 1. Revert Card Interface:
```typescript
interface Card {
    id: string;
    suit: 'clubs';
    rank: string;
    masterRole: 'angel' | 'demon' | null;  // ✅ Master's assigned role
    playerRole: 'angel' | 'demon' | null;  // ✅ Player's assigned role
    isRevealed: boolean;
    isRemoved: boolean;
}
```

### 2. Fix Evaluation UI (Lines 1315, 1325, 1342, 1350):

**Master's Section:**
```typescript
{/* Master's Angel - show card that HAS masterRole='angel' */}
const c = cards.find(x => x.masterRole === 'angel');  // ✅ Correct

{/* Master's Demon - show card that HAS masterRole='demon' */}
const c = cards.find(x => x.masterRole === 'demon');  // ✅ Correct
```

**Player's Section:**
```typescript
{/* Player's Angel - show card that HAS playerRole='angel' */}
const c = cards.find(x => x.playerRole === 'angel');  // ✅ Correct (REVERT line 1342!)

{/* Player's Demon - show card that HAS playerRole='demon' */}
const c = cards.find(x => x.playerRole === 'demon');  // ✅ Correct (REVERT line 1350!)
```

### 3. Ensure Different Card Selection:

**In master selection handler:**
```typescript
// When master selects cards
setSelection({ angel: 'A', demon: '2' });

// Update cards with masterRole ONLY
setCards(prev => prev.map(c => ({
    ...c,
    masterRole: c.rank === 'A' ? 'angel' : (c.rank === '2' ? 'demon' : c.masterRole)
    // playerRole unchanged!
})));
```

**In player consensus handler:**
```typescript
// When players reach consensus
setConsensus({ playerAngel: '3', playerDemon: '4', ... });

// Update cards with playerRole ONLY
setCards(prev => prev.map(c => ({
    ...c,
    playerRole: c.rank === '3' ? 'angel' : (c.rank === '4' ? 'demon' : c.playerRole)
    // masterRole unchanged!
})));
```

---

## Summary:

**You were RIGHT** - the game needs both roles!

**The fix is:**
1. ✅ Keep `masterRole` and `playerRole`
2. ✅ Revert lines 1342 and 1350 back to checking `playerRole`
3. ❌ DON'T use `selection.angel` for player section
4. ✅ Ensure Master and Players select DIFFERENT cards
5. ✅ Score based on who found whose targets

**The original code structure was correct - we just need to ensure different cards are selected!**
