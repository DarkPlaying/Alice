import type { CharacterDefinition } from '../types';
import { BATMAN_POSE } from './pose';
import { BATMAN_EMOTES } from './emotes';

export const BATMAN_CHARACTER: CharacterDefinition = {
    id: 'batman_origins',
    name: 'Batman (Origins Suit)',
    subtitle: 'Textured & Rigged Dark Knight Tactical Armor',
    modelUrl: '/batman_origins_suit_-_textured_and_rigged.glb',
    previewImage: '/suit_assets/ORIGINS_BATMAN.png',
    badge: 'RIGGED 3D',
    tag: 'BATMAN ORIGINS',
    description: 'Heavy tactical armor suit with reinforced chest insignia, utility belt, cape, and gauntlets.',
    defaultFacingYaw: Math.PI,
    defaultPose: BATMAN_POSE,
    emotes: BATMAN_EMOTES
};

export { BATMAN_POSE, BATMAN_EMOTES };
