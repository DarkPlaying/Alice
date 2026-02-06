# Clubs Game Timing Updates

## New Timer Configuration

The Clubs game now has the following phase timings:

### Phase 1: Initial Discussion
- **Duration**: 2 minutes (120 seconds)
- **Purpose**: Players can discuss strategy before game starts
- **State**: `idle` → waiting for admin to start
- **Timer**: Set to 120s initially

### Phase 2: Angel & Demon Selection (Setup)
- **Duration**: 1 minute (60 seconds)
- **Purpose**: Each team selects which cards will be Angel and Demon
- **State**: `setup`
- **Timer**: Set to 60s when entering setup phase
- **Actions**:
  - Players select 2 cards (1 Angel, 1 Demon) for the Master to use
  - Master selects 2 cards (1 Angel, 1 Demon) for the Players
  - Auto-confirms when both cards selected

### Phase 3: Team Card Selection/Voting (Playing)
- **Duration**: 2 minutes (120 seconds)
- **Purpose**: Players vote on which cards to reveal
- **State**: `playing`
- **Timer**: Set to 120s when round starts
- **Actions**:
  - All players vote on which card(s) to open
  - Top 1-2 voted cards are revealed
  - Scores calculated based on Angel/Demon assignments

## Timer Flow Diagram

```
Game Start (IDLE)
  ├─ Timer: 2:00 (discussion time)
  └─ Admin clicks "Start Trial"
      ↓
Setup Phase
  ├─ Timer: 1:00 (angel/demon selection)
  ├─ Players select Angel & Demon cards
  ├─ Master selects Angel & Demon cards
  └─ Both teams ready → Auto-advance
      ↓
Playing Phase (Round 1-6)
  ├─ Timer: 2:00 (voting time)
  ├─ Players vote on cards to reveal
  ├─ Timer expires or players vote
  └─ Reveal cards, calculate scores
      ↓
  If Round < 6:
    ├─ Return to Setup Phase
    └─ Timer: 1:00
  If Round = 6:
    └─ Game Complete
```

## Code Changes

### Files Modified
1. `src/components/games/ClubsGame.tsx`
2. `src/components/games/ClubsGameMaster.tsx`

### Changes Made

#### Initial State Timer
```typescript
// Before: 25 seconds
const [timeLeft, setTimeLeft] = useState(25);

// After: 120 seconds (2 minutes for discussion)
const [timeLeft, setTimeLeft] = useState(120);
```

#### Setup Phase Timer
```typescript
const handleInitializeGame = () => {
    setGameState('setup');
    setSelection({ angel: null, demon: null });
    setSetupReady({ players: false, master: false });
    setTimeLeft(60); // NEW: 1 minute for angel/demon selection
};
```

#### Playing Phase Timer
```typescript
// In startRound function
// Before: 30 seconds
setTimeLeft(30);

// After: 120 seconds (2 minutes for team card selection)
setTimeLeft(120);
```

## Summary

| Phase | Old Timer | New Timer | Purpose |
|-------|-----------|-----------|---------|
| Initial/Discussion | 25s | **120s** (2 min) | Strategy discussion |
| Setup (Angel/Demon) | No timer | **60s** (1 min) | Card role assignment |
| Playing (Voting) | 30s | **120s** (2 min) | Vote and reveal cards |

## Timer Warnings

The game shows warnings at specific time thresholds:
- **20 seconds remaining**: Warning toast appears
- **< 10 seconds**: Timer text pulses/animates in red

These warnings remain unchanged and work with the new longer timers.

## Testing Checklist

- [ ] Initial game loads with 2:00 timer
- [ ] Setup phase starts with 1:00 timer after admin starts
- [ ] Playing phase has 2:00 timer for voting
- [ ] Timer countdown works correctly
- [ ] Warning appears at 20 seconds
- [ ] Game auto-advances when timer expires
- [ ] Multiple rounds maintain correct timers
