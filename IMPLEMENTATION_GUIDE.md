# Clubs Game - Symmetric Scoring & Card Removal Implementation Guide

## Overview
This document provides the complete implementation for:
1. ✅ Symmetric Master/Player scoring (+300 Angel, -50 Demon)
2. ✅ Card removal logic (selected cards disappear next round)
3. ✅ Supabase schema updates
4. ✅ Updated game rules display

---

## Part 1: Supabase Schema Updates

### SQL Migration Script

```sql
-- Add columns to clubs_game_status table for tracking card removal and scores
ALTER TABLE clubs_game_status 
ADD COLUMN IF NOT EXISTS master_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS player_total_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS master_selected_cards JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS player_selected_cards JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS available_cards JSONB DEFAULT '["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]'::jsonb,
ADD COLUMN IF NOT EXISTS removed_cards JSONB DEFAULT '[]'::jsonb;

-- Add comment to describe the columns
COMMENT ON COLUMN clubs_game_status.master_score IS 'Cumulative score for the Master across all rounds';
COMMENT ON COLUMN clubs_game_status.player_total_score IS 'Cumulative score for Players across all rounds';
COMMENT ON COLUMN clubs_game_status.master_selected_cards IS 'Array of card IDs (e.g., ["A", "2"]) selected by Master in current round';
COMMENT ON COLUMN clubs_game_status.player_selected_cards IS 'Array of card IDs (e.g., ["3", "4"]) selected by Players in current round';
COMMENT ON COLUMN clubs_game_status.available_cards IS 'Array of card IDs still available for selection';
COMMENT ON COLUMN clubs_game_status.removed_cards IS 'Array of card IDs that have been permanently removed from the game';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_clubs_game_current_round ON clubs_game_status(current_round);
CREATE INDEX IF NOT EXISTS idx_clubs_game_phase ON clubs_game_status(phase);
```

---

## Part 2: Scoring Logic Implementation

###  Location: `src/components/games/ClubsGameMaster.tsx`

Add this scoring calculation function after the `resolveTargets` function:

```typescript
// Symmetric Scoring Function - Calculate scores for both Master and Players
const calculateRoundScores = (
    cards: Card[],
    masterSelections: { angel: string | null; demon: string | null },
    playerConsensus: { angel: string | null; demon: string | null }
) => {
    let masterRoundScore = 0;
    let playerRoundScore = 0;
    
    const scoreBreakdown = {
        master: [] as string[],
        player: [] as string[]
    };

    // Score Master's selections
    if (masterSelections.angel) {
        const angelCard = cards.find(c => c.id === masterSelections.angel);
        if (angelCard?.playerRole === 'angel' || angelCard?.masterRole === 'angel') {
            masterRoundScore += 300;
            scoreBreakdown.master.push(`ANGEL (${masterSelections.angel}): +300`);
        }
    }

    if (masterSelections.demon) {
        const demonCard = cards.find(c => c.id === masterSelections.demon);
        if (demonCard?.playerRole === 'demon' || demonCard?.masterRole === 'demon') {
            masterRoundScore -= 50;
            scoreBreakdown.master.push(`DEMON (${masterSelections.demon}): -50`);
        }
    }

    // Score Player's selections (same logic)
    if (playerConsensus.angel) {
        const angelCard = cards.find(c => c.id === playerConsensus.angel);
        if (angelCard?.playerRole === 'angel' || angelCard?.masterRole === 'angel') {
            playerRoundScore += 300;
            scoreBreakdown.player.push(`ANGEL (${playerConsensus.angel}): +300`);
        }
    }

    if (playerConsensus.demon) {
        const demonCard = cards.find(c => c.id === playerConsensus.demon);
        if (demonCard?.playerRole === 'demon' || demonCard?.masterRole === 'demon') {
            playerRoundScore -= 50;
            scoreBreakdown.player.push(`DEMON (${playerConsensus.demon}): -50`);
        }
    }

    return {
        masterRoundScore,
        playerRoundScore,
        scoreBreakdown
    };
};
```

