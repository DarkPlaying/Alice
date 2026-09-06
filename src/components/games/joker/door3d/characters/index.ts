import type { CharacterDefinition, CharacterPoseSettings, CharacterEmoteTracks } from './types';
import { EVIL_JOKER_CHARACTER } from './evil_joker';
import { BATMAN_CHARACTER } from './batman';
import { SPIDER_GWEN_CHARACTER } from './spider_gwen';
import { HARLEY_CHARACTER } from './harley_quinn';
import { NUBIA_CHARACTER } from './nubia';
import { JOKER_CHARACTER } from './joker';
import { JOKER_SCHOOL_CHARACTER } from './joker_school_uniform';
import { JOKER_CLASSIC_CHARACTER } from './joker_classic';

export * from './types';
export * from './joker';
export * from './batman';
export * from './harley_quinn';
export * from './nubia';
export * from './spider_gwen';
export * from './evil_joker';
export * from './joker_school_uniform';
export * from './joker_classic';

/**
 * Full master list of character definitions
 */
export const CHARACTER_DEFINITIONS: CharacterDefinition[] = [
    EVIL_JOKER_CHARACTER,
    BATMAN_CHARACTER,
    SPIDER_GWEN_CHARACTER,
    HARLEY_CHARACTER,
    NUBIA_CHARACTER,
    JOKER_CHARACTER,
    JOKER_SCHOOL_CHARACTER,
    JOKER_CLASSIC_CHARACTER
];

/**
 * Retrieve a character definition by its ID or GLB model URL
 */
export function getCharacterDefinition(idOrUrl?: string): CharacterDefinition {
    if (!idOrUrl) return JOKER_CHARACTER;
    const clean = idOrUrl.toLowerCase().trim();
    const found = CHARACTER_DEFINITIONS.find(
        c => c.id.toLowerCase() === clean || c.modelUrl.toLowerCase() === clean || clean.includes(c.id.toLowerCase())
    );
    return found || JOKER_CHARACTER;
}

/**
 * Retrieve the default pose settings for a character from its folder
 */
export function getCharacterDefaultPose(idOrUrl?: string): CharacterPoseSettings {
    const def = getCharacterDefinition(idOrUrl);
    return { ...def.defaultPose };
}

/**
 * Load active pose settings for a character (stored in localStorage or fallback to folder default)
 */
export function loadCharacterPose(idOrUrl?: string): CharacterPoseSettings {
    const def = getCharacterDefinition(idOrUrl);
    if (typeof window !== 'undefined') {
        try {
            const saved = localStorage.getItem(`char_pose_${def.id}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                const scale = (parsed.modelScale && parsed.modelScale !== 10.8 && parsed.modelScale !== 0.85) ? parsed.modelScale : def.defaultPose.modelScale;
                return { ...def.defaultPose, ...parsed, modelScale: scale };
            }
        } catch { }
    }
    return { ...def.defaultPose };
}

/**
 * Save custom pose settings for a character
 */
export function saveCharacterPose(idOrUrl: string, pose: CharacterPoseSettings): void {
    const def = getCharacterDefinition(idOrUrl);
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(`char_pose_${def.id}`, JSON.stringify(pose));
        } catch { }
    }
}

/**
 * Load active emote keyframe tracks for a character (stored in localStorage or fallback to folder default)
 */
export function loadCharacterEmotes(idOrUrl?: string): CharacterEmoteTracks {
    const def = getCharacterDefinition(idOrUrl);
    if (typeof window !== 'undefined') {
        try {
            const saved = localStorage.getItem(`char_emotes_${def.id}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.walk && Array.isArray(parsed.walk)) {
                    const isCorruptedZ = parsed.walk[3]?.ll?.z > 10;
                    const isOldArms = (parsed.walk[0]?.la?.z ?? 0) < 15;
                    if (isCorruptedZ || isOldArms) {
                        parsed.walk = def.emotes.walk;
                    }
                }
                if (!parsed.door || !Array.isArray(parsed.door) || parsed.door.length === 0) {
                    parsed.door = def.emotes.door;
                }
                if (!parsed.scanner || !Array.isArray(parsed.scanner) || parsed.scanner.length === 0 || def.id === 'batman') {
                    parsed.scanner = def.emotes.scanner;
                }
                return { ...def.emotes, ...parsed };
            }
        } catch { }
    }
    return { ...def.emotes };
}

/**
 * Save custom emote keyframe tracks for a character
 */
export function saveCharacterEmotes(idOrUrl: string, emotes: CharacterEmoteTracks): void {
    const def = getCharacterDefinition(idOrUrl);
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(`char_emotes_${def.id}`, JSON.stringify(emotes));
        } catch { }
    }
}
