/**
 * Dedicated Configuration File for Joker Minigames
 * Easily modify minigame rounds, individual timers, and settings here.
 */
export const JokerMinigameConfig = {
    // Rounds that trigger minigame interval phases before choosing phase starts (Includes Round 1 for testing)
    MINIGAME_ROUNDS: [1, 2, 4, 8, 12],

    // Individual Timers (durations in seconds) for Each Minigame:
    // Total Minigame Phase Duration: 70s (20s card showing/memorization + 30s card playing + 20s result modal window)
    SLIP_CARD_GAME_DURATION_SEC: 70,     // Timer for Round 1, Round 2 & Round 4 Slip Card Game
    REFLEX_GAME_DURATION_SEC: 70,        // Timer for Round 8 Reflex Game
    TRUST_PAIRS_GAME_DURATION_SEC: 70,    // Timer for Round 12 Trust Pairs Game
    DEFAULT_MINIGAME_DURATION_SEC: 70,    // Default Minigame Timer

    /**
     * Check if a specific round triggers a minigame interval phase
     */
    isMinigameRound(round: number): boolean {
        return this.MINIGAME_ROUNDS.includes(round);
    },

    /**
     * Get exact minigame duration in seconds for a specific round
     */
    getMinigameDuration(round: number): number {
        switch (round) {
            case 1:
            case 2:
            case 4:
                return this.SLIP_CARD_GAME_DURATION_SEC;
            case 8:
                return this.REFLEX_GAME_DURATION_SEC;
            case 12:
                return this.TRUST_PAIRS_GAME_DURATION_SEC;
            default:
                return this.DEFAULT_MINIGAME_DURATION_SEC;
        }
    },

    /**
     * Get minigame type identifier for a specific round
     */
    getMinigameTypeForRound(round: number): 'slip' | 'reflex' | 'trust' | string {
        switch (round) {
            case 1:
            case 2:
            case 4:
                return 'slip';
            case 8:
                return 'reflex';
            case 12:
                return 'trust';
            default:
                return 'slip';
        }
    }
};
