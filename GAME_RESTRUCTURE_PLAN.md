# 🎮 CLUBS GAME - COMPLETE RESTRUCTURE PLAN

## Current Status: IN PROGRESS
Last Updated: 2026-01-13

---

## 🎯 NEW GAME FLOW

### Game States
```typescript
type GameState = 
  | 'briefing'          // Phase 0: Rules explanation (2 min, once at start)
  | 'phase1_voting'     // Phase 1: Hide Angel/Demon (1 min per round)
  | 'phase2_voting'     // Phase 2: Hunt opponent's cards (2 min per round)
  | 'evaluation'        // Phase 3: Reveal & Score (auto)
  | 'game_complete'     // All 6 rounds finished
```

### Round Structure (Repeat 6 times)
1. **Phase 1** (1 min): Team voting to hide Angel + Demon
2. **Phase 2** (2 min): Team voting to find opponent's cards
3. **Evaluation** (auto): Reveal, score, remove cards

---

## 📊 VOTING MECHANICS

### Phase 1: Hide Cards
- **Each player/master:** Vote for 1 Angel (yellow) + 1 Demon (red)
- **Team decides:** Top-voted Angel + Demon become team's selection
- **Visibility:** Players see players, Masters see masters
- **Storage:** Realtime DB for live counts

### Phase 2: Hunt Cards
- **Each player/master:** Vote for 2 cards (green)
- **Visibility:** Players see players, Masters see masters
- **Purpose:** Find opponent's Angel/Demon from Phase 1
- **Storage:** Realtime DB for live counts

---

## 🎨 UI INDICATORS

| Phase | Vote Type | Color | Player View | Master View |
|-------|-----------|-------|-------------|-------------|
| 1 | Angel | Yellow glow | Other players' votes | Other masters' votes |
| 1 | Demon | Red glow | Other players' votes | Other masters' votes |
| 2 | Elimination | Green badge | All players' votes | All masters' votes |

---

## ⚖️ SCORING ALGORITHM

### Step 1: Calculate Top Voted Cards
```javascript
// For each team, count Phase 2 votes
const voteCounts = {};
votes.forEach(vote => {
  vote.cards.forEach(cardId => {
    voteCounts[cardId] = (voteCounts[cardId] || 0) + 1;
  });
});

// Sort by count
const sorted = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);

// Handle edge cases
if (sorted.length === 0) {
  // No votes - no cards revealed
} else if (sorted.length === 1 || sorted[0][1] > sorted[1][1]) {
  // Clear top 2 or only 1 card voted
  topCards = sorted.slice(0, 2).map(([cardId]) => cardId);
} else if (allEqual(sorted.slice(0, 4))) {
  // 3+ way tie - randomly pick 2
  const tied = sorted.filter(([_, count]) => count === sorted[0][1]);
  topCards = shuffleArray(tied).slice(0, 2).map(([cardId]) => cardId);
}
```

### Step 2: Award Points
```javascript
FOR EACH topCard:
  IF topCard === opponentAngel:
    voters.forEach(voter => {
      if (voter.votedFor.includes(topCard)):
        voter.score += 300
    })
  
  IF topCard === opponentDemon:
    voters.forEach(voter => {
      if (voter.votedFor.includes(topCard)):
        voter.score -= 50
    })

// Penalty for non-participation
allPlayers.forEach(player => {
  if (!votedInPhase1 || !votedInPhase2):
    player.score -= 30
})
```

---

## 🗄️ DATABASE SCHEMA

### Supabase Tables
```sql
-- clubs_game_status (existing)
system_start BOOLEAN
current_round INTEGER
game_state TEXT  -- 'briefing', 'phase1_voting', etc.
phase1_player_angel TEXT  -- Top voted
phase1_player_demon TEXT
phase1_master_angel TEXT
phase1_master_demon TEXT
allowed_players TEXT[]

-- clubs_player_scores (existing)
Round-based scoring
```

### Realtime Database (Firebase)
```json
{
  "active_games": {
    "clubs_king": {
      "round_1": {
        "phase1_votes": {
          "player_001": {
            "angel": "clubs-4",
            "demon": "clubs-7",
            "timestamp": 1234567890
          },
          "master_001": {
            "angel": "clubs-10",
            "demon": "clubs-J",
            "timestamp": 1234567890
          }
        },
        "phase2_votes": {
          "player_001": {
            "cards": ["clubs-4", "clubs-5"],
            "timestamp": 1234567890
          }
        },
        "vote_counts": {
          "phase1": {
            "player": {
              "angel": { "clubs-4": 3, "clubs-5": 2 },
              "demon": { "clubs-7": 4, "clubs-8": 1 }
            },
            "master": {
              "angel": { "clubs-10": 2 },
              "demon": { "clubs-J": 2 }
            }
          },
          "phase2": {
            "player": { "clubs-4": 5, "clubs-5": 3 },
            "master": { "clubs-10": 4, "clubs-4": 3 }
          }
        }
      }
    }
  }
}
```

---

## 🚀 IMPLEMENTATION STEPS

### ✅ Phase 1: Core Structure (NOW)
- [ ] Update GameState types
- [ ] Create phase transition logic
- [ ] Add phase timers (briefing: 2min, phase1: 1min, phase2: 2min)
- [ ] Update UI to show current phase

### 🔄 Phase 2: Voting System
- [ ] Implement Phase 1 voting (Angel/Demon selection)
- [ ] Implement Phase 2 voting (2-card selection)
- [ ] Add real-time vote display
- [ ] Team-based visibility filters

### 📊 Phase 3: Evaluation Engine
- [ ] Calculate top voted cards
- [ ] Match against opponent's selections
- [ ] Award points to specific voters
- [ ] Handle all edge cases (ties, single card, etc.)

### 🎨 Phase 4: UI/UX Polish
- [ ] Color-coded vote indicators
- [ ] Live vote count badges
- [ ] Phase transition animations
- [ ] Evaluation reveal screen

### 🧪 Phase 5: Testing
- [ ] Test all vote scenarios
- [ ] Test tie-breaking logic
- [ ] Test team scoring
- [ ] Full 6-round playthrough

---

## 📝 NOTES
- Briefing shown ONCE at game start, not per round
- Real-time voting uses Firebase RTDB for instant updates
- Supabase used for persistent game state
- 6 rounds total, cards removed after each evaluation
