# Spades Game - README

## Overview

The Spades game is a competitive bidding game where players compete across 5 rounds to collect cards and maximize their score. The game uses **Supabase Realtime** for state synchronization and **timestamp-based timers** for accurate countdown across all clients.

## Architecture

### Game Structure
- **5 Rounds** with **4 Phases** per round
  1. **Briefing (60s)**: Review rules, current scores, and round number
  2. **Hint (60s)**: View a hint about the target card
  3. **Bidding (60s)**: Submit bids (points willing to sacrifice)
  4. **Reveal (15s)**: View results, winner, and score changes

### Components
- **SpadesGameMaster**: Authoritative game controller (Admin-only)
- **SpadesGame**: Player component (read-only with bid submission)

### Database Schema

#### `spades_game_state` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Game ID (default: `'spades_main'`) |
| `phase` | TEXT | Current phase: `idle`, `briefing`, `hint`, `bidding`, `reveal`, `completed` |
| `current_round` | INTEGER | Current round (1-5) |
| `is_paused` | BOOLEAN | Pause state |
| `system_start` | BOOLEAN | Admin control to start game |
| `players` | JSONB | Map of `userId` → `{ score, cards[], bid, status }` |
| `round_data` | JSONB | `{ target_card, hint, winner_id, ties[] }` |
| `deck` | JSONB | Remaining cards in deck |
| `phase_started_at` | TIMESTAMPTZ | When current phase began (UTC) |
| `phase_duration_sec` | INTEGER | Phase duration in seconds |
| `paused_remaining_sec` | INTEGER | Remaining time when paused |
| `allowed_players` | TEXT[] | Whitelisted player IDs |

#### `spades_bids` Table (Optional)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Bid ID |
| `game_id` | TEXT | FK to `spades_game_state.id` |
| `player_id` | TEXT | Player ID |
| `round` | INTEGER | Round number |
| `bid_amount` | INTEGER | Bid amount |
| `created_at` | TIMESTAMPTZ | Timestamp |

**Note**: In current implementation, bids are stored in the `players` JSONB for simplicity. The `spades_bids` table is available for high-concurrency scenarios.

## Running the Database Migration

```bash
# Apply the migration to your Supabase project
# Option 1: Via Supabase Dashboard
# Navigate to SQL Editor → New Query → Paste contents of:
# supabase/migrations/20260117_spades_timestamp_timers.sql

# Option 2: Via Supabase CLI
supabase db push
```

## How to Play

### As Admin

1. **Navigate to Admin Dashboard**
2. **Start the Game**:
   - Find the Spades game section
   - Toggle `system_start` to `true` or click "START"
   - Game will initialize all whitelisted players and transition to Briefing phase

3. **Monitor the Game**:
   - View the GameMaster interface to see all players, bids, and scores
   - Game automatically progresses through phases

4. **Pause/Resume**:
   - Toggle `is_paused` to pause the game
   - All clients will freeze their timers
   - Toggle again to resume

5. **Reset**:
   - Set `phase` to `'idle'` and `system_start` to `false`
   - All players will be ejected and returned to home

### As Player

1. **Join the Game**:
   - Navigate to `/games/spades` (or via game selection)
   - If game is active and you're whitelisted, you'll auto-join
   - Wait for game to start (Admin must initiate)

2. **Briefing Phase** (60s):
   - Read the rules and scoring information
   - Review current standings
   - **No actions required**

3. **Hint Phase** (60s):
   - View the hint about the target card
   - Examples: "Ace (Face Card) · Red Suit" or "Value < 8 · Black Suit"
   - **No actions required**

4. **Bidding Phase** (60s):
   - Enter your bid in the input field
   - Bid represents points you're willing to risk
   - **Real-time validation**: Cannot bid more than your current score
   - **Projected score** updates as you type
   - Bids auto-save (debounced)

5. **Reveal Phase** (15s):
   - View the target card
   - See who won the bid
   - See updated scores and card collections
   - **No actions required**

6. **Game End** (After Round 5):
   - Final scores displayed
   - **Penalty**: -500 points if you have 0 cards

## Scoring Rules

### Card Values
- **Red cards** (♥ ♦): **+200 points**
- **Black cards** (♠ ♣): **-100 points**
- **Face cards** (J, Q, K, A): **500 points flat** (replaces suit-based scoring)

