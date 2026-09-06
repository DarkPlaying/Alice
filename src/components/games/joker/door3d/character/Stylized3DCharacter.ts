import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
    getCharacterDefinition,
    loadCharacterPose,
    loadCharacterEmotes,
    interpolateKeyframes,
    type CharacterPoseSettings,
    type CharacterEmoteTracks,
    type KeyframePoint,
    JOKER_POSE,
    BATMAN_POSE,
} from '../characters';

/**
 * Interface representing custom transformations applied to an individual 3D body part mesh
 */
export interface CustomPartTransform {
    id: string;          // Unique identifier for the custom part
    meshName: string;    // Raw Three.js mesh name in the GLB scene
    displayName: string; // User-facing display name (editable)
    rotX: number;        // Rotation pitch around X-axis (degrees)
    rotY: number;        // Rotation yaw around Y-axis (degrees)
    rotZ: number;        // Rotation roll around Z-axis (degrees)
    posX: number;        // Position offset along X-axis
    posY: number;        // Position offset along Y-axis
    posZ: number;        // Position offset along Z-axis
}

export type { CharacterPoseSettings };

export const DEFAULT_POSE_SETTINGS: CharacterPoseSettings = { ...BATMAN_POSE };
export const BATMAN_DEFAULT_POSE: CharacterPoseSettings = { ...BATMAN_POSE };
export const JOKER_DEFAULT_POSE: CharacterPoseSettings = { ...JOKER_POSE };

export const DEFAULT_CHARACTER_POSES: Record<string, CharacterPoseSettings> = {
    '/batman_origins_suit_-_textured_and_rigged.glb': BATMAN_DEFAULT_POSE,
    'batman_origins': BATMAN_DEFAULT_POSE,
    '/joker_batman_arkham_origins.glb': JOKER_DEFAULT_POSE,
    'joker_arkham_origins': JOKER_DEFAULT_POSE,
    '/evil_joker_3d_model.glb': JOKER_DEFAULT_POSE,
    'evil_joker': JOKER_DEFAULT_POSE,
    '/joker_school_uniform_high_poly.glb': JOKER_DEFAULT_POSE,
    'joker_school_uniform': JOKER_DEFAULT_POSE,
    '/joker.glb': JOKER_DEFAULT_POSE,
    'joker_classic': JOKER_DEFAULT_POSE,
};

export const getCharacterDefaultPose = (modelUrlOrId?: string): CharacterPoseSettings => {
    if (!modelUrlOrId) return { ...JOKER_DEFAULT_POSE };
    return loadCharacterPose(modelUrlOrId);
};

// ============================================================================
// REALISTIC DOOR KNOB REACH & PULL ANIMATION ENGINE & CHARACTER RIG APPLIER
// ============================================================================
export class Stylized3DCharacter {
    public mesh: THREE.Group;
    public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

    // Initial orientation: 0 so character faces North door away from camera (PUBG Backside View)
    public rotationY: number = 0;
    public targetRotationY: number = 0;

    // Movement & Animation States
    public isWalking: boolean = false;
    public jumpVelocity: number = 0;
    public jumpHeight: number = 0;
    public doorEmoteTimer: number = 0;
    public doorEmoteDuration: number = 2.4;
    public scannerTouchTimer: number = 0;

    // Procedural Animation Variables
    private walkTime: number = 0;
    private idleTime: number = 0;
    private turnBankRoll: number = 0;
    private landingImpactBounce: number = 0;

    public poseSettings: CharacterPoseSettings;
    public emoteTracks: CharacterEmoteTracks;
    public customParts: CustomPartTransform[] = [];

    public modelGroup: THREE.Group | null = null;
    public baseScale: number = 1.0;
    public currentModelUrl: string = '/joker_batman_arkham_origins.glb';
    public debugInfo: string = 'Loading...';

    // Skeleton Bone Nodes
    private leftArmRootBone: THREE.Bone | null = null;
    private rightArmRootBone: THREE.Bone | null = null;
    private leftElbowBone: THREE.Bone | null = null;
    private rightElbowBone: THREE.Bone | null = null;
    private leftHandBone: THREE.Bone | null = null;
    private rightHandBone: THREE.Bone | null = null;

