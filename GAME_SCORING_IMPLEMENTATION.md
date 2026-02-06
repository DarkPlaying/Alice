# Hearts/Clubs Game Scoring System - Implementation Summary

## Current Status

Based on the codebase analysis, the **Angel/Demon card selection system** is currently implemented in the **Clubs game**, not the Hearts game.

### Current Clubs Game Implementation:

1. **Card System:**
   - Players and Master each select cards (Ace, 2, 3, 4, etc.)
   - Each card is assigned either:
     - **Angel** role (positive)
     - **Demon** role (negative)

2. **Current Scoring Logic:**
   Located in `ClubsGameMaster.tsx` around lines 796-827:
   
   ```typescript
   // Player finds Angel: +300 points
   // Player finds Demon: -50 points
   ```

3. **Current Evaluation Phase:**
   - Shows "MASTER'S HIDDEN ROLES" with selected cards
   - Shows "PLAYERS' LOCKED ROLES" with their selections
   - Calculates ROUND SCORE and IMPACT SCORE

## Required Implementation

### ✅ What's Already Working:
1. **Card Selection Phase** - Both Master and Players can lock cards
2. **Angel/Demon Assignment** - Cards are assigned roles
3. **Scoring Display** - Round score and impact score are calculated

### ❌ What Needs to be Implemented/Fixed:

#### 1. **Symmetric Master Scoring** (Currently Missing)
**Required Logic:**
```typescript
// Master Scoring (should match player scoring)
masterScore = 0;
for each card Master voted for:
    if (card.role === 'angel'): masterScore += 300
    if (card.role === 'demon'): masterScore -= 50

// Player Scoring (already exists)
playerScore = 0;
for each card Player voted for:
    if (card.role === 'angel'): playerScore += 300
    if (card.role === 'demon'): playerScore -= 50
```

#### 2. **Card Removal Logic** (Missing)
**Required Behavior:**
```typescript
After Evaluation Phase completes:
- For Player's Screen:
  - Remove all cards that Master selected (Ace, 2)
  - Player only sees remaining cards (3, 4, 5, 6, etc.)
  
- For Master's Screen:
  - Remove all cards that Players selected (3, 4)
  - Master only sees remaining cards (Ace, 2, 5, 6, etc.)
```

#### 3. **Supabase Integration**
**Required Tables/Columns:**
```sql
-- clubs_game_status table (already exists)
- current_round (INT)
- phase (TEXT): 'selection', 'voting', 'evaluation'
- master_selections (JSONB): Array of card IDs selected by master
- player_selections (JSONB): Array of card IDs selected by players
- available_cards (JSONB): Array of remaining cards for next round
- master_score (INT)
- player_scores (JSONB): Object mapping player_id to score

-- New/Updated Schema Needed:
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS masterScore INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS availableCards JSONB DEFAULT '["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]'::jsonb;
```

## Implementation Steps

### Step 1: Update Master Scoring Logic
File: `src/components/games/ClubsGameMaster.tsx`

Add symmetric scoring for Master in the evaluation phase (around line 790-830).

### Step 2: Implement Card Removal
File: `src/components/games/ClubsGameMaster.tsx` and `ClubsGame.tsx`

After round evaluation:
1. Store master_selections and player_selections in Supabase
2. Calculate remaining cards = allCards - (master_selections + player_selections)
3. Update availableCards in Supabase
4. Next round only displays cards from availableCards

### Step 3: Update Game Rules Display
File: `src/components/GameContainer.tsx`

Update the rules to reflect:
- **Angel Card:** +300 points for finder
- **Demon Card:** -50 points for finder
- **Both Master and Players** get same scoring
- **Card Elimination:** Selected cards are removed from next round

### Step 4: Database Migration
Create Supabase migration to add new columns if they don't exist.

## Game Flow Summary

```
ROUND 1:
├── Selection Phase
│   ├── Master locks: A, 2
│   └── Player locks: 3, 4
├── Evaluation Phase
│   ├── Reveal roles (Angel/Demon)
│   ├── Calculate Master Score: (+300 for Angel, -50 for Demon)
│   └── Calculate Player Score: (+300 for Angel, -50 for Demon)
└── Result
    ├── Remove A, 2, 3, 4 from available cards
    └── Next round uses: [5, 6, 7, 8, 9, 10, J, Q, K]

ROUND 2:
├── Available cards: 5-K (9 cards remaining)
└── Repeat process...
```

## Next Actions

Would you like me to:
1. ✅ Implement the symmetric master scoring
2. ✅ Add card removal logic for subsequent rounds
3. ✅ Update Supabase schema
4. ✅ Update game rules display

Please confirm if this matches your vision for the game mechanics!
