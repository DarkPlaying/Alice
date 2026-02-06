# Hearts: Cross-Reveal Protocol

A social deduction and psychological trial of survival, implemented for the Alice in Borderland platform.

## 🎴 Game Overview
The **Hearts: Cross-Reveal** protocol is a 5-round elimination game. Survival depends on accurate self-deduction through limited communication with a paired partner.

### Key Mechanic: Cross-Reveal
- You see your **partner's** card.
- You **cannot** see your own card.
- Communication is the only bridge to your own identity.

---

## 🕒 Game Phases
Each round consists of 5 distinct phases:

1. **Briefing (60s):** Protocol overview, score display, and round initialization.
2. **Connection (10s):** Dynamic pairing system syncs two survivors.
3. **Playing (60s):** Encryption active. Partners exchange hints via private chat (Max 4 messages).
4. **Guess (60s):** Players must select their predicted suit.
5. **Evaluation (10s):** System verifies identities. Incorrect guessers are permanently offlined.

---

## ⚡ Special Powers: Eye of Truth
A limited-use biometric override that reveals the player's own card for the current round.
- **Admin/Master:** 2 uses per game.
- **Players:** 1 use per game.

---

## 🛠 Technical Architecture

### Database Schema (`hearts_game_state`)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT | Primary Key (e.g., `hearts_main`) |
| `phase` | TEXT | Current protocol state |
| `players` | JSONB | Map of player status, scores, and power usage |
| `round_data` | JSONB | Pairs, cards, messages, and guesses |
| `phase_started_at`| TIMESTAMPTZ | Authoritative timestamp for timers |
| `system_start` | BOOLEAN | Master gate for all participants |

### Realtime Synchronization
- **Supabase Realtime:** Powers the authoritative state loop and phase transitions.
- **Supabase Presence:** Tracks active players in the lobby and during connection.
- **Private Channels:** Secure pair-based messaging channels derived from sorted IDs: `pair_ID1_ID2`.

---

## 👥 Roles & Permissions
- **System Architect (Admin):** Full control over game start/stop/reset.
- **Game Master (Master):** Authoritative control over phase progression and full visibility of participants.
- **Participant (Player):** Interactive survival experience.

---

## 🚀 Deployment
Ensure the migration `20260117_hearts_cross_reveal.sql` is applied to your Supabase instance to initialize the protocol state.