    private leftLegRootBone: THREE.Bone | null = null;
    private rightLegRootBone: THREE.Bone | null = null;
    private leftKneeBone: THREE.Bone | null = null;
    private rightKneeBone: THREE.Bone | null = null;
    private leftFootBone: THREE.Bone | null = null;
    private rightFootBone: THREE.Bone | null = null;

    private spineBone: THREE.Bone | null = null;
    private headBone: THREE.Bone | null = null;

    // Initial Rest Pose Rotations
    private initialRotLeftArm: THREE.Euler = new THREE.Euler();
    private initialRotRightArm: THREE.Euler = new THREE.Euler();
    private initialRotLeftElbow: THREE.Euler = new THREE.Euler();
    private initialRotRightElbow: THREE.Euler = new THREE.Euler();
    private initialRotLeftHand: THREE.Euler = new THREE.Euler();
    private initialRotRightHand: THREE.Euler = new THREE.Euler();

    private initialRotLeftLeg: THREE.Euler = new THREE.Euler();
    private initialRotRightLeg: THREE.Euler = new THREE.Euler();
    private initialRotLeftKnee: THREE.Euler = new THREE.Euler();
    private initialRotRightKnee: THREE.Euler = new THREE.Euler();
    private initialRotLeftFoot: THREE.Euler = new THREE.Euler();
    private initialRotRightFoot: THREE.Euler = new THREE.Euler();

    private initialRotSpine: THREE.Euler = new THREE.Euler();
    private initialRotHead: THREE.Euler = new THREE.Euler();

    private isBipedRig: boolean = false;
    private isLegAlongX: boolean = false;

    constructor(initialModelUrl?: string) {
        this.mesh = new THREE.Group();
        this.mesh.name = 'CharacterRoot';

        let targetUrl = initialModelUrl;
        if (!targetUrl && typeof window !== 'undefined') {
            targetUrl = localStorage.getItem('joker_equipped_character') || '/joker_batman_arkham_origins.glb';
        }
        if (!targetUrl) targetUrl = '/joker_batman_arkham_origins.glb';

        this.poseSettings = loadCharacterPose(targetUrl);
        this.emoteTracks = loadCharacterEmotes(targetUrl);
        this.loadModel(targetUrl);
    }

