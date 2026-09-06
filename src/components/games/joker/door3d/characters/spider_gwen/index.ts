import type { CharacterPoseSettings, CharacterDefinition, CharacterEmoteTracks } from '../types';
import { JOKER_EMOTES } from '../joker/emotes';

export const SPIDER_GWEN_POSE: CharacterPoseSettings = {
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

export const SPIDER_GWEN_EMOTES: CharacterEmoteTracks = { ...JOKER_EMOTES };

export const SPIDER_GWEN_CHARACTER: CharacterDefinition = {
    id: 'spider_gwen',
    name: 'Spider-Gwen (Marvel UA3)',
    subtitle: 'Hooded Web-Warrior Rigged Model',
    modelUrl: '/spider_gwen_marvel_ultimate_alliance_3.glb',
    previewImage: '/suit_assets/SPIDER_GWEN.png',
    badge: 'RIGGED 3D',
    tag: 'SPIDER GWEN',
    description: 'Dynamic comic-accurate Spider-Gwen suit with white hood, web-patterned torso, and pink accents.',
    defaultFacingYaw: Math.PI,
    defaultPose: SPIDER_GWEN_POSE,
    emotes: SPIDER_GWEN_EMOTES
};
