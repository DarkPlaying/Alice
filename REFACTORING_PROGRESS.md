# Symmetric Scoring Fix - Progress Report

## ✅ Completed Changes:

### 1. Interface Updates
- ✅ Removed `playerRole` and `masterRole` from Card interface
- ✅ Added `usedCards` state (Set<string>) to track removed cards

### 2. initializeBoard Function
- ✅ Updated to accept `usedCardsSet` parameter
- ✅ Round 1: Creates all 13 cards
- ✅ Subsequent rounds: Filters out used cards
- ✅ No longer assigns roles to cards

## ❌ Still To Do:

### 3. Remove/Update `startRound` Function (Line ~130-164)
**Current:** Assigns player and master roles to cards
**Fix Needed:** Delete this function entirely - roles are no longer card-based

### 4. Fix Evaluation UI (Lines ~1307-1355)
**Current:** Tries to find cards with `masterRole === 'angel'`
**Fix Needed:** Show cards based on `selection.angel` and `consensus.playerAngel` IDs

**Before:**
```typescript
const c = cards.find(x => x.masterRole === 'angel'); // ❌ Won't work
```

**After:**
```typescript
const masterAngelCard = cards.find(c => c.rank === selection.angel); // ✅ Correct
```

### 5. Add Scoring Functions
**Location:** After `resolveTargets()` function

Need to add:
```typescript
const calculateIndependentScores = (masterSel, playerSel) => { ... }
const processRound Completion = (masterSel, playerSel) => { ... }
const saveRoundToSupabase = (scores, cards) => { ... }
```

### 6. Fix Other Role References
Multiple errors at lines:
- 1314, 1324: Master role display
- 1341, 1350: Player role display  
- 1573, 1576: Role checks in logic
- 1621, 1622: Role checks in UI

All need to be updated to use selection state instead of card.role

## Next Steps:

Due to the large number of interconnected changes, I recommend:

### Option A: Complete Manual Refactoring (2-3 hours)
- Comment out `startRound` function
- Update all UI references from `card.masterRole` to `selection.angel/demon`
- Add the 3 new scoring/saving functions
- Test thoroughly

### Option B: Reference Implementation (Faster)
I can create a COMPLETE working reference file showing:
- How evaluation phase should look
- How scoring should work
- How to wire everything together

Then you can copy-paste the working sections.

## Current Status:
**File is partially refactored and has type errors**
- ✅ Core data structures updated
- ❌ UI and logic still references old `role` system
- ⚠️ Won't compile until all role references are removed

Would you like me to:
1. Continue fixing errors one by one? (Slower, safer)
2. Create a complete working reference implementation? (Faster, requires manual integration)
3. Focus on fixing just the evaluation UI first to make it compile?
