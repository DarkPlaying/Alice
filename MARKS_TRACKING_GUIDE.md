# Clubs Game Marks Tracking Implementation

## Overview
The Clubs game now saves marks (round results) to **Supabase** for real-time tracking and final game results to **Firebase** for persistent storage.

## Data Flow

```
Each Round End:
  ├─ Calculate scores
  ├─ 🔵 Save to Supabase `clubs_marks` table (real-time)
  └─ Continue to next round

Game Complete (Round 6):
  ├─ Calculate final winner
  ├─ 🔴 Save to Firebase `marks` collection (persistent)
  └─ Show results
```

## Supabase Schema

### Table: `clubs_marks`
Stores results after **each round** (6 records per game).

**Run this SQL in Supabase SQL Editor:**
```sql
-- See: create_clubs_marks_table.sql
```

**Structure:**
```typescript
{
  id: UUID,
  game_id: 'clubs_king',
  round_number: 1-6,
  revealed_cards: ['clubs-A', 'clubs-5'], // Card IDs opened
  all_votes: { userId: cardId }, // All player votes
  player_round_score: 200, // Points this round
  master_round_score: -100,
  player_total_score: 500, // Cumulative
  master_total_score: 300,
  vote_count: 8, // Number of voters
  has_penalty: false, // Did anyone miss vote?
  timestamp: '2026-01-12T21:03:00Z'
}
```

## Firebase Schema

### Collection: `marks`
Stores **final results** when game completes.

**Document ID:** `clubs_king_{timestamp}`

**Structure:**
```typescript
{
  game_type: 'clubs',
  game_id: 'clubs_king',
  final_player_score: 1200,
  final_master_score: 800,
  total_rounds: 6,
  winner: 'players' | 'master',
  completed_at: '2026-01-12T21:05:00Z',
  timestamp: 1705084500000
}
```

## Implementation Details

### Modified Files
1. `src/components/games/ClubsGame.tsx`
2. `src/components/games/ClubsGameMaster.tsx`

### Key Changes

#### After Each Round (Lines ~390-410)
```typescript
// 🔥 SAVE ROUND MARKS TO SUPABASE
if (isMaster) {
    await supabase.from('clubs_marks').insert({
        game_id: 'clubs_king',
        round_number: round,
        revealed_cards: topCards,
        all_votes: globalVotes,
        player_round_score: playerRoundScore,
        master_round_score: masterRoundScore,
        player_total_score: newPlayerScore,
        master_total_score: newMasterScore,
        vote_count: totalVoters,
        has_penalty: penaltyMessage !== "",
        timestamp: new Date().toISOString()
    });
}
```

#### After Game Complete (Lines ~440-455)
```typescript
// 🔥 SAVE FINAL MARKS TO FIREBASE
if (isMaster) {
    const { collection, doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(collection(db, 'marks'), `clubs_king_${Date.now()}`), {
        game_type: 'clubs',
        game_id: 'clubs_king',
        final_player_score: newPlayerScore,
        final_master_score: newMasterScore,
        total_rounds: round,
        winner: newPlayerScore > newMasterScore ? 'players' : 'master',
        completed_at: new Date().toISOString(),
        timestamp: Date.now()
    });
}
```

## Usage & Queries

### View Round History (Supabase)
```sql
SELECT 
    round_number,
    player_round_score,
    master_round_score,
    player_total_score,
    master_total_score,
    revealed_cards,
    vote_count,
    timestamp
FROM clubs_marks
WHERE game_id = 'clubs_king'
ORDER BY round_number ASC;
```

### View Final Games (Firebase)
```javascript
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const marksRef = collection(db, 'marks');
const q = query(marksRef, orderBy('timestamp', 'desc'));
const snapshot = await getDocs(q);

snapshot.forEach(doc => {
    console.log(doc.id, doc.data());
});
```

### Real-time Subscription (Supabase)
```javascript
const channel = supabase
    .channel('marks-monitor')
    .on('postgres_changes', 
        { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'clubs_marks' 
        }, 
        (payload) => {
            console.log('New round completed:', payload.new);
        }
    )
    .subscribe();
```

## Admin Dashboard Integration

You can add a "View Marks" section to the Admin Dashboard to display:

1. **Live Round Progress** (from Supabase)
   - Current round scores
   - Vote participation
   - Running totals

2. **Game History** (from Firebase)
   - Past completed games
   - Winners
   - Final scores

## Benefits

✅ **Real-time Tracking**: See each round as it happens in Supabase  
✅ **Persistent Storage**: Final results permanently stored in Firebase  
✅ **Analytics Ready**: Easy to query and analyze game data  
✅ **Audit Trail**: Full history of all votes and decisions  
✅ **Scalable**: Separate concerns (real-time vs permanent storage)

## Setup Steps

1. **Run SQL in Supabase:**
   ```bash
   # Copy content from create_clubs_marks_table.sql
   # Paste in Supabase SQL Editor
   # Execute
   ```

2. **Test the Game:**
   - Play through at least one complete round
   - Check Supabase `clubs_marks` table for new record
   - Complete all 6 rounds
   - Check Firebase `marks` collection for final result

3. **Verify:**
   ```sql
   -- In Supabase
   SELECT COUNT(*) FROM clubs_marks WHERE game_id = 'clubs_king';
   -- Should see 6 records per completed game
   ```

## Troubleshooting

**No records in Supabase?**
- Check console for "SUPABASE_MARKS_ERROR"
- Verify RLS policies allow INSERT
- Ensure user is authenticated

**No records in Firebase?**
- Check console for "FIREBASE_FINAL_MARKS_ERROR"  
- Verify Firestore rules allow writes to `marks` collection
- Confirm game reached round 6

**Only Master saves marks**
- This is intentional (prevents duplicate records)
- Only the Master/Admin role writes marks
- All players can still read them
