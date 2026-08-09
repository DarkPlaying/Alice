import { JokerMinigameConfig } from './JokerMinigameConfig';

/**
 * Centralized Configuration for Joker Trial Game
 * Modify phase durations, game timings, and lock time management here.
 */
export const JokerGameConfig = {
    // Phase Durations in seconds
    CHOOSING_PHASE_DURATION_SEC: 40,    // Seconds for Choosing Phase (e.g. 40s or 80s)
    REVEAL_PHASE_DURATION_SEC: 20,      // Seconds for Reveal Phase
    BRIEFING_PHASE_DURATION_SEC: 2,    // Seconds for Briefing Phase

    // Lock Time Management (in seconds)
    // Configure remaining time threshold for door locking & card activation rules
    // Default is 10 (inventory & special cards locked in final 10 seconds of choosing phase).
    DOOR_LOCK_DISABLE_THRESHOLD_SEC: 10,

    /**
     * Check if current round triggers a minigame interval phase
     */
    isMinigameRound(round: number): boolean {
        return JokerMinigameConfig.isMinigameRound(round);
    },

    /**
     * Get exact phase duration in seconds based on phase and current round
     */
    getPhaseDuration(phase: 'briefing' | 'choosing' | 'reveal' | 'minigame' | 'end' | 'idle' | string, round: number = 1): number {
        switch (phase) {
            case 'briefing':
                return this.BRIEFING_PHASE_DURATION_SEC;
            case 'minigame':
                return JokerMinigameConfig.getMinigameDuration(round);
            case 'choosing':
                return this.CHOOSING_PHASE_DURATION_SEC;
            case 'reveal':
                return this.REVEAL_PHASE_DURATION_SEC;
            case 'end':
                return 0;
            default:
                return this.CHOOSING_PHASE_DURATION_SEC;
        }
    },

    /**
     * Check if remaining time in choosing phase is within the lock management threshold
     */
    isDoorLockRestricted(timeLeftSec: number): boolean {
        if (this.DOOR_LOCK_DISABLE_THRESHOLD_SEC <= 0) return false;
        return timeLeftSec <= this.DOOR_LOCK_DISABLE_THRESHOLD_SEC;
    }
};
