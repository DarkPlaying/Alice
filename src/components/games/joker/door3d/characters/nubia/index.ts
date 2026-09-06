import type { CharacterPoseSettings, CharacterDefinition, CharacterEmoteTracks } from '../types';
import { JOKER_EMOTES } from '../joker/emotes';

export const NUBIA_POSE: CharacterPoseSettings = {
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

export const NUBIA_EMOTES: CharacterEmoteTracks = { ...JOKER_EMOTES };

export const NUBIA_CHARACTER: CharacterDefinition = {
    id: 'nubia',
    name: 'Nubia (Multiversus)',
    subtitle: 'Amazonian Queen Battle Armor with Golden Staff',
    modelUrl: '/nubia__multiversus.glb',
    previewImage: '/suit_assets/NUBIA.png',
    badge: 'RIGGED 3D',
    tag: 'NUBIA QUEEN',
    description: 'Majestic golden battle armor with red royal sash, Amazonian circlet, and armored greaves.',
    defaultFacingYaw: -Math.PI / 2,
    defaultPose: NUBIA_POSE,
    emotes: NUBIA_EMOTES
};
