# 🔧 REQUIRED CHANGES FOR NEW GAME FLOW

Based on current 70% working implementation, here's what needs adjustment:

## 🚨 CRITICAL DB UPDATES
- **Run `ensure_allowed_players_column.sql`**: The `clubs_game_status` table requires an `allowed_players` column for the new waiting room logic to work. This file creates it if missing.

## CURRENT STRUCTURE (Working):
```
gameState: 'setup' | 'master_turn' | 'playing' | 'round_reveal' | 'won' | 'lost'

Round Flow:
1. setup (2min discussion - happens every round)
2. master_turn (master picks angel/demon)
3. playing (players vote)
4. round_reveal (show results)
5. Next round or game end
```

## NEEDED CHANGES:

### 1. **Briefing Only Once**
- Current: `gameState === 'setup'` runs every round
- Needed: Briefing (`gameState === 'setup'`) only runs ONCE at game start (round 1)
  
**Fix**: Add condition `if (round === 1 && gameState === 'setup')` for briefing display

### 2. **Split Setup into 2 Phases**
Current `setup` phase needs to become TWO separate phases:

**Phase 1 (1 min):**
- Players vote: Angel + Demon (predicting Master)
- Masters vote: Angel + Demon (actual choice)
- Color: Yellow (angel), Red (demon)
- Team visibility only

**Phase 2 (2 min):**
- Players vote: 2 cards (finding Master's picks)
- Masters vote: 2 cards (finding Players' predictions)
- Color: Green
- Team visibility

### 3. **Voting System Changes**

Current:
- `selection` = master picks angel/demon
- `myVote` = players vote for 2 cards
- Global visibility

Needed:
- Phase 1: Each person votes Angel + Demon
- Phase 2: Each person votes 2 cards
- Team-based visibility (players see players, masters see masters)

### 4. **Evaluation Changes**

Current:
- Check if players' votes match master's selection
- Award +300/-50 to ALL players

Needed:
- Find TOP 2 VOTED cards from Phase 2
- Award +300/-50 only to players who voted for those specific cards
- Handle tie-breaking scenarios

### 5. **Real-time Voting Display**

Current:
- Shows vote counts on cards
- Global visibility

Needed:
- Phase 1: Yellow/Red glows, team-specific counts
- Phase 2: Green badges, team-specific counts
- Use Firebase RTDB for live updates

---

## IMPLEMENTATION APPROACH:

Instead of full rewrite, **EXTEND** existing structure:

1. Add `briefingComplete` flag
2. Split `setup` into `phase1_voting` and `phase2_voting`
3. Keep existing timer/vote mechanics
4. Adjust scoring to be voter-specific
5. Add team visibility filters

This way we preserve the 70% that works and just adjust the flow!