---

## Part 3: Card Removal Logic

### Location: Same file, add after scoring function

```typescript
// Card Removal Function - Remove selected cards for next round
const removeSelectedCards = (
    currentCards: Card[],
    masterCards: string[],
    playerCards: string[]
) => {
    const toRemove = new Set([...masterCards, ...playerCards].filter(Boolean));
    
    // Filter out removed cards
    const remainingCards = currentCards.filter(card => !toRemove.has(card.id));
    
    // Return card IDs for Supabase update
    const availableIds = remainingCards.map(c => c.id);
    const removedIds = Array.from(toRemove);
    
    return {
        remainingCards,
        availableIds,
        removedIds
    };
};
```

---

## Part 4: Update Supabase After Round Ends

### Location: In the round evaluation/completion logic

Add this code where the round ends (after revealing cards):

```typescript
// After round evaluation completes
const updateSupabaseAfterRound = async (
    masterScore: number,
    playerScore: number,
    masterCards: string[],
    playerCards: string[],
    availableCards: string[],
    removedCards: string[]
) => {
    try {
        const { data, error } = await supabase
            .from('clubs_game_status')
            .update({
                master_score: masterScore, // Cumulative
                player_total_score: playerScore, // Cumulative
                master_selected_cards: masterCards,
                player_selected_cards: playerCards,
                available_cards: availableCards,
                removed_cards: removedCards
            })
            .eq('id', 'clubs_king');

        if (error) {
            console.error('Error updating Supabase:', error);
            showToast('Failed to save round data', 'error');
        } else {
            console.log('Round data saved successfully');
        }
    } catch (err) {
        console.error('Supabase update error:', err);
    }
};

// Call this function at the end of each round
// Example usage:
const scores = calculateRoundScores(cards, selection, consensus?.playerAngel ? { angel: consensus.playerAngel, demon: consensus.playerDemon } : { angel: null, demon: null });
const cardRemoval = removeSelectedCards(
    cards,
    [selection.angel, selection.demon].filter(Boolean) as string[],
    [consensus?.playerAngel, consensus?.playerDemon].filter(Boolean) as string[]
);

// Update cumulative scores
const newMasterScore = masterScore + scores.masterRoundScore;
const newPlayerScore = score + scores.playerRoundScore;

setMasterScore(newMasterScore);
setScore(newPlayerScore);

// Update Supabase
await updateSupabaseAfterRound(
    newMasterScore,
    newPlayerScore,
    [selection.angel, selection.demon].filter(Boolean) as string[],
    [consensus?.playerAngel, consensus?.playerDemon].filter(Boolean) as string[],
    cardRemoval.availableIds,
    cardRemoval.removedIds
);

// Update local card state for next round
setCards(cardRemoval.remainingCards);
```

---

## Part 5: Update Game Rules Display

### Location: `src/components/GameContainer.tsx`

Find the Clubs game rules section and update it:

```tsx
// Around line 90-120 (the rules object for Clubs)
const rules = {
    // ... other properties
    description: "A symmetrical social deduction game of survival where strategy and teamwork are your only assets. " +
                 "Both Master and Players select Angel and Demon cards each round. " +
                 "Selected cards are permanently removed from subsequent rounds.",
    
    objective: "ACCUMULATE THE HIGHEST SCORE BY IDENTIFYING ANGELS AND AVOIDING DEMONS",
    
    // Add detailed scoring rules
    scoringRules: [
        {
            action: "Find Angel Card",
            points: "+300",
            applies: "Both Master & Players"
        },
        {
            action: "Find Demon Card",
            points: "-50",
            applies: "Both Master & Players"
        },
        {
            action: "Mixed Selection (1 Angel + 1 Demon)",
            points: "+250 net",
            applies: "Both Master & Players"
        }
    ],
    
    cardRemovalRules: [
        "After each round, all selected cards are removed from the game",
        "Player's View: Master's selected cards disappear",
        "Master's View: Player's selected cards disappear",
        "Available cards decrease each round until game ends"
    ]
};
```

