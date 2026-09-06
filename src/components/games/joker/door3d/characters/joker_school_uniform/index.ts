import type { CharacterPoseSettings, CharacterDefinition, CharacterEmoteTracks } from '../types';
import { JOKER_POSE } from '../joker/pose';
import { JOKER_EMOTES } from '../joker/emotes';

export const JOKER_SCHOOL_POSE: CharacterPoseSettings = {
    ...JOKER_POSE,
    modelScale: 1.73
};

export const JOKER_SCHOOL_EMOTES: CharacterEmoteTracks = { ...JOKER_EMOTES };

export const JOKER_SCHOOL_CHARACTER: CharacterDefinition = {
    id: 'joker_school_uniform',
    name: 'Joker (School Uniform)',
    subtitle: 'High-Poly Alternate Uniform Style',
    modelUrl: '/joker_school_uniform_high_poly.glb',
    previewImage: '/suit_assets/HARLEY_ORANGE.png',
    badge: 'SPECIAL OUTFIT',
    tag: 'SPECIAL JOKER',
    description: 'Detailed stylized uniform outfit with high-poly mesh detailing and unique gothic styling.',
    defaultFacingYaw: Math.PI,
    defaultPose: JOKER_SCHOOL_POSE,
    emotes: JOKER_SCHOOL_EMOTES
};
