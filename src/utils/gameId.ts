// Game ID Generation Utility
// Generates unique 13-character alphanumeric IDs for game sessions

/**
 * Generates a unique game session ID
 * Format: CG + 11 random alphanumeric characters
 * Example: "CG1A2B3C4D5E6"
 */
export function generateGameId(): string {
    const prefix = 'CG';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 11; // Total 13 with prefix

    let id = prefix;
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        id += chars.charAt(randomIndex);
    }

    return id;
}

/**
 * Validates a game ID format
 */
export function isValidGameId(id: string): boolean {
    // Must be exactly 13 characters
    if (id.length !== 13) return false;

    // Must start with "CG"
    if (!id.startsWith('CG')) return false;

    // Rest must be alphanumeric
    const suffix = id.substring(2);
    return /^[A-Z0-9]+$/.test(suffix);
}

/**
 * Formats game ID for display
 * Example: "CG1A2B3C4D5E6" -> "CG-1A2B-3C4D-5E6"
 */
export function formatGameId(id: string): string {
    if (!isValidGameId(id)) return id;

    const prefix = id.substring(0, 2);
    const suffix = id.substring(2);

    // Split into groups of 4
    const groups = suffix.match(/.{1,4}/g) || [];
    return `${prefix}-${groups.join('-')}`;
}