### Bidding
- All players pay their bid amount (deducted from score)
- Highest bidder wins the card
- Winner receives the card AND its score value
- **Ties**: System deterministically selects winner (sorted by player ID)

### Game Failure Penalty
- After Round 5, if a player has **0 cards collected**: **-500 points**

### Example Scoring

**Scenario**: Player A has 1000 points, bids 300 for a Red 5

1. Bid deduction: 1000 - 300 = **700**
2. Wins card: 700 + 200 (red card) = **900 points**
3. Final score: **900**

**Scenario**: Player B has 800 points, bids 400 for a King of Spades

1. Bid deduction: 800 - 400 = **400**
2. Wins card: 400 + 500 (face card) = **900 points**
3. Final score: **900**

## Configuration

### Phase Durations

Edit `PHASE_DURATIONS` in `SpadesGameMaster.tsx`:

```typescript
const PHASE_DURATIONS: Record<SpadesPhase, number> = {
  idle: 0,
  briefing: 60,    // Change to adjust briefing time
  hint: 60,        // Change to adjust hint time
  bidding: 60,     // Change to adjust bidding time
  reveal: 15,      // Change to adjust reveal time
  completed: 0
};
```

### Tie Resolution

Currently: **Deterministic** (sorted player IDs, first wins)

To implement **rebid sub-phase** (advanced):
1. Modify `resolveBidding()` in `SpadesGameMaster.tsx`
2. Add a new `'rebid'` phase
3. Filter players to only those in `ties[]`
4. Allow second bid round

## Presence Tracking

The game uses **Supabase Realtime Presence** to track connected players separately from registered players.

- **Registered players**: Stored in `spades_game_state.players`
- **Connected players**: Tracked via Presence channel `'spades_player'`

The UI shows both:
- "Connected Players" panel: Who is currently online
- Score panel: Who is registered in the match

## Troubleshooting

### Timer not syncing
- **Check**: Verify `phase_started_at` and `phase_duration_sec` are set in database
- **Fix**: GameMaster component should write these on every phase transition
- **Debug**: Check browser console for `[SPADES MASTER]` or `[SPADES PLAYER]` logs

### Bids not updating
- **Check**: Ensure players are in `bidding` phase
- **Check**: Verify bid validation (bid must be ≤ current score)
- **Fix**: Clear browser cache and refresh

### Game stuck in a phase
- **Check**: Verify GameMaster component is running (Admin must be connected)
- **Fix**: Admin should pause/resume or reset the game
- **Debug**: Check `isProcessingRef` is not stuck (see debug panel in GameMaster UI)

### Players not auto-joining
- **Check**: Verify player ID is in `allowed_players` array
- **Fix**: Admin Dashboard should add players to whitelist before starting

### Realtime not working
- **Check**: Verify Realtime is enabled in Supabase Dashboard
- **Check**: Run migration to add tables to Realtime publication
- **Fix**: Ensure RLS policies allow read/write access

## Development

### File Structure

```
src/
├── game/
│   └── spades/
│       ├── types.ts         # Type definitions
│       ├── scoring.ts       # Scoring utilities
│       ├── hints.ts         # Hint generation
│       └── index.ts         # Barrel export
├── components/
│   └── games/
│       ├── SpadesGameMaster.tsx  # GameMaster component
│       └── SpadesGame.tsx        # Player component
supabase/
└── migrations/
    └── 20260117_spades_timestamp_timers.sql
```

### Running Locally

1. Start Supabase: `supabase start`
2. Apply migrations: `supabase db push`
3. Start dev server: `npm run dev`
4. Open two browser tabs:
   - Tab 1: Admin (GameMaster view)
   - Tab 2: Player (SpadesGame view)

## Future Enhancements

- [ ] Rebid sub-phase for tie resolution
- [ ] Player authentication via Firebase
- [ ] Leaderboard persistence
- [ ] Spectator mode
- [ ] Custom game rooms (multiple concurrent games)
- [ ] Sound effects and animations
- [ ] Mobile responsive improvements
- [ ] Admin controls in UI (currently requires database toggle)

## License

This game is part of the ALICE Borderland website project.
