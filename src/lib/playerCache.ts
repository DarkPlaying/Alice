/**
 * Player ID Cache System
 * Stores player ID mappings in localStorage to minimize Firebase fetches
 */

interface CachedPlayerData {
    players: any[];
    timestamp: number;
    version: string; // To invalidate on breaking changes
}

const CACHE_KEY = 'alice_player_cache';
const CACHE_VERSION = '1.0';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class PlayerCache {
    /**
     * Get players from cache or return null if stale/missing
     */
    static get(): any[] | null {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;

            const data: CachedPlayerData = JSON.parse(cached);

            // Check version
            if (data.version !== CACHE_VERSION) {
                console.log('[CACHE] Version mismatch, invalidating...');
                PlayerCache.clear();
                return null;
            }

            // Check freshness
            const age = Date.now() - data.timestamp;
            if (age > CACHE_TTL_MS) {
                console.log('[CACHE] Stale (age:', Math.round(age / 1000 / 60), 'min), invalidating...');
                PlayerCache.clear();
                return null;
            }

            console.log('[CACHE] Hit! Using cached players (age:', Math.round(age / 1000 / 60), 'min)');
            return data.players;
        } catch (error) {
            console.error('[CACHE] Read error:', error);
            PlayerCache.clear();
            return null;
        }
    }

    /**
     * Store players in cache
     */
    static set(players: any[]): void {
        try {
            const data: CachedPlayerData = {
                players,
                timestamp: Date.now(),
                version: CACHE_VERSION
            };

            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            console.log('[CACHE] Stored', players.length, 'players');
        } catch (error) {
            console.error('[CACHE] Write error:', error);
            // If quota exceeded, clear old cache and try again
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                PlayerCache.clear();
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({ players, timestamp: Date.now(), version: CACHE_VERSION }));
                } catch {
                    console.error('[CACHE] Failed even after clearing');
                }
            }
        }
    }

    /**
     * Clear cache (use when creating/deleting users)
     */
    static clear(): void {
        localStorage.removeItem(CACHE_KEY);
        console.log('[CACHE] Cleared');
    }

    /**
     * Force refresh (fetch new data and update cache)
     */
    static invalidate(): void {
        PlayerCache.clear();
        console.log('[CACHE] Invalidated - will fetch on next request');
    }

    /**
     * Get cache info for debugging
     */
    static getInfo(): { exists: boolean; age?: number; count?: number; size?: number } {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return { exists: false };

            const data: CachedPlayerData = JSON.parse(cached);
            const age = Date.now() - data.timestamp;

            return {
                exists: true,
                age,
                count: data.players.length,
                size: new Blob([cached]).size
            };
        } catch {
            return { exists: false };
        }
    }
}