### Update the rules display UI

```tsx
{/* In the rules modal/screen */}
<div className="space-y-6">
    <div className="bg-white/5 border-l-2 border-white/20 pl-6 py-4">
        <p className="text-white/30 font-mono text-[10px] uppercase tracking-widest mb-2">
            SCORING SYSTEM
        </p>
        <div className="space-y-2">
            {rules.scoringRules?.map((rule, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300 font-mono">{rule.action}</span>
                    <span className={`font-bold ${rule.points.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                        {rule.points}
                    </span>
                </div>
            ))}
        </div>
        <p className="text-white/40 text-xs mt-2 italic">
            * Same rules apply to both Master and Players
        </p>
    </div>

    <div className="bg-red-500/10 border-l-2 border-red-500/50 pl-6 py-4">
        <p className="text-red-400 font-mono text-[10px] uppercase tracking-widest mb-2">
            CARD ELIMINATION RULES
        </p>
        <ul className="space-y-1 text-xs text-gray-300">
            {rules.cardRemovalRules?.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">▸</span>
                    <span>{rule}</span>
                </li>
            ))}
        </ul>
    </div>
</div>
```

---

## Part 6: Integration Checklist

### Steps to implement:

1. ✅ **Run SQL Migration**
   - Execute the SQL script in Supabase SQL Editor
   - Verify columns are added: `master_score`, `player_total_score`, `available_cards`, etc.

2. ✅ **Add Scoring Functions**
   - Add `calculateRoundScores()` and `removeSelectedCards()` to ClubsGameMaster.tsx
   - Add `updateSupabaseAfterRound()` function

3. ✅ **Update Round End Logic**
   - Find where round evaluation happens (likely in a useEffect or button click handler)
   - Add calls to calculate scores and update Supabase
   - Update local state with new scores and remaining cards

4. ✅ **Initialize Next Round with Remaining Cards**
   - Modify `initializeBoard()` function to use `available_cards` from Supabase
   - Instead of always using all RANKS, filter by what's available

5. ✅ **Update UI**
   - Display master score and player score separately
   - Show score breakdown after each round
   - Update rules display in GameContainer

6. ✅ **Test Flow**
   - Round 1: Master selects A, 2 | Players select 3, 4
   - Evaluation: Calculate scores
   - Round 2: Available cards should be [5, 6, 7, 8, 9, 10, J, Q, K]
   - Verify both screens only show remaining cards

---

## Example: Complete Round Flow

```typescript
// 1. Selection Phase
Master selects: { angel: "A", demon: "2" }
Players select: { angel: "3", demon: "4" }

// 2. Evaluation Phase
const scores = calculateRoundScores(cards, selection, consensus);
// scores.masterRoundScore = +250 if A=Angel, 2=Demon
// scores.playerRoundScore = +250 if 3=Angel, 4=Demon

// 3. Update Scores
setMasterScore(prev => prev + scores.masterRoundScore); // 0 + 250 = 250
setScore(prev => prev + scores.playerRoundScore);       // 0 + 250 = 250

// 4. Remove Cards
const removal = removeSelectedCards(cards, ["A", "2"], ["3", "4"]);
// removal.availableIds = ["5", "6", "7", "8", "9", "10", "J", "Q", "K"]

// 5. Save to Supabase
await updateSupabaseAfterRound(250, 250, ["A", "2"], ["3", "4"], removal.availableIds, ["A", "2", "3", "4"]);

// 6. Initialize Next Round
setCards(removal.remainingCards); // Only 5-K cards now
setRound(2);
```

---

## Summary

This implementation provides:
- ✅ **Symmetric scoring** - Both Master and Players get same rewards/penalties
- ✅ **Card removal** - Selected cards disappear from next round
- ✅ **Persistence** - All data saved to Supabase for recovery
- ✅ **Clear rules** - Updated UI explains the mechanics

**Estimated Implementation Time:** 2-3 hours
**Complexity:** Medium
**Breaking Changes:** None (additive only)
