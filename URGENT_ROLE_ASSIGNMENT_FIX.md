# URGENT FIX: Role Assignment Missing!

## Problem Identified:

From your screenshots, **BOTH Master and Player sections show the SAME cards (A, 2, or A, 4)**.

This means the code that ASSIGNS roles to cards is either:
1. ❌ **Missing entirely** (cards never get masterRole/playerRole assigned)
2. ❌ **Assigning BOTH roles to the SAME cards**

## Root Cause:

**NO CODE EXISTS** that assigns `masterRole` and `playerRole` to cards based on `selection` and `consensus` state!

The cards are initialized with `masterRole: null` and `playerRole: null`, but they're NEVER updated when:
- Master makes their selection
- Players reach consensus

## Required Fix:

### Add Role Assignment Function

Add this function **BEFORE** line 745 (before `resolveTargets`):

```typescript
// Assign roles to cards based on master and player selections
const assignRolesToCards = useCallback((
    masterSel: { angel: string | null; demon: string | null },
    playerCons: { playerAngel: string | null; playerDemon: string | null } | null
) => {
    setCards(prev => prev.map(card => {
        let newMasterRole = card.masterRole;
        let newPlayerRole = card.playerRole;

        // Assign MASTER roles (only to master's selected cards)
        if (masterSel.angel && card.rank === masterSel.angel) {
            newMasterRole = 'angel';
        } else if (masterSel.demon && card.rank === masterSel.demon) {
            newMasterRole = 'demon';
        }

        // Assign PLAYER roles (only to player's selected cards)
        if (playerCons?.playerAngel && card.rank === playerCons.playerAngel) {
            newPlayerRole = 'angel';
        } else if (playerCons?.playerDemon && card.rank === playerCons.playerDemon) {
            newPlayerRole = 'demon';
        }

        return {
            ...card,
            masterRole: newMasterRole,
            playerRole: newPlayerRole
        };
    }));
}, []);
```

### Call This Function When Roles Are Set

Find where consensus is updated (likely in a Supabase/Firebase listener or after setup phase completes) and add:

```typescript
// After consensus is set
useEffect(() => {
    if (consensus && selection.angel && selection.demon) {
        // Both master and player selections are ready
        assignRolesToCards(selection, consensus);
        console.log('Roles assigned:', {
            master: { angel: selection.angel, demon: selection.demon },
            player: { angel: consensus.playerAngel, demon: consensus.playerDemon }
        });
    }
}, [consensus, selection, assignRolesToCards]);
```

## Verification:

After adding this, check in the browser console:

```javascript
// In evaluation phase, check:
console.log('Card A:', cards.find(c => c.rank === 'A'));
// Should show: { rank: 'A', masterRole: 'angel', playerRole: null }

console.log('Card 3:', cards.find(c => c.rank === '3'));
// Should show: { rank: '3', masterRole: null, playerRole: 'angel' }
```

## Expected Result:

### Before Fix:
```
All cards: { masterRole: null, playerRole: null }
```

### After Fix:
```javascript
Card A: { rank: 'A', masterRole: 'angel', playerRole: null }
Card 2: { rank: '2', masterRole: 'demon', playerRole: null }
Card 3: { rank: '3', masterRole: null, playerRole: 'angel' }
Card 4: { rank: '4', masterRole: null, playerRole: 'demon' }
// Other cards remain null for both roles
```

## Alternative: Check Existing Broadcast Logic

There might be existing code that broadcasts role assignments via Supabase. Search for:

```typescript
supabase.channel()...broadcast()
```

And ensure it's calling a function to update card roles when receiving broadcast messages.

---

**CRITICAL:** Without role assignment, the display will always be wrong because it's trying to find `cards.find(x => x.masterRole === 'angel')` but NO card ever has masterRole set!
