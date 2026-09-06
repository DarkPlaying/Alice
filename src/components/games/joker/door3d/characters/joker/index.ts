import type { CharacterDefinition } from '../types';
import { JOKER_POSE } from './pose';
import { JOKER_EMOTES } from './emotes';

export const JOKER_CHARACTER: CharacterDefinition = {
    id: 'joker_arkham_origins',
    name: 'Joker (Arkham Origins)',
    subtitle: 'Classic Arkham Origins Suit with Purple Jacket',
    modelUrl: '/joker_batman_arkham_origins.glb',
    previewImage: '/suit_assets/INTERROGATION_JOKER.png',
    badge: 'ARKHAM ORIGINS',
    tag: 'ARKHAM JOKER',
    description: 'Arkham Origins suit with sculpted purple jacket, pinstripe trousers, and signature jester smile.',
    defaultFacingYaw: Math.PI,
    defaultPose: JOKER_POSE,
    emotes: JOKER_EMOTES
};

export { JOKER_POSE, JOKER_EMOTES };