    public loadModel(modelUrl: string, onLoaded?: () => void) {
        this.currentModelUrl = modelUrl;
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem('joker_equipped_character', modelUrl);
            }
        } catch { }

        // Automatically load character-specific settings and emotes from created folders
        this.poseSettings = loadCharacterPose(modelUrl);
        this.emoteTracks = loadCharacterEmotes(modelUrl);

        if (this.modelGroup) {
            this.mesh.remove(this.modelGroup);
            this.modelGroup = null;
        }

        // Reset bones
        this.isBipedRig = false;
        this.leftArmRootBone = null;
        this.rightArmRootBone = null;
        this.leftElbowBone = null;
        this.rightElbowBone = null;
        this.leftHandBone = null;
        this.rightHandBone = null;

        this.leftLegRootBone = null;
        this.rightLegRootBone = null;
        this.leftKneeBone = null;
        this.rightKneeBone = null;
        this.leftFootBone = null;
        this.rightFootBone = null;

        this.spineBone = null;
        this.headBone = null;

        const loader = new GLTFLoader();
        loader.load(
            modelUrl,
            (gltf) => {
                const rawModel = gltf.scene;
                this.modelGroup = rawModel;

                const allBones: THREE.Bone[] = [];

                // 1. Discover all genuine THREE.Bone nodes
                rawModel.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }

                    if ((child as THREE.Bone).isBone) {
                        allBones.push(child as THREE.Bone);
                    }
                });

                this.isBipedRig = allBones.some(b => b.name.toLowerCase().includes('bip01'));

                // 2. Discover Bones for EVERY JOINT matching preview system exactly
                allBones.forEach((bone) => {
                    const name = bone.name.toLowerCase();

                    const isLeft = name.includes('left') || name.includes('_l') || name.endsWith('_l') || name.includes('.l') || name.includes('l_') || (bone.position.x > 0.03 && !name.includes('right') && !name.includes('_r'));
                    const isRight = name.includes('right') || name.includes('_r') || name.endsWith('_r') || name.includes('.r') || name.includes('r_') || (bone.position.x < -0.03 && !name.includes('left') && !name.includes('_l'));

                    // Head & Spine
                    if (!this.headBone && (name.includes('head') || name.includes('neck')) && !name.includes('nub') && !name.includes('end')) {
                        this.headBone = bone;
                        this.initialRotHead.copy(bone.rotation);
                    }
                    if (!this.spineBone && (name.includes('spine') || name.includes('chest') || name.includes('torso') || name.includes('pelvis'))) {
                        this.spineBone = bone;
                        this.initialRotSpine.copy(bone.rotation);
                    }

                    // Shoulder / UpperArm Joints
                    if (!this.leftArmRootBone && isLeft && (name.includes('upperarm') || name.includes('uparm') || name.includes('clavicle') || (name.includes('arm') && !name.includes('forearm') && !name.includes('loarm') && !name.includes('hand') && !name.includes('finger')))) {
                        this.leftArmRootBone = bone;
                        this.initialRotLeftArm.copy(bone.rotation);
                    }
                    if (!this.rightArmRootBone && isRight && (name.includes('upperarm') || name.includes('uparm') || name.includes('clavicle') || (name.includes('arm') && !name.includes('forearm') && !name.includes('loarm') && !name.includes('hand') && !name.includes('finger')))) {
                        this.rightArmRootBone = bone;
                        this.initialRotRightArm.copy(bone.rotation);
                    }

                    // Elbow / Forearm Joints
                    if (!this.leftElbowBone && isLeft && (name.includes('forearm') || name.includes('loarm') || name.includes('elbow') || name.includes('arm_02') || name.includes('arm_b'))) {
                        this.leftElbowBone = bone;
                        this.initialRotLeftElbow.copy(bone.rotation);
                    }
                    if (!this.rightElbowBone && isRight && (name.includes('forearm') || name.includes('loarm') || name.includes('elbow') || name.includes('arm_02') || name.includes('arm_b'))) {
                        this.rightElbowBone = bone;
                        this.initialRotRightElbow.copy(bone.rotation);
                    }

                    // Hand / Wrist Joints
                    if (!this.leftHandBone && isLeft && (name.includes('hand') || name.includes('wrist')) && !name.includes('finger') && !name.includes('thumb') && !name.includes('index')) {
                        this.leftHandBone = bone;
                        this.initialRotLeftHand.copy(bone.rotation);
                    }
                    if (!this.rightHandBone && isRight && (name.includes('hand') || name.includes('wrist')) && !name.includes('finger') && !name.includes('thumb') && !name.includes('index')) {
                        this.rightHandBone = bone;
                        this.initialRotRightHand.copy(bone.rotation);
                    }

                    // Hip / Thigh Joints
                    if (!this.leftLegRootBone && isLeft && (name.includes('thigh') || name.includes('upleg') || name.includes('leg_a') || (name.includes('leg') && !name.includes('shin') && !name.includes('calf') && !name.includes('loleg') && !name.includes('foot') && !name.includes('toe')))) {
                        this.leftLegRootBone = bone;
                        this.initialRotLeftLeg.copy(bone.rotation);
                    }
                    if (!this.rightLegRootBone && isRight && (name.includes('thigh') || name.includes('upleg') || name.includes('leg_a') || (name.includes('leg') && !name.includes('shin') && !name.includes('calf') && !name.includes('loleg') && !name.includes('foot') && !name.includes('toe')))) {
                        this.rightLegRootBone = bone;
                        this.initialRotRightLeg.copy(bone.rotation);
                    }

                    // Knee Joints
                    if (!this.leftKneeBone && isLeft && (name.includes('calf') || name.includes('shin') || name.includes('knee') || name.includes('loleg') || name.includes('leg_b') || name.includes('leg_02'))) {
                        this.leftKneeBone = bone;
                        this.initialRotLeftKnee.copy(bone.rotation);
                    }
                    if (!this.rightKneeBone && isRight && (name.includes('calf') || name.includes('shin') || name.includes('knee') || name.includes('loleg') || name.includes('leg_b') || name.includes('leg_02'))) {
                        this.rightKneeBone = bone;
                        this.initialRotRightKnee.copy(bone.rotation);
                    }

                    // Ankle / Foot Joints
                    if (!this.leftFootBone && isLeft && (name.includes('foot') || name.includes('ankle') || name.includes('toe'))) {
                        this.leftFootBone = bone;
                        this.initialRotLeftFoot.copy(bone.rotation);
                    }
                    if (!this.rightFootBone && isRight && (name.includes('foot') || name.includes('ankle') || name.includes('toe'))) {
                        this.rightFootBone = bone;
                        this.initialRotRightFoot.copy(bone.rotation);
                    }
                });

                if (this.leftLegRootBone) {
                    const isBatmanBiped = this.leftLegRootBone.name.toLowerCase().startsWith('bip01');
                    this.isLegAlongX = isBatmanBiped || (this.leftKneeBone ? Math.abs(this.leftKneeBone.position.x) > Math.abs(this.leftKneeBone.position.y) : false);
                }

                // Fallbacks for Arm & Leg Roots
                if (!this.leftArmRootBone) this.leftArmRootBone = allBones.find(b => b.name.toLowerCase().includes('arm') && b.position.x > 0.02) || null;
                if (!this.rightArmRootBone) this.rightArmRootBone = allBones.find(b => b.name.toLowerCase().includes('arm') && b.position.x < -0.02) || null;
                if (!this.leftLegRootBone) this.leftLegRootBone = allBones.find(b => b.name.toLowerCase().includes('leg') && b.position.x > 0.01) || null;
                if (!this.rightLegRootBone) this.rightLegRootBone = allBones.find(b => b.name.toLowerCase().includes('leg') && b.position.x < -0.01) || null;

                if (this.leftArmRootBone) this.initialRotLeftArm.copy(this.leftArmRootBone.rotation);
                if (this.rightArmRootBone) this.initialRotRightArm.copy(this.rightArmRootBone.rotation);
                if (this.leftLegRootBone) this.initialRotLeftLeg.copy(this.leftLegRootBone.rotation);
                if (this.rightLegRootBone) this.initialRotRightLeg.copy(this.rightLegRootBone.rotation);

                // 3. Stand model upright facing away from camera (PUBG Backside View)
                const charDef = getCharacterDefinition(modelUrl);
                const facingYaw = charDef.defaultFacingYaw ?? Math.PI;
                rawModel.rotation.set(0, facingYaw, 0);
                rawModel.updateMatrixWorld(true);

                // 4. Calculate accurate base height & apply character position scale
                const bbox = new THREE.Box3().setFromObject(rawModel);
                const size = bbox.getSize(new THREE.Vector3());
                const rawHeight = Math.max(0.5, size.y || 1.8);
                const targetHeight = 1.70;
                this.baseScale = targetHeight / rawHeight;

                const currentScale = this.baseScale * (this.poseSettings.modelScale || 1.73);
                rawModel.scale.set(currentScale, currentScale, currentScale);
                rawModel.updateMatrixWorld(true);

                // Ground feet precisely at floor level Y = 0
                this.regroundFeet();

                this.debugInfo = modelUrl.replace('.glb', '').replace('/', '');
                this.mesh.add(rawModel);
                if (onLoaded) onLoaded();
            },
            undefined,
            (error) => {
                console.error(`Failed to load ${modelUrl}:`, error);
                this.debugInfo = `Error loading ${modelUrl}`;
            }
        );
    }

    public regroundFeet() {
        if (!this.modelGroup) return;
        this.modelGroup.updateMatrixWorld(true);
        const scaledBBox = new THREE.Box3().setFromObject(this.modelGroup);
        this.modelGroup.position.y = -scaledBBox.min.y;
    }

    public updatePoseSettings(newSettings: Partial<CharacterPoseSettings>) {
        this.poseSettings = { ...this.poseSettings, ...newSettings };
        if (this.modelGroup && newSettings.modelScale !== undefined) {
            const currentScale = this.baseScale * this.poseSettings.modelScale;
            this.modelGroup.scale.set(currentScale, currentScale, currentScale);
            this.regroundFeet();
        }
    }

    public setEmoteTracks(tracks: CharacterEmoteTracks) {
        this.emoteTracks = { ...this.emoteTracks, ...tracks };
    }

    public triggerJump() {
        if (this.jumpHeight <= 0 && this.doorEmoteTimer <= 0) {
            this.jumpVelocity = 4.6; // Natural realistic human jump impulse
            this.jumpHeight = 0.02;
        }
    }

    public triggerScannerTouchEmote() {
        this.scannerTouchTimer = 1.4; // 1.4s biometric terminal touch & authorization
    }

    public triggerDoorPullEmote() {
        this.doorEmoteDuration = 2.4;
        this.doorEmoteTimer = 2.4; // 2.4s door handle reach & pull emote duration
    }

    public update(delta: number, isWalking?: boolean) {
        if (isWalking !== undefined) {
            this.isWalking = isWalking;
        }

        // --- 1. SMOOTH TURNING & BANKING LEAN EFFECT ---
        let diffAngle = this.targetRotationY - this.rotationY;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;

        const turnSpeed = diffAngle * Math.min(1.0, delta * 10.0);
        this.rotationY += turnSpeed;

        this.turnBankRoll = THREE.MathUtils.lerp(this.turnBankRoll, -turnSpeed * 0.25, Math.min(1.0, delta * 8.0));

        // --- 2. NATURAL JUMPING PHYSICS & IMPACT BOUNCE EFFECT ---
        let verticalJumpOffset = 0;
        if (this.jumpHeight > 0 || this.jumpVelocity !== 0) {
            this.jumpVelocity -= 14.0 * delta; // Realistic gravity
            this.jumpHeight += this.jumpVelocity * delta;
            if (this.jumpHeight <= 0) {
                this.jumpHeight = 0;
                this.jumpVelocity = 0;
                this.landingImpactBounce = 0.10;
            }
            verticalJumpOffset = this.jumpHeight;
        }

        if (this.landingImpactBounce > 0) {
            this.landingImpactBounce = THREE.MathUtils.lerp(this.landingImpactBounce, 0, Math.min(1.0, delta * 10.0));
        }

        const totalHeightOffset = verticalJumpOffset - this.landingImpactBounce * 0.4;

        // --- 3. DETERMINE ACTIVE EMOTE & ADVANCE TIMERS ---
        let activeEmote = 'idle';
        let currentProgress = 0;

        if (this.scannerTouchTimer > 0) {
            this.scannerTouchTimer -= delta;
            activeEmote = 'scanner';
            currentProgress = Math.max(0, Math.min(1.0, 1.0 - (this.scannerTouchTimer / 1.4)));
        } else if (this.doorEmoteTimer > 0) {
            this.doorEmoteTimer -= delta;
            activeEmote = 'door';
            currentProgress = Math.max(0, Math.min(1.0, 1.0 - (this.doorEmoteTimer / this.doorEmoteDuration)));
        } else if (this.jumpHeight > 0 || this.jumpVelocity !== 0) {
            activeEmote = 'jump';
            currentProgress = Math.max(0, Math.min(1.0, (0.5 - this.jumpHeight) / 0.5));
        } else if (this.isWalking) {
            this.walkTime += delta;
            activeEmote = 'walk';
            const cycleDuration = 1.15;
            currentProgress = (this.walkTime % cycleDuration) / cycleDuration;
        } else {
            this.walkTime = 0;
            this.idleTime += delta;
            activeEmote = 'idle';
            const idleDuration = 3.0;
            currentProgress = (this.idleTime % idleDuration) / idleDuration;
        }

        // --- 4. EVALUATE EMOTE KEYFRAME TRACK FROM CHARACTER FOLDER ---
        const keyframeTrack = this.emoteTracks[activeEmote] || this.emoteTracks['idle'] || [];
        const evaluated = interpolateKeyframes(keyframeTrack, currentProgress);

        // Update root mesh position and rotation
        this.mesh.position.y = this.position.y + totalHeightOffset;
        this.mesh.position.x = this.position.x;
        this.mesh.position.z = this.position.z;

        this.mesh.rotation.y = this.rotationY;
        this.mesh.rotation.z = this.turnBankRoll;

        // --- 5. APPLY POSITION ROTATIONS & EMOTE COORDINATES TO SKELETON JOINTS ---
        if (this.modelGroup) {
            const laOffset = evaluated.la || { x: 0, y: 0, z: 0 };
            const raOffset = evaluated.ra || { x: 0, y: 0, z: 0 };
            const leOffset = evaluated.le || { x: 0, y: 0, z: 0 };
            const reOffset = evaluated.re || { x: 0, y: 0, z: 0 };

            const degToRad = (deg: number) => (deg * Math.PI) / 180;
            const laX = degToRad((this.poseSettings.leftArmX || 0) + laOffset.x);
            const laY = degToRad((this.poseSettings.leftArmY || 0) + laOffset.y);
            const laZ = degToRad((this.poseSettings.leftArmZ || 0) + laOffset.z);

            const raX = degToRad((this.poseSettings.rightArmX || 0) + raOffset.x);
            const raY = degToRad((this.poseSettings.rightArmY || 0) + raOffset.y);
            const raZ = degToRad((this.poseSettings.rightArmZ || 0) + raOffset.z);

            const leX = degToRad((this.poseSettings.leftElbowX || 0) + leOffset.x);
            const leY = degToRad((this.poseSettings.leftElbowY || 0) + leOffset.y);
            const leZ = degToRad((this.poseSettings.leftElbowZ || 0) + leOffset.z);

            const reX = degToRad((this.poseSettings.rightElbowX || 0) + reOffset.x);
            const reY = degToRad((this.poseSettings.rightElbowY || 0) + reOffset.y);
            const reZ = degToRad((this.poseSettings.rightElbowZ || 0) + reOffset.z);

            const llX = degToRad((this.poseSettings.leftLegX || 0) + evaluated.ll.x);
            const llY = degToRad((this.poseSettings.leftLegY || 0) + evaluated.ll.y);
            const llZ = degToRad((this.poseSettings.leftLegZ || 0) + evaluated.ll.z);

            const rlX = degToRad((this.poseSettings.rightLegX || 0) + evaluated.rl.x);
            const rlY = degToRad((this.poseSettings.rightLegY || 0) + evaluated.rl.y);
            const rlZ = degToRad((this.poseSettings.rightLegZ || 0) + evaluated.rl.z);

            const lkX = degToRad((this.poseSettings.leftKneeX || 0) + (evaluated.lk?.x ?? 0));
            const lkY = degToRad((this.poseSettings.leftKneeY || 0) + (evaluated.lk?.y ?? 0));
            const lkZ = degToRad((this.poseSettings.leftKneeZ || 0) + (evaluated.lk?.z ?? 0));

            const rkX = degToRad((this.poseSettings.rightKneeX || 0) + (evaluated.rk?.x ?? 0));
            const rkY = degToRad((this.poseSettings.rightKneeY || 0) + (evaluated.rk?.y ?? 0));
            const rkZ = degToRad((this.poseSettings.rightKneeZ || 0) + (evaluated.rk?.z ?? 0));

            // Spine & Torso
            if (this.spineBone) {
                this.spineBone.rotation.x = this.initialRotSpine.x;
                this.spineBone.rotation.y = this.initialRotSpine.y;
                this.spineBone.rotation.z = this.initialRotSpine.z;
            }

            // Head Joint
            if (this.headBone) {
                this.headBone.rotation.y = this.initialRotHead.y;
            }

            // Left Shoulder / Arm Joint
            if (this.leftArmRootBone) {
                this.leftArmRootBone.rotation.x = this.initialRotLeftArm.x + laX;
                this.leftArmRootBone.rotation.y = this.initialRotLeftArm.y + laY;
                this.leftArmRootBone.rotation.z = this.initialRotLeftArm.z + laZ;
            }

            // Right Shoulder / Arm Joint
            if (this.rightArmRootBone) {
                this.rightArmRootBone.rotation.x = this.initialRotRightArm.x + raX;
                this.rightArmRootBone.rotation.y = this.initialRotRightArm.y + raY;
                this.rightArmRootBone.rotation.z = this.initialRotRightArm.z + raZ;
            }

            // Left Elbow Joint
            if (this.leftElbowBone) {
                if (this.isBipedRig) {
                    this.leftElbowBone.rotation.x = this.initialRotLeftElbow.x + leX;
                    this.leftElbowBone.rotation.y = this.initialRotLeftElbow.y + leY;
                    this.leftElbowBone.rotation.z = this.initialRotLeftElbow.z + leZ;
                } else {
                    this.leftElbowBone.rotation.x = this.initialRotLeftElbow.x + leX;
                    this.leftElbowBone.rotation.y = this.initialRotLeftElbow.y + leY;
                    this.leftElbowBone.rotation.z = this.initialRotLeftElbow.z + leZ;
                }
            }

            // Right Elbow Joint
            if (this.rightElbowBone) {
                if (this.isBipedRig) {
                    this.rightElbowBone.rotation.x = this.initialRotRightElbow.x + reX;
                    this.rightElbowBone.rotation.y = this.initialRotRightElbow.y + reY;
                    this.rightElbowBone.rotation.z = this.initialRotRightElbow.z + reZ;
                } else {
                    this.rightElbowBone.rotation.x = this.initialRotRightElbow.x + reX;
                    this.rightElbowBone.rotation.y = this.initialRotRightElbow.y + reY;
                    this.rightElbowBone.rotation.z = this.initialRotRightElbow.z + reZ;
                }
            }

            // Left & Right Hand Joints (Keep strictly locked in rest pose, no extraneous motion)
            if (this.leftHandBone) {
                this.leftHandBone.rotation.copy(this.initialRotLeftHand);
            }
            if (this.rightHandBone) {
                this.rightHandBone.rotation.copy(this.initialRotRightHand);
            }

            // Left Hip / Thigh Joint
            if (this.leftLegRootBone) {
                if (this.isLegAlongX) {
                    this.leftLegRootBone.rotation.x = this.initialRotLeftLeg.x + llX;
                    this.leftLegRootBone.rotation.y = this.initialRotLeftLeg.y + llY;
                    this.leftLegRootBone.rotation.z = this.initialRotLeftLeg.z + llZ;
                } else {
                    this.leftLegRootBone.rotation.x = this.initialRotLeftLeg.x + llZ;
                    this.leftLegRootBone.rotation.y = this.initialRotLeftLeg.y + llY;
                    this.leftLegRootBone.rotation.z = this.initialRotLeftLeg.z + llX;
                }
            }

            // Right Hip / Thigh Joint
            if (this.rightLegRootBone) {
                if (this.isLegAlongX) {
                    this.rightLegRootBone.rotation.x = this.initialRotRightLeg.x + rlX;
                    this.rightLegRootBone.rotation.y = this.initialRotRightLeg.y + rlY;
                    this.rightLegRootBone.rotation.z = this.initialRotRightLeg.z + rlZ;
                } else {
                    this.rightLegRootBone.rotation.x = this.initialRotRightLeg.x + rlZ;
                    this.rightLegRootBone.rotation.y = this.initialRotRightLeg.y + rlY;
                    this.rightLegRootBone.rotation.z = this.initialRotRightLeg.z + rlX;
                }
            }

            // Left Knee Joint
            if (this.leftKneeBone) {
                if (this.isLegAlongX) {
                    this.leftKneeBone.rotation.x = this.initialRotLeftKnee.x + lkX;
                    this.leftKneeBone.rotation.y = this.initialRotLeftKnee.y + lkY;
                    this.leftKneeBone.rotation.z = this.initialRotLeftKnee.z + lkZ;
                } else {
                    this.leftKneeBone.rotation.x = this.initialRotLeftKnee.x - lkZ;
                    this.leftKneeBone.rotation.y = this.initialRotLeftKnee.y + lkY;
                    this.leftKneeBone.rotation.z = this.initialRotLeftKnee.z + lkX;
                }
            }

            // Right Knee Joint
            if (this.rightKneeBone) {
                if (this.isLegAlongX) {
                    this.rightKneeBone.rotation.x = this.initialRotRightKnee.x + rkX;
                    this.rightKneeBone.rotation.y = this.initialRotRightKnee.y + rkY;
                    this.rightKneeBone.rotation.z = this.initialRotRightKnee.z + rkZ;
                } else {
                    this.rightKneeBone.rotation.x = this.initialRotRightKnee.x - rkZ;
                    this.rightKneeBone.rotation.y = this.initialRotRightKnee.y + rkY;
                    this.rightKneeBone.rotation.z = this.initialRotRightKnee.z + rkX;
                }
            }

            // Apply Custom Picked Body Part Transforms
            this.customParts.forEach(cp => {
                const obj = this.mesh.getObjectByName(cp.meshName);
                if (obj) {
                    obj.rotation.x = (cp.rotX * Math.PI) / 180;
                    obj.rotation.y = (cp.rotY * Math.PI) / 180;
                    obj.rotation.z = (cp.rotZ * Math.PI) / 180;
                    obj.position.x = cp.posX;
                    obj.position.y = cp.posY;
                    obj.position.z = cp.posZ;
                }
            });
        }
    }
}
