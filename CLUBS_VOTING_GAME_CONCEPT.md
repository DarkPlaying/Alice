# Clubs Voting Game - Angel vs Demon Protocol (CONCEPT)

## Overview
This document describes a **concept design** for an alternative Clubs voting game where players and masters vote to select Angel and Demon cards for the opposing team. 

**NOTE**: The current implemented Clubs game (`ClubsGame.tsx`, `ClubsGameMaster.tsx`) uses a different mechanic where the master assigns cards and players vote to find them. This document serves as a future game concept or alternative game mode.

## Proposed Game Mechanics

### Participants
- **Players Team**: All users with role='player'
- **Masters Team**: All users with role='master'

### Game Flow

#### 1. Discussion Phase (2 minutes)
- All participants can discuss strategy
- No actions required

#### 2. Player Selection Phase (30 seconds)
- Players select cards they want to vote on for masters
- This is a preview phase

#### 3. Player Voting Phase (1 minute)
- All players vote for Angel and Demon cards
- Each player can vote for one Angel card and one Demon card
- Votes are for the **MASTER team**

#### 4. Vote Processing
- System counts all votes
- **Angel Card Selection**:
  - Highest voted card becomes the Angel card
  - If multiple cards have equal votes:
    - System picks up to 2 cards randomly from the tied cards
  - If all votes are for one card, only one card is opened
  
- **Demon Card Selection**:
  - Same logic as Angel card selection

#### 5. Master Selection Phase (30 seconds)
- Masters select cards for voting

#### 6. Master Voting Phase (1 minute)
- Masters vote for Angel and Demon cards for the **PLAYER team**
- Same voting logic applies

#### 7. Results Phase
- Final scores are calculated
- Winner is determined

### Scoring System

#### Default Points
- All new users start with **500 visa days**

#### Card Effects
- **Angel Card**: +50 points to the **opposing team**
  - Example: Players vote for an Angel card → Masters get +50 points
  
- **Demon Card**: -50 points to the **opposing team**
  - Example: Players vote for a Demon card → Masters get -50 points

#### Timeout Penalty
- Players who don't vote or timeout: **-30 points**

#### Final Bonus/Penalty
- Compare top player from each team
- **If top player from Player team > top player from Master team**:
  - All players get +50 points
- **Otherwise**:
  - All players get -50 points

## Firebase Schema

### Collections

#### 1. `games/diamonds_game`
Stores the current game state:
```typescript
{
  phase: 'discussion' | 'player_selection' | 'player_voting' | 'master_selection' | 'master_voting' | 'results' | 'ended',
  currentRound: number,
  timerEnd: number (timestamp),
  playerVotes: PlayerVote[],
  masterVotes: PlayerVote[],
  selectedAngelCard: string | null,
  selectedDemonCard: string | null,
  revealedCards: string[],
  scores: {
    players: { [userId: string]: number },
    masters: { [userId: string]: number }
  }
}
```

#### 2. `marks` Collection
Stores results for each shape/round:
```typescript
{
  team: 'player' | 'master',
  round: number,
  timestamp: number,
  angels: string[], // Card IDs of Angel cards selected
  demons: string[], // Card IDs of Demon cards selected
  votes: PlayerVote[] // All votes cast
}
```

Document ID format: `{team}_round_{roundNumber}`
- Example: `player_round_1`, `master_round_1`

#### 3. `users` Collection
Updated with scores:
```typescript
{
  username: string,
  email: string,
  role: 'player' | 'master' | 'admin',
  visaDays: number, // Starts at 500
  // ... other fields
}
```

### PlayerVote Interface
```typescript
{
  userId: string,
  username: string,
  cardId: string,
  voteType: 'angel' | 'demon',
  timestamp: number
}
```

## Timer System

| Phase | Duration |
|-------|----------|
| Discussion | 2 minutes (120s) |
| Selection (Players/Masters) | 30 seconds |
| Voting (Players/Masters) | 1 minute (60s) |
| Results | 10 seconds |

## Special Rules

### Tie Breaking
- If votes are tied for multiple cards:
  - System randomly selects up to 2 cards from the highest-voted cards
  - Example: If 5 members vote for 7 different cards with equal votes, system picks 2 random cards

### Single Vote Case
- If all participants vote for only one card:
  - Only that card is opened
  - No second card is selected

### Non-Voting Penalty
- Automatic -30 points for:
  - Not voting before timer expires
  - Disconnecting during voting phase

## Implementation Notes

1. **Real-time Updates**: Game uses Firebase onSnapshot for live updates
2. **Atomic Operations**: Uses `increment()` for safe concurrent score updates
3. **Phase Transitions**: Automatic progression through phases via timer
4. **Data Persistence**: All votes and results saved to marks collection
5. **User Initialization**: New users automatically get 500 points on creation

## Usage

### Starting the Game
```typescript
// Game auto-initializes when user selects Diamonds card
// Admin/Master can control via AdminDashboard if needed
```

### Player Actions
1. Wait for "Your Turn" indicator
2. Select a card during selection phase
3. Vote for Angel or Demon during voting phase
4. View results at the end

### Monitoring
- Admin Dashboard shows:
  - Current game phase
  - Vote counts
  - Player scores
  - marks collection history
