/**
 * Character Configuration, Pose and Emote Types
 */

export interface CharacterPoseSettings {
    leftArmX: number;
    leftArmY: number;
    leftArmZ: number;

    rightArmX: number;
    rightArmY: number;
    rightArmZ: number;

    leftElbowX?: number;
    leftElbowY?: number;
    leftElbowZ?: number;

    rightElbowX?: number;
    rightElbowY?: number;
    rightElbowZ?: number;

    leftLegX: number;
    leftLegY: number;
    leftLegZ: number;

    rightLegX: number;
    rightLegY: number;
    rightLegZ: number;

    leftKneeX?: number;
    leftKneeY?: number;
    leftKneeZ?: number;

    rightKneeX?: number;
    rightKneeY?: number;
    rightKneeZ?: number;

    modelScale: number;
}

export interface KeyframePoint {
    percentage: number; // 0 to 100
    name?: string;
    la: { x: number; y: number; z: number };
    ra: { x: number; y: number; z: number };
    le?: { x: number; y: number; z: number };
    re?: { x: number; y: number; z: number };
    ll: { x: number; y: number; z: number };
    rl: { x: number; y: number; z: number };
    lk?: { x: number; y: number; z: number };
    rk?: { x: number; y: number; z: number };
}

export type EmoteKey = 'idle' | 'walk' | 'door' | 'scanner' | 'jump' | string;

export type CharacterEmoteTracks = Record<EmoteKey, KeyframePoint[]>;

export interface CharacterDefinition {
    id: string;
    name: string;
    subtitle: string;
    modelUrl: string;
    previewImage: string;
    badge: string;
    tag: string;
    description: string;
    defaultFacingYaw?: number; // radians, e.g. Math.PI or -Math.PI / 2
    defaultPose: CharacterPoseSettings;
    emotes: CharacterEmoteTracks;
}

export interface EvaluatedKeyframeOffsets {
    la: { x: number; y: number; z: number };
    ra: { x: number; y: number; z: number };
    le: { x: number; y: number; z: number };
    re: { x: number; y: number; z: number };
    ll: { x: number; y: number; z: number };
    rl: { x: number; y: number; z: number };
    lk: { x: number; y: number; z: number };
    rk: { x: number; y: number; z: number };
}

export function interpolateKeyframes(keyframes: KeyframePoint[], progress01: number): EvaluatedKeyframeOffsets {
    const defaultCoords: EvaluatedKeyframeOffsets = {
        la: { x: 0, y: 0, z: 0 },
        ra: { x: 0, y: 0, z: 0 },
        le: { x: 0, y: 0, z: 0 },
        re: { x: 0, y: 0, z: 0 },
        ll: { x: 0, y: 0, z: 0 },
        rl: { x: 0, y: 0, z: 0 },
        lk: { x: 0, y: 0, z: 0 },
        rk: { x: 0, y: 0, z: 0 },
    };

    if (!keyframes || keyframes.length === 0) {
        return defaultCoords;
    }

    function keyframePointOrDefault(pt?: { x: number; y: number; z: number }) {
        return pt ? { ...pt } : { x: 0, y: 0, z: 0 };
    }

    if (keyframes.length === 1) {
        return {
            la: { ...keyframes[0].la },
            ra: { ...keyframes[0].ra },
            le: keyframePointOrDefault(keyframes[0].le),
            re: keyframePointOrDefault(keyframes[0].re),
            ll: { ...keyframes[0].ll },
            rl: { ...keyframes[0].rl },
            lk: keyframePointOrDefault(keyframes[0].lk),
            rk: keyframePointOrDefault(keyframes[0].rk),
        };
    }

    const currentPercent = Math.max(0, Math.min(100, progress01 * 100));
    const sorted = [...keyframes].sort((a, b) => a.percentage - b.percentage);

    if (currentPercent <= sorted[0].percentage) {
        const first = sorted[0];
        return {
            la: { ...first.la },
            ra: { ...first.ra },
            le: keyframePointOrDefault(first.le),
            re: keyframePointOrDefault(first.re),
            ll: { ...first.ll },
            rl: { ...first.rl },
            lk: keyframePointOrDefault(first.lk),
            rk: keyframePointOrDefault(first.rk),
        };
    }
    if (currentPercent >= sorted[sorted.length - 1].percentage) {
        const last = sorted[sorted.length - 1];
        return {
            la: { ...last.la },
            ra: { ...last.ra },
            le: keyframePointOrDefault(last.le),
            re: keyframePointOrDefault(last.re),
            ll: { ...last.ll },
            rl: { ...last.rl },
            lk: keyframePointOrDefault(last.lk),
            rk: keyframePointOrDefault(last.rk),
        };
    }

    let k0 = sorted[0];
    let k1 = sorted[1];
    for (let i = 0; i < sorted.length - 1; i++) {
        if (currentPercent >= sorted[i].percentage && currentPercent <= sorted[i + 1].percentage) {
            k0 = sorted[i];
            k1 = sorted[i + 1];
            break;
        }
    }

    const span = k1.percentage - k0.percentage || 1;
    const alpha = Math.max(0, Math.min(1, (currentPercent - k0.percentage) / span));

    const lerp = (a: number, b: number) => a + alpha * (b - a);
    const lerpVec = (v0?: { x: number; y: number; z: number }, v1?: { x: number; y: number; z: number }) => {
        const a = v0 || { x: 0, y: 0, z: 0 };
        const b = v1 || { x: 0, y: 0, z: 0 };
        return { x: lerp(a.x, b.x), y: lerp(a.y, b.y), z: lerp(a.z, b.z) };
    };

    return {
        la: lerpVec(k0.la, k1.la),
        ra: lerpVec(k0.ra, k1.ra),
        le: lerpVec(k0.le, k1.le),
        re: lerpVec(k0.re, k1.re),
        ll: lerpVec(k0.ll, k1.ll),
        rl: lerpVec(k0.rl, k1.rl),
        lk: lerpVec(k0.lk, k1.lk),
        rk: lerpVec(k0.rk, k1.rk),
    };
}
