import type { CharacterPoseSettings, CharacterDefinition, CharacterEmoteTracks } from '../types';
import { JOKER_POSE } from '../joker/pose';
import { JOKER_EMOTES } from '../joker/emotes';

export const EVIL_JOKER_POSE: CharacterPoseSettings = {
    ...JOKER_POSE,
    modelScale: 1.73
};

export const EVIL_JOKER_EMOTES: CharacterEmoteTracks = { ...JOKER_EMOTES };

export const EVIL_JOKER_CHARACTER: CharacterDefinition = {
    id: 'evil_joker',
    name: 'Evil Joker (Default Outfit)',
    subtitle: 'Arcane Jester Master Outfit with Jester Hat & Shoes',
    modelUrl: '/evil_joker_3d_model.glb',
    previewImage: '/suit_assets/JOKER.png',
    badge: 'CURRENT JOKER',
    tag: 'EVIL JOKER',
    description: 'Iconic Arcane Jester outfit featuring stylized feather hat, sculpted coat & gothic clown boots.',
    defaultFacingYaw: Math.PI,
    defaultPose: EVIL_JOKER_POSE,
    emotes: EVIL_JOKER_EMOTES
};
