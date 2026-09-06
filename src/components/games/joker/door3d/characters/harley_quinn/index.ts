import type { CharacterPoseSettings, CharacterDefinition, CharacterEmoteTracks } from '../types';
import { JOKER_EMOTES } from '../joker/emotes';

export const HARLEY_POSE: CharacterPoseSettings = {
    leftArmX: 0,
    leftArmY: 0,
    leftArmZ: 0,
    leftElbowX: 0,
    leftElbowY: 0,
    leftElbowZ: 0,
    rightArmX: 0,
    rightArmY: 0,
    rightArmZ: 0,
    rightElbowX: 0,
    rightElbowY: 0,
    rightElbowZ: 0,
    leftLegX: 0,
    leftLegY: 0,
    leftLegZ: 0,
    leftKneeX: 0,
    leftKneeY: 0,
    leftKneeZ: 0,
    rightLegX: 0,
    rightLegY: 0,
    rightLegZ: 0,
    rightKneeX: 0,
    rightKneeY: 0,
    rightKneeZ: 0,
    modelScale: 1.0,
};

export const HARLEY_EMOTES: CharacterEmoteTracks = { ...JOKER_EMOTES };

export const HARLEY_CHARACTER: CharacterDefinition = {
    id: 'harley_quinn',
    name: 'Harley Quinn (Classic Rigged)',
    subtitle: 'Textured & Rigged Classic Harley Outfit',
    modelUrl: '/harley_quin_-_textured_and_rigged.glb',
    previewImage: '/suit_assets/HARLEY_CLASSIC.png',
    badge: 'RIGGED 3D',
    tag: 'HARLEY QUINN',
    description: 'Classic harlequin costume in red & black split design with signature jester cowl and boots.',
    defaultFacingYaw: Math.PI,
    defaultPose: HARLEY_POSE,
    emotes: HARLEY_EMOTES
};
