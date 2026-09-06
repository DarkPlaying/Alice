import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CharacterPoseSettings } from './character/Stylized3DCharacter';

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

export interface LiveCoordsData {
    la: { x: number; y: number; z: number };
    ra: { x: number; y: number; z: number };
    le?: { x: number; y: number; z: number };
    re?: { x: number; y: number; z: number };
    ll: { x: number; y: number; z: number };
    rl: { x: number; y: number; z: number };
    lk?: { x: number; y: number; z: number };
    rk?: { x: number; y: number; z: number };
    progress: number;
    stageName: string;
}

interface CharacterPreview3DProps {
    modelUrl: string;
    poseSettings?: CharacterPoseSettings;
    modelScale?: number;
    autoRotate?: boolean;
    activeEmote?: 'none' | 'idle' | 'walk' | 'door' | 'scanner' | 'jump';
    isPaused?: boolean;
    manualScrubProgress?: number; // 0 to 1, if set, overrides time
    customKeyframes?: KeyframePoint[];
    onLiveCoordsUpdate?: (data: LiveCoordsData) => void;
    className?: string;
}

function interpolateKeyframes(keyframes: KeyframePoint[], progress01: number): {
    la: { x: number; y: number; z: number };
    ra: { x: number; y: number; z: number };
    le: { x: number; y: number; z: number };
    re: { x: number; y: number; z: number };
    ll: { x: number; y: number; z: number };
    rl: { x: number; y: number; z: number };
    lk: { x: number; y: number; z: number };
    rk: { x: number; y: number; z: number };
} {
    const defaultCoords = {
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

    function keyframePointOrDefault(pt?: { x: number; y: number; z: number }) {
        return pt ? { ...pt } : { x: 0, y: 0, z: 0 };
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

    // Find bounding keyframes
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

export const CharacterPreview3D: React.FC<CharacterPreview3DProps> = ({
    modelUrl,
    poseSettings,
    modelScale = 1.0,
    autoRotate = true,
    activeEmote = 'none',
    isPaused = false,
    manualScrubProgress = -1,
    customKeyframes,
    onLiveCoordsUpdate,
    className = ''
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const pivotRef = useRef<THREE.Group | null>(null);
    const modelGroupRef = useRef<THREE.Group | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const cameraDistanceRef = useRef<number>(5.8);
    const shadowMeshRef = useRef<THREE.Mesh | null>(null);
    const ringMeshRef = useRef<THREE.Mesh | null>(null);
    const animIdRef = useRef<number | null>(null);

    const isDraggingRef = useRef(false);
    const prevMousePosRef = useRef({ x: 0, y: 0 });
    const rotationRef = useRef({ y: 0, x: 0 });

    const propsRef = useRef({
        poseSettings,
        modelScale,
        autoRotate,
        activeEmote,
        isPaused,
        manualScrubProgress,
        customKeyframes,
        onLiveCoordsUpdate
    });
    propsRef.current = {
        poseSettings,
        modelScale,
        autoRotate,
        activeEmote,
        isPaused,
        manualScrubProgress,
        customKeyframes,
        onLiveCoordsUpdate
    };

    const updateCameraFraming = (scaleVal: number) => {
        if (!cameraRef.current) return;
        const totalHeight = 1.70 * (scaleVal || 1.73);
        const centerY = totalHeight * 0.52;
        const fovRad = (34 * Math.PI) / 180;
        const dist = (totalHeight * 1.35) / (2 * Math.tan(fovRad / 2));
        cameraDistanceRef.current = dist;
        cameraRef.current.position.set(0, centerY, dist);
        cameraRef.current.lookAt(0, centerY, 0);
        cameraRef.current.far = Math.max(100, dist * 5);
        cameraRef.current.updateProjectionMatrix();

        const ringScale = (scaleVal || 1.73) / 1.73;
        if (shadowMeshRef.current) shadowMeshRef.current.scale.set(ringScale, ringScale, ringScale);
        if (ringMeshRef.current) ringMeshRef.current.scale.set(ringScale, ringScale, ringScale);
    };

    // Update Model Scale when prop changes and frame camera
    useEffect(() => {
        if (modelGroupRef.current) {
            const baseScale = (modelGroupRef.current as any).__baseScale || 1.0;
            const finalScale = baseScale * modelScale;
            modelGroupRef.current.scale.set(finalScale, finalScale, finalScale);
            modelGroupRef.current.updateMatrixWorld(true);
            const scaledBBox = new THREE.Box3().setFromObject(modelGroupRef.current);
            const scaledCenter = scaledBBox.getCenter(new THREE.Vector3());
            modelGroupRef.current.position.x = -scaledCenter.x;
            modelGroupRef.current.position.y = -scaledBBox.min.y;
            modelGroupRef.current.position.z = -scaledCenter.z;
        }
        updateCameraFraming(modelScale);
    }, [modelScale]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const width = container.clientWidth || 500;
        const height = container.clientHeight || 560;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
        cameraRef.current = camera;
        updateCameraFraming(propsRef.current.modelScale || 1.73);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.5;
        renderer.shadowMap.enabled = true;
        rendererRef.current = renderer;

        container.replaceChildren(renderer.domElement);

        // Responsive Resize Observer
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w = entry.contentRect.width || width;
                const h = entry.contentRect.height || height;
                if (w > 0 && h > 0) {
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                    renderer.setSize(w, h);
                }
            }
        });
        resizeObserver.observe(container);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffeedd, 2.5);
        keyLight.position.set(2.5, 3.5, 2.5);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x88ccff, 1.6);
        fillLight.position.set(-2.5, 2.5, 2.5);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xa855f7, 3.0);
        rimLight.position.set(0, 3, -3);
        scene.add(rimLight);

        // Ground Pedestal Glow & Ring
        const pivot = new THREE.Group();
        pivotRef.current = pivot;
        scene.add(pivot);

        const shadowGeo = new THREE.CircleGeometry(0.75, 32);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.60
        });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = 0.005;
        scene.add(shadowMesh);
        shadowMeshRef.current = shadowMesh;

        const ringGeo = new THREE.RingGeometry(0.70, 0.76, 48);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x6366f1,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.y = 0.01;
        scene.add(ringMesh);
        ringMeshRef.current = ringMesh;

        // Skeleton References
        let isBipedRig = false;
        let isLegAlongX = false;
        let leftArmBone: THREE.Bone | null = null;
        let rightArmBone: THREE.Bone | null = null;
        let leftElbowBone: THREE.Bone | null = null;
        let rightElbowBone: THREE.Bone | null = null;
        let leftLegBone: THREE.Bone | null = null;
        let rightLegBone: THREE.Bone | null = null;
        let leftKneeBone: THREE.Bone | null = null;
        let rightKneeBone: THREE.Bone | null = null;
        let spineBone: THREE.Bone | null = null;

        const initRotLA = new THREE.Euler();
        const initRotRA = new THREE.Euler();
        const initRotLE = new THREE.Euler();
        const initRotRE = new THREE.Euler();
        const initRotLL = new THREE.Euler();
        const initRotRL = new THREE.Euler();
        const initRotLK = new THREE.Euler();
        const initRotRK = new THREE.Euler();
        const initRotSpine = new THREE.Euler();

        let emoteTime = 0;

        // Load Character Model
        const loader = new GLTFLoader();
        loader.load(
            modelUrl,
            (gltf) => {
                const model = gltf.scene;
                modelGroupRef.current = model;

                const allBones: THREE.Bone[] = [];
                model.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                    if ((child as THREE.Bone).isBone) {
                        allBones.push(child as THREE.Bone);
                    }
                });

                isBipedRig = allBones.some(b => b.name.toLowerCase().includes('bip01'));

                allBones.forEach((bone) => {
                    const name = bone.name.toLowerCase();
                    const isLeft = name.includes('left') || name.includes('_l') || name.endsWith('_l') || name.includes('.l') || name.includes('l_') || (bone.position.x > 0.03 && !name.includes('right') && !name.includes('_r'));
                    const isRight = name.includes('right') || name.includes('_r') || name.endsWith('_r') || name.includes('.r') || name.includes('r_') || (bone.position.x < -0.03 && !name.includes('left') && !name.includes('_l'));

                    if (!spineBone && (name.includes('spine') || name.includes('chest') || name.includes('torso') || name.includes('pelvis'))) {
                        spineBone = bone;
                        initRotSpine.copy(bone.rotation);
                    }
                    if (!leftArmBone && isLeft && (name.includes('upperarm') || name.includes('uparm') || name.includes('clavicle') || (name.includes('arm') && !name.includes('forearm') && !name.includes('loarm') && !name.includes('hand') && !name.includes('finger')))) {
                        leftArmBone = bone;
                        initRotLA.copy(bone.rotation);
                    }
                    if (!rightArmBone && isRight && (name.includes('upperarm') || name.includes('uparm') || name.includes('clavicle') || (name.includes('arm') && !name.includes('forearm') && !name.includes('loarm') && !name.includes('hand') && !name.includes('finger')))) {
                        rightArmBone = bone;
                        initRotRA.copy(bone.rotation);
                    }
                    if (!leftElbowBone && isLeft && (name.includes('forearm') || name.includes('loarm') || name.includes('elbow') || name.includes('arm_02') || name.includes('arm_b'))) {
                        leftElbowBone = bone;
                        initRotLE.copy(bone.rotation);
                    }
                    if (!rightElbowBone && isRight && (name.includes('forearm') || name.includes('loarm') || name.includes('elbow') || name.includes('arm_02') || name.includes('arm_b'))) {
                        rightElbowBone = bone;
                        initRotRE.copy(bone.rotation);
                    }
                    if (!leftLegBone && isLeft && (name.includes('thigh') || name.includes('upleg') || name.includes('leg_a') || (name.includes('leg') && !name.includes('shin') && !name.includes('calf') && !name.includes('loleg') && !name.includes('foot') && !name.includes('toe')))) {
                        leftLegBone = bone;
                        initRotLL.copy(bone.rotation);
                    }
                    if (!rightLegBone && isRight && (name.includes('thigh') || name.includes('upleg') || name.includes('leg_a') || (name.includes('leg') && !name.includes('shin') && !name.includes('calf') && !name.includes('loleg') && !name.includes('foot') && !name.includes('toe')))) {
                        rightLegBone = bone;
                        initRotRL.copy(bone.rotation);
                    }
                    if (!leftKneeBone && isLeft && (name.includes('calf') || name.includes('shin') || name.includes('knee') || name.includes('loleg') || name.includes('leg_b') || name.includes('leg_02'))) {
                        leftKneeBone = bone;
                        initRotLK.copy(bone.rotation);
                    }
                    if (!rightKneeBone && isRight && (name.includes('calf') || name.includes('shin') || name.includes('knee') || name.includes('loleg') || name.includes('leg_b') || name.includes('leg_02'))) {
                        rightKneeBone = bone;
                        initRotRK.copy(bone.rotation);
                    }
                });
                
                // Detect whether leg bone is rigged along X (Batman Biped) or Y (Joker / standard)
                if (leftLegBone) {
                    const isBatmanBiped = leftLegBone.name.toLowerCase().startsWith('bip01');
                    isLegAlongX = isBatmanBiped || (leftKneeBone ? Math.abs(leftKneeBone.position.x) > Math.abs(leftKneeBone.position.y) : false);
                }

                // Adjust facing orientation in preview
                const isNubia = modelUrl.toLowerCase().includes('nubia');
                model.rotation.set(0, isNubia ? -Math.PI / 2 : 0, 0);
                model.updateMatrixWorld(true);

                // Exact bounding box scaling to 1.70m
                const rawBbox = new THREE.Box3().setFromObject(model);
                const size = rawBbox.getSize(new THREE.Vector3());
                const rawHeight = Math.max(0.5, size.y || 1.8);
                const targetHeight = 1.70;
                const baseScale = targetHeight / rawHeight;
                (model as any).__baseScale = baseScale;

                const currentScale = baseScale * propsRef.current.modelScale;
                model.scale.set(currentScale, currentScale, currentScale);
                model.updateMatrixWorld(true);

                // Ground feet precisely at Y = 0 and center horizontally
                const scaledBBox = new THREE.Box3().setFromObject(model);
                const scaledCenter = scaledBBox.getCenter(new THREE.Vector3());

                model.position.x = -scaledCenter.x;
                model.position.y = -scaledBBox.min.y;
                model.position.z = -scaledCenter.z;

                pivot.add(model);

                updateCameraFraming(propsRef.current.modelScale || 1.73);
            },
            undefined,
            (error) => {
                console.error(`Failed to load preview for ${modelUrl}:`, error);
            }
        );

        // Animation Loop
        const clock = new THREE.Clock();
        const animate = () => {
            animIdRef.current = requestAnimationFrame(animate);
            const delta = clock.getDelta();
            const { poseSettings: p, autoRotate: shouldRotate, activeEmote: emote, isPaused: paused, manualScrubProgress: scrubProg, customKeyframes: userKeyframes, onLiveCoordsUpdate: emitCoords } = propsRef.current;

            // Turntable Auto-Rotation
            if (shouldRotate && !isDraggingRef.current && pivot) {
                rotationRef.current.y += delta * 0.45;
            }

            if (pivot) {
                pivot.rotation.y = rotationRef.current.y;
                pivot.rotation.x = rotationRef.current.x * 0.25;
            }

            // Emote Logic & Keyframe Evaluation
            let customOffsetLA = { x: 0, y: 0, z: 0 };
            let customOffsetRA = { x: 0, y: 0, z: 0 };
            let customOffsetLE = { x: 0, y: 0, z: 0 };
            let customOffsetRE = { x: 0, y: 0, z: 0 };
            let customOffsetLL = { x: 0, y: 0, z: 0 };
            let customOffsetRL = { x: 0, y: 0, z: 0 };
            let customOffsetLK = { x: 0, y: 0, z: 0 };
            let customOffsetRK = { x: 0, y: 0, z: 0 };

            let legStrideL = 0;
            let legStrideR = 0;
            let armPitchL = 0;
            let armPitchR = 0;
            let armRollR = 0;
            let armYawR = 0;
            let elbowBendL = 0;
            let elbowBendR = 0;
            let kneeBendL = 0;
            let kneeBendR = 0;
            let spineNod = 0;
            let currentProgress = 0;
            let currentStageName = 'IDLE STAND';

            if (!paused && scrubProg < 0) {
                emoteTime += delta;
            }

            if (userKeyframes && userKeyframes.length > 0 && emote !== 'none') {
                const cycleDuration = emote === 'idle' ? 3.0 : emote === 'walk' ? 1.15 : emote === 'door' ? 2.4 : emote === 'scanner' ? 1.4 : 1.2;
                currentProgress = scrubProg >= 0 ? scrubProg : (emoteTime % cycleDuration) / cycleDuration;
                currentStageName = `CUSTOM EMOTE (${Math.round(currentProgress * 100)}%)`;

                const evaluated = interpolateKeyframes(userKeyframes, currentProgress);
                customOffsetLA = evaluated.la || { x: 0, y: 0, z: 0 };
                customOffsetRA = evaluated.ra || { x: 0, y: 0, z: 0 };
                customOffsetLE = evaluated.le || { x: 0, y: 0, z: 0 };
                customOffsetRE = evaluated.re || { x: 0, y: 0, z: 0 };
                customOffsetLL = evaluated.ll || { x: 0, y: 0, z: 0 };
                customOffsetRL = evaluated.rl || { x: 0, y: 0, z: 0 };
                customOffsetLK = evaluated.lk || { x: 0, y: 0, z: 0 };
                customOffsetRK = evaluated.rk || { x: 0, y: 0, z: 0 };
            } else if (emote === 'walk') {
                const cycleDuration = 1.15;
                currentProgress = scrubProg >= 0 ? scrubProg : (emoteTime % cycleDuration) / cycleDuration;
                const phase = currentProgress * Math.PI * 2;
                currentStageName = currentProgress < 0.5 ? 'LEFT STRIDE PEAK' : 'RIGHT STRIDE PEAK';

                legStrideL = Math.sin(phase) * 0.38;
                legStrideR = -Math.sin(phase) * 0.38;
                armPitchL = legStrideR * 0.28;
                armPitchR = legStrideL * 0.28;
                elbowBendL = Math.max(0, -Math.sin(phase)) * 0.14;
                elbowBendR = Math.max(0, Math.sin(phase)) * 0.14;
                kneeBendL = Math.max(0, Math.sin(phase + Math.PI * 0.2)) * 0.40;
                kneeBendR = Math.max(0, -Math.sin(phase + Math.PI * 0.2)) * 0.40;
            } else if (emote === 'door') {
                const totalDuration = 2.4;
                currentProgress = scrubProg >= 0 ? scrubProg : Math.min(1.0, (emoteTime % totalDuration) / totalDuration);

                if (currentProgress < 0.35) {
                    const reach = currentProgress / 0.35;
                    currentStageName = `1. REACH KNOB (${Math.round(reach * 100)}%)`;
                    spineNod = 0.25 * reach;
                    armPitchR = -1.45 * reach;
                    elbowBendR = 0.15 * reach;
                } else if (currentProgress < 0.85) {
                    const pull = (currentProgress - 0.35) / 0.50;
                    currentStageName = `2. PULL DOOR OPEN (${Math.round(pull * 100)}%)`;
                    spineNod = 0.25 - pull * 0.50;
                    armPitchR = -1.45 + pull * 1.15;
                    armRollR = pull * 0.35;
                    elbowBendR = 0.15 + pull * 1.10;
                } else {
                    const settle = (currentProgress - 0.85) / 0.15;
                    currentStageName = `3. RELEASE & SETTLE (${Math.round(settle * 100)}%)`;
                    spineNod = -0.25 * (1.0 - settle);
                    armPitchR = -0.30 * (1.0 - settle);
                    elbowBendR = 1.25 * (1.0 - settle);
                }
            } else if (emote === 'scanner') {
                const totalDuration = 1.4;
                currentProgress = scrubProg >= 0 ? scrubProg : Math.min(1.0, (emoteTime % totalDuration) / totalDuration);
                if (currentProgress < 0.5) {
                    const reach = currentProgress / 0.5;
                    currentStageName = `1. TOUCH SENSOR (${Math.round(reach * 100)}%)`;
                    armPitchR = -1.22 * reach;
                    elbowBendR = 0.65 * reach;
                } else {
                    const ret = (currentProgress - 0.5) / 0.5;
                    currentStageName = `2. AUTHORIZED (${Math.round(ret * 100)}%)`;
                    armPitchR = -1.22 * (1.0 - ret);
                    elbowBendR = 0.65 * (1.0 - ret);
                }
            } else if (emote === 'jump') {
                const totalDuration = 1.2;
                currentProgress = scrubProg >= 0 ? scrubProg : (emoteTime % totalDuration) / totalDuration;
                currentStageName = currentProgress < 0.5 ? 'AIRBORNE PEAK' : 'IMPACT BOUNCE';
                const jumpPhase = Math.sin(currentProgress * Math.PI);
                armPitchL = -jumpPhase * 0.5;
                armPitchR = -jumpPhase * 0.5;
                kneeBendL = jumpPhase * 0.6;
                kneeBendR = jumpPhase * 0.6;
            }

            const degToRad = (deg: number) => (deg * Math.PI) / 180;

            const laX = degToRad((p?.leftArmX || 0) + customOffsetLA.x);
            const laY = degToRad((p?.leftArmY || 0) + customOffsetLA.y);
            const laZ = degToRad((p?.leftArmZ || 0) + customOffsetLA.z);

            const raX = degToRad((p?.rightArmX || 0) + customOffsetRA.x);
            const raY = degToRad((p?.rightArmY || 0) + customOffsetRA.y);
            const raZ = degToRad((p?.rightArmZ || 0) + customOffsetRA.z);

            const leX = degToRad((p?.leftElbowX || 0) + customOffsetLE.x);
            const leY = degToRad((p?.leftElbowY || 0) + customOffsetLE.y);
            const leZ = degToRad((p?.leftElbowZ || 0) + customOffsetLE.z);

            const reX = degToRad((p?.rightElbowX || 0) + customOffsetRE.x);
            const reY = degToRad((p?.rightElbowY || 0) + customOffsetRE.y);
            const reZ = degToRad((p?.rightElbowZ || 0) + customOffsetRE.z);

            const llX = degToRad((p?.leftLegX || 0) + customOffsetLL.x);
            const llY = degToRad((p?.leftLegY || 0) + customOffsetLL.y);
            const llZ = degToRad((p?.leftLegZ || 0) + customOffsetLL.z);

            const rlX = degToRad((p?.rightLegX || 0) + customOffsetRL.x);
            const rlY = degToRad((p?.rightLegY || 0) + customOffsetRL.y);
            const rlZ = degToRad((p?.rightLegZ || 0) + customOffsetRL.z);

            const lkX = degToRad((p?.leftKneeX || 0) + customOffsetLK.x);
            const lkY = degToRad((p?.leftKneeY || 0) + customOffsetLK.y);
            const lkZ = degToRad((p?.leftKneeZ || 0) + customOffsetLK.z);

            const rkX = degToRad((p?.rightKneeX || 0) + customOffsetRK.x);
            const rkY = degToRad((p?.rightKneeY || 0) + customOffsetRK.y);
            const rkZ = degToRad((p?.rightKneeZ || 0) + customOffsetRK.z);

            if (spineBone) {
                spineBone.rotation.x = initRotSpine.x + spineNod;
            }

            if (leftArmBone) {
                if (isBipedRig) {
                    leftArmBone.rotation.x = initRotLA.x + laX;
                    leftArmBone.rotation.y = initRotLA.y + laY - armPitchL;
                    leftArmBone.rotation.z = initRotLA.z + laZ;
                } else {
                    leftArmBone.rotation.x = initRotLA.x + laX + armPitchL;
                    leftArmBone.rotation.y = initRotLA.y + laY;
                    leftArmBone.rotation.z = initRotLA.z + laZ;
                }
            }

            if (rightArmBone) {
                if (isBipedRig) {
                    rightArmBone.rotation.x = initRotRA.x + raX;
                    rightArmBone.rotation.y = initRotRA.y + raY + armPitchR;
                    rightArmBone.rotation.z = initRotRA.z + raZ;
                } else {
                    rightArmBone.rotation.x = initRotRA.x + raX + armPitchR;
                    rightArmBone.rotation.y = initRotRA.y + raY + armYawR;
                    rightArmBone.rotation.z = initRotRA.z + raZ + armRollR;
                }
            }

            if (leftElbowBone) {
                if (isBipedRig) {
                    leftElbowBone.rotation.x = initRotLE.x + leX;
                    leftElbowBone.rotation.y = initRotLE.y + leY;
                    leftElbowBone.rotation.z = initRotLE.z + leZ - elbowBendL;
                } else {
                    leftElbowBone.rotation.x = initRotLE.x + leX - elbowBendL;
                    leftElbowBone.rotation.y = initRotLE.y + leY;
                    leftElbowBone.rotation.z = initRotLE.z + leZ;
                }
            }

            if (rightElbowBone) {
                if (isBipedRig) {
                    rightElbowBone.rotation.x = initRotRE.x + reX;
                    rightElbowBone.rotation.y = initRotRE.y + reY;
                    rightElbowBone.rotation.z = initRotRE.z + reZ + elbowBendR;
                } else {
                    rightElbowBone.rotation.x = initRotRE.x + reX - elbowBendR;
                    rightElbowBone.rotation.y = initRotRE.y + reY;
                    rightElbowBone.rotation.z = initRotRE.z + reZ;
                }
            }

            if (leftLegBone) {
                if (isLegAlongX) {
                    leftLegBone.rotation.x = initRotLL.x + llX + legStrideL;
                    leftLegBone.rotation.y = initRotLL.y + llY;
                    leftLegBone.rotation.z = initRotLL.z + llZ;
                } else {
                    // For Joker (Y-axis rig): forward/backward stride is on X, sideways is on Z
                    leftLegBone.rotation.x = initRotLL.x + llZ + legStrideL;
                    leftLegBone.rotation.y = initRotLL.y + llY;
                    leftLegBone.rotation.z = initRotLL.z + llX;
                }
            }

            if (rightLegBone) {
                if (isLegAlongX) {
                    rightLegBone.rotation.x = initRotRL.x + rlX + legStrideR;
                    rightLegBone.rotation.y = initRotRL.y + rlY;
                    rightLegBone.rotation.z = initRotRL.z + rlZ;
                } else {
                    // For Joker (Y-axis rig): forward/backward stride is on X, sideways is on Z
                    rightLegBone.rotation.x = initRotRL.x + rlZ + legStrideR;
                    rightLegBone.rotation.y = initRotRL.y + rlY;
                    rightLegBone.rotation.z = initRotRL.z + rlX;
                }
            }

            if (leftKneeBone) {
                if (isLegAlongX) {
                    leftKneeBone.rotation.x = initRotLK.x + lkX + kneeBendL;
                    leftKneeBone.rotation.y = initRotLK.y + lkY;
                    leftKneeBone.rotation.z = initRotLK.z + lkZ;
                } else {
                    // For Joker: backward knee bend is -lkZ on X
                    leftKneeBone.rotation.x = initRotLK.x - lkZ + kneeBendL;
                    leftKneeBone.rotation.y = initRotLK.y + lkY;
                    leftKneeBone.rotation.z = initRotLK.z + lkX;
                }
            }

            if (rightKneeBone) {
                if (isLegAlongX) {
                    rightKneeBone.rotation.x = initRotRK.x + rkX + kneeBendR;
                    rightKneeBone.rotation.y = initRotRK.y + rkY;
                    rightKneeBone.rotation.z = initRotRK.z + rkZ;
                } else {
                    // For Joker: backward knee bend is -rkZ on X
                    rightKneeBone.rotation.x = initRotRK.x - rkZ + kneeBendR;
                    rightKneeBone.rotation.y = initRotRK.y + rkY;
                    rightKneeBone.rotation.z = initRotRK.z + rkX;
                }
            }

            // Emit Live Dynamic Coordinates for settings panel
            if (emitCoords) {
                const toDeg = (rad: number) => Math.round((rad * 180) / Math.PI);
                emitCoords({
                    la: {
                        x: toDeg(laX + (isBipedRig ? 0 : armPitchL)),
                        y: toDeg(laY),
                        z: toDeg(laZ - (isBipedRig ? armPitchL : 0))
                    },
                    ra: {
                        x: toDeg(raX + (isBipedRig ? 0 : armPitchR)),
                        y: toDeg(raY + armYawR),
                        z: toDeg(raZ + (isBipedRig ? armPitchR : armRollR))
                    },
                    le: {
                        x: toDeg(leX - (isBipedRig ? 0 : elbowBendL)),
                        y: toDeg(leY),
                        z: toDeg(leZ - (isBipedRig ? elbowBendL : 0))
                    },
                    re: {
                        x: toDeg(reX - (isBipedRig ? 0 : elbowBendR)),
                        y: toDeg(reY),
                        z: toDeg(reZ + (isBipedRig ? elbowBendR : 0))
                    },
                    ll: {
                        x: toDeg(llX + legStrideL),
                        y: toDeg(llY),
                        z: toDeg(llZ)
                    },
                    rl: {
                        x: toDeg(rlX + legStrideR),
                        y: toDeg(rlY),
                        z: toDeg(rlZ)
                    },
                    lk: {
                        x: toDeg(lkX + kneeBendL),
                        y: toDeg(lkY),
                        z: toDeg(lkZ)
                    },
                    rk: {
                        x: toDeg(rkX + kneeBendR),
                        y: toDeg(rkY),
                        z: toDeg(rkZ)
                    },
                    progress: currentProgress,
                    stageName: currentStageName
                });
            }

            renderer.render(scene, camera);
        };
        animate();

        // Pointer Drag Events for 360 Inspection
        const onPointerDown = (e: PointerEvent) => {
            isDraggingRef.current = true;
            prevMousePosRef.current = { x: e.clientX, y: e.clientY };
            (e.target as HTMLElement)?.setPointerCapture(e.pointerId);
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!isDraggingRef.current) return;
            const deltaX = e.clientX - prevMousePosRef.current.x;
            const deltaY = e.clientY - prevMousePosRef.current.y;
            prevMousePosRef.current = { x: e.clientX, y: e.clientY };

            rotationRef.current.y += deltaX * 0.016;
            rotationRef.current.x = Math.max(-0.45, Math.min(0.45, rotationRef.current.x + deltaY * 0.014));
        };

        const onPointerUp = (e: PointerEvent) => {
            isDraggingRef.current = false;
            try {
                (e.target as HTMLElement)?.releasePointerCapture(e.pointerId);
            } catch {}
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (cameraRef.current) {
                const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
                cameraDistanceRef.current = Math.max(1.0, Math.min(25.0, cameraDistanceRef.current * zoomFactor));
                const totalHeight = 1.70 * (propsRef.current.modelScale || 1.73);
                const centerY = totalHeight * 0.52;
                cameraRef.current.position.set(0, centerY, cameraDistanceRef.current);
                cameraRef.current.lookAt(0, centerY, 0);
            }
        };

        const domElem = renderer.domElement;
        domElem.addEventListener('pointerdown', onPointerDown);
        domElem.addEventListener('pointermove', onPointerMove);
        domElem.addEventListener('pointerup', onPointerUp);
        domElem.addEventListener('pointercancel', onPointerUp);
        domElem.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
            resizeObserver.disconnect();
            domElem.removeEventListener('pointerdown', onPointerDown);
            domElem.removeEventListener('pointermove', onPointerMove);
            domElem.removeEventListener('pointerup', onPointerUp);
            domElem.removeEventListener('pointercancel', onPointerUp);
            domElem.removeEventListener('wheel', onWheel);
            renderer.dispose();
            container.replaceChildren();
        };
    }, [modelUrl]);

    return (
        <div className={`relative select-none touch-none ${className}`}>
            <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none bg-black/75 backdrop-blur-md border border-cyan-500/50 text-cyan-300 text-[10px] font-mono font-black px-4 py-1 rounded-full shadow-xl uppercase tracking-widest flex items-center gap-1.5 shrink-0 whitespace-nowrap z-10">
                <span>🔄 360° DRAG TO ROTATE • 🔍 SCROLL TO ZOOM</span>
            </div>
        </div>
    );
};
