# CRITICAL FIXES NEEDED - ClubsGameMaster.tsx

Due to the complexity of interconnected changes, here are the EXACT line replacements needed:

## Fix 1: Line 1315 (Master Angel Card Display)
**FIND:**
```typescript
const c = cards.find(x => x.masterRole === 'angel');
```

**REPLACE WITH:**
```typescript
const c = cards.find(x => x.rank === selection.angel);
```

## Fix 2: Line 1325 (Master Demon Card Display)
**FIND:**
```typescript
const c = cards.find(x => x.masterRole === 'demon');
```

**REPLACE WITH:**
```typescript
const c = cards.find(x => x.rank === selection.demon);
```

## Fix 3: Line 1342 (Player Angel Card Display)
**FIND:**
```typescript
const c = cards.find(x => x.playerRole === 'angel');
```

**REPLACE WITH:**
```typescript
const c = cards.find(x => x.rank === consensus?.playerAngel);
```

## Fix 4: Line 1351 (Player Demon Card Display)
**FIND:**
```typescript
const c = cards.find(x => x.playerRole === 'demon');
```

**REPLACE WITH:**
```typescript
const c = cards.find(x => x.rank === consensus?.playerDemon);
```

## Fix 5: Lines 1573-1576 (Role Checks in Logic)
**FIND THIS SECTION - these lines check card roles**

Look for code around line 1573 that has:
```typescript
if (card.playerRole === 'angel' || card.masterRole === 'angel')
if (card.playerRole === 'demon' || card.masterRole === 'demon')
```

**REPLACE WITH:**
```typescript
// Master scores based on their OWN selections
if (card.rank === selection.angel) {
    // +300 for master
}
if (card.rank === selection.demon) {
    // -50 for master
}

// Players score based on THEIR selections
if (card.rank === consensus?.playerAngel) {
    // +300 for players
}
if (card.rank === consensus?.playerDemon) {
    // -50 for players
}
```

## Fix 6: Lines 1621-1622 (More Role Checks)
**Similar pattern** - find any other role checks and replace with rank comparisons against selection state.

---

## RECOMMENDATION:

Given the number of interconnected changes (14+ errors), I recommend:

### Option 1: Manual Find/Replace
1. Open ClubsGameMaster.tsx
2. Find: `x.masterRole === 'angel'`
3. Replace: `x.rank === selection.angel`
4. Find: `x.masterRole === 'demon'`
5. Replace: `x.rank === selection.demon`
6. Find: `x.playerRole === 'angel'`
7. Replace: `x.rank === consensus?.playerAngel`
8. Find: `x.playerRole === 'demon'`
9. Replace: `x.rank === consensus?.playerDemon`

### Option 2: I create a working evaluation section
I can create a complete, working evaluation UI section that you can copy-paste to replace lines 1305-1400.

**Which would you prefer?**
