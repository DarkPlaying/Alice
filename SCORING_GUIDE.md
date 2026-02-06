# Trial of Diamonds: Scoring Protocol

This document outlines the tactical rewards and penalties assigned during each round of the Trial.

## 1. Individual Combat Results
Points are assigned based on the outcome of your table battle (1v1 or 3v3).

| Outcome | Adjustment | Description |
| :--- | :--- | :--- |
| **Winner** | +200 CR | High valid sum or successful tactical neutralization (Hunter/Vaccination). |
| **Loser** | -100 CR | Lower sum or unsuccessful defense. |
| **Eliminated** | -500 CR | Neutralized by Shotgun or critical asset depletion. |

---

## 2. Team Tactical Bonus
After individual battles are resolved, a team-wide bonus or penalty is applied based on the Survival/Zombie ratio.

### Victory Condition
- **Survivor Team Wins** if active Survivors > active Zombies.
- **Zombie Team Wins** if active Zombies > active Survivors.

### Bonus / Penalty
- **Your Team Wins**: +300 CR
- **Your Team Loses**: -100 CR

---

## 3. Total Round Adjustment
Your final adjustment for the round is the sum of both components.

**Example Scenarios:**
- **Perfect Victory**: You win your table (+200) AND your team wins (+300) = **+500 CR**.
- **Tactical Defeat**: You win your table (+200) but your team loses (-100) = **+100 CR**.
- **Heavy Loss**: You lose your table (-100) and your team loses (-100) = **-200 CR**.
- **Critical Failure**: You are eliminated (-500) and your team loses (-100) = **-600 CR**.

---

## 🔍 System Verification
- All adjustments are calculated server-side during the `SCORING` phase.
- Your `Visa Adjustment` visible in the UI reflects the sum of both Individual and Team results.
