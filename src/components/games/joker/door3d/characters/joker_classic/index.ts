import type { CharacterPoseSettings, CharacterDefinition, CharacterEmoteTracks } from '../types';
import { JOKER_POSE } from '../joker/pose';
import { JOKER_EMOTES } from '../joker/emotes';

export const JOKER_CLASSIC_POSE: CharacterPoseSettings = {
    ...JOKER_POSE,
    modelScale: 1.73
};

export const JOKER_CLASSIC_EMOTES: CharacterEmoteTracks = { ...JOKER_EMOTES };

export const JOKER_CLASSIC_CHARACTER: CharacterDefinition = {
    id: 'joker_classic',
    name: 'Joker (Classic Stylized)',
    subtitle: 'Optimized Lightweight 3D Rigged Model',
    modelUrl: '/joker.glb',
    previewImage: '/suit_assets/JOKER.png',
    badge: 'LIGHTWEIGHT',
    tag: 'CLASSIC JOKER',
    description: 'Ultra-fast lightweight stylized Joker model optimized for performance.',
    defaultFacingYaw: Math.PI,
    defaultPose: JOKER_CLASSIC_POSE,
    emotes: JOKER_CLASSIC_EMOTES
};
