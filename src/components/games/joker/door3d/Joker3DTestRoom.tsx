import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { DungeonHallway, type EnvironmentSurfaceSettings } from './DungeonHallway';
import { TestDoorSystem } from './TestDoorSystem';
import { SoundEngine } from './SoundEngine';
import { PlayerController } from './PlayerController';
import { Stylized3DCharacter, DEFAULT_POSE_SETTINGS, BATMAN_DEFAULT_POSE, DEFAULT_CHARACTER_POSES, getCharacterDefaultPose, type CharacterPoseSettings, type CustomPartTransform } from './character/Stylized3DCharacter';
import { CharacterPreview3D, type LiveCoordsData, type KeyframePoint } from './CharacterPreview3D';
import {
    CHARACTER_DEFINITIONS,
    getCharacterDefinition,
    loadCharacterPose,
    saveCharacterPose,
    loadCharacterEmotes,
    saveCharacterEmotes,
    JOKER_EMOTES,
    type CharacterEmoteTracks,
    type CharacterDefinition
} from './characters';
import type { DoorData, MapCell } from '../jokerTypes';
import {
    Play, Pause, Square, RotateCcw, Lock, Unlock, Eye, Move, Volume2, VolumeX, Sparkles, User,
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Shield, Compass, Sliders, Settings, Crosshair, Plus, Trash2, Edit3, Palette, Camera, Scan, Maximize2, LogOut,
    Upload, Image as ImageIcon, RotateCw, Layers, Grid, FileUp, ChevronLeft, ChevronRight, Check, Copy, CheckCheck, Zap, Activity
} from 'lucide-react';

export const CHARACTER_OPTIONS = CHARACTER_DEFINITIONS;

export interface RoomThemeOption {
    id: string;
    name: string;
    imageUrl: string;
    subtitle: string;
    badge: string;
    borderColor: string;
    bgPreview: string;
    accentColor: string;
}

export const ROOM_THEME_OPTIONS: RoomThemeOption[] = [
    {
        id: 'Blue',
        name: 'Blue',
        imageUrl: '/Color/Blue.jpg',
        subtitle: 'Blue Joker Theme Wallpaper On All 4 Walls, Floor & Ceiling',
        badge: 'BLUE ROOM',
        borderColor: 'border-blue-500',
        bgPreview: 'from-blue-900 via-indigo-950 to-slate-900',
        accentColor: 'text-blue-400'
    },
    {
        id: 'green',
        name: 'green',
        imageUrl: '/Color/green.jpg',
        subtitle: 'Green Joker Card Artwork On All 4 Walls, Floor & Ceiling',
        badge: 'GREEN ROOM',
        borderColor: 'border-emerald-500',
        bgPreview: 'from-emerald-900 via-teal-950 to-slate-900',
        accentColor: 'text-emerald-400'
    },
    {
        id: 'Red',
        name: 'Red',
        imageUrl: '/Color/Red.jpg',
        subtitle: 'Red Joker Card Artwork On All 4 Walls, Floor & Ceiling',
        badge: 'RED ROOM',
        borderColor: 'border-rose-500',
        bgPreview: 'from-rose-900 via-red-950 to-slate-900',
        accentColor: 'text-rose-400'
    },
    {
        id: 'White',
        name: 'White',
        imageUrl: '/Color/White.jpg',
        subtitle: 'White Joker Card Artwork On All 4 Walls, Floor & Ceiling',
        badge: 'WHITE ROOM',
        borderColor: 'border-slate-300',
        bgPreview: 'from-slate-200 via-slate-400 to-slate-600',
        accentColor: 'text-slate-200'
    },
    {
        id: 'Yellow',
        name: 'Yellow',
        imageUrl: '/Color/Yellow 2.jpg',
        subtitle: 'Yellow Joker Card Artwork On All 4 Walls, Floor & Ceiling',
        badge: 'YELLOW ROOM',
        borderColor: 'border-amber-500',
        bgPreview: 'from-amber-900 via-yellow-950 to-slate-900',
        accentColor: 'text-amber-400'
    },
    {
        id: 'Plain White',
        name: 'Plain White',
        imageUrl: '',
        subtitle: 'Pure Solid Clean White (#ffffff) On All 4 Walls, Floor & Ceiling',
        badge: 'PLAIN WHITE',
        borderColor: 'border-slate-200',
        bgPreview: 'from-slate-100 via-slate-200 to-white',
        accentColor: 'text-white'
    }
];

export const THEME_DEFAULTS: Record<string, {
    wallRotation: number;
    floorColor: string;
    ceilingColor: string;
    useFloorTexture: boolean;
    useCeilingTexture: boolean;
}> = {
    'Blue': {
        wallRotation: 90,
        floorColor: '#241830',
        ceilingColor: '#241830',
        useFloorTexture: false,
        useCeilingTexture: false
    },
    'green': {
        wallRotation: 0,
        floorColor: '#0C1F00',
        ceilingColor: '#0C1F00',
        useFloorTexture: false,
        useCeilingTexture: false
    },
    'Red': {
        wallRotation: 90,
        floorColor: '#460735',
        ceilingColor: '#460735',
        useFloorTexture: false,
        useCeilingTexture: false
    },
    'White': {
        wallRotation: 90,
        floorColor: '#BFBFBF',
        ceilingColor: '#BFBFBF',
        useFloorTexture: false,
        useCeilingTexture: false
    },
    'Yellow': {
        wallRotation: 0,
        floorColor: '#5F5D21',
        ceilingColor: '#5F5D21',
        useFloorTexture: false,
        useCeilingTexture: false
    },
    'Yellow 2': {
        wallRotation: 0,
        floorColor: '#5F5D21',
        ceilingColor: '#5F5D21',
        useFloorTexture: false,
        useCeilingTexture: false
    },
    'Plain White': {
        wallRotation: 0,
        floorColor: '#ffffff',
        ceilingColor: '#ffffff',
        useFloorTexture: false,
        useCeilingTexture: false
    },
    'white_room': {
        wallRotation: 0,
        floorColor: '#ffffff',
        ceilingColor: '#ffffff',
        useFloorTexture: false,
        useCeilingTexture: false
    }
};

export const SURFACE_COLOR_PRESETS = [
    { label: 'Blue Deep', color: '#241830' },
    { label: 'Green Deep', color: '#0c1f00' },
    { label: 'Red Deep', color: '#460735' },
    { label: 'White Silver', color: '#bfbfbf' },
    { label: 'Yellow Olive', color: '#5f5d21' },
    { label: 'Joker Toxic', color: '#052e16' },
    { label: 'Deep Emerald', color: '#064e3b' },
    { label: 'Neon Green', color: '#15803d' },
    { label: 'Dark Obsidian', color: '#0b1120' },
    { label: 'Midnight Blue', color: '#020617' },
    { label: 'Cyber Teal', color: '#042f2e' },
    { label: 'Clean White', color: '#ffffff' }
];

export const DEFAULT_EMOTE_TRACKS: Record<string, KeyframePoint[]> = JOKER_EMOTES;

export const EMOTE_KEYFRAMES = {
    walk: {
        title: 'WALK STRIDE CYCLE',
        from: {
            title: 'FROM: LEFT STRIDE PLANT',
            la: { x: 0, y: 0, z: -23 },
            le: { x: 0, y: 0, z: -11 },
            ra: { x: 0, y: 0, z: 4 },
            re: { x: 0, y: 0, z: -19 },
            ll: { x: 0, y: 0, z: -1 },
            lk: { x: 0, y: 0, z: -41 },
            rl: { x: 0, y: 0, z: -39 },
            rk: { x: 0, y: 0, z: -34 }
        },
        to: {
            title: 'TO: RIGHT STRIDE PEAK',
            la: { x: 0, y: 0, z: 4 },
            le: { x: 0, y: 0, z: -19 },
            ra: { x: 0, y: 0, z: -23 },
            re: { x: 0, y: 0, z: -11 },
            ll: { x: 0, y: 0, z: -52 },
            lk: { x: 0, y: 0, z: -30 },
            rl: { x: 0, y: 0, z: 12 },
            rk: { x: 0, y: 0, z: -45 }
        }
    },
    door: {
        title: 'DOOR PULL EMOTE',
        from: {
            title: 'FROM: REACH HANDLE',
            la: { x: 0, y: 0, z: 0 },
            ra: { x: -83, y: 0, z: 5 },
            ll: { x: 0, y: 0, z: 0 },
            rl: { x: 0, y: 0, z: 0 }
        },
        to: {
            title: 'TO: PULL OPEN LEVERAGE',
            la: { x: 0, y: 0, z: 0 },
            ra: { x: -18, y: 20, z: 10 },
            ll: { x: -5, y: 0, z: 0 },
            rl: { x: 5, y: 0, z: 0 }
        }
    },
    scanner: {
        title: 'SCANNER TOUCH EMOTE',
        from: {
            title: 'FROM: FINGER HOVER',
            la: { x: 0, y: 0, z: 0 },
            ra: { x: -50, y: 0, z: 0 },
            ll: { x: 0, y: 0, z: 0 },
            rl: { x: 0, y: 0, z: 0 }
        },
        to: {
            title: 'TO: TOUCH SENSOR',
            la: { x: 0, y: 0, z: 0 },
            ra: { x: -70, y: 0, z: 0 },
            ll: { x: 0, y: 0, z: 0 },
            rl: { x: 0, y: 0, z: 0 }
        }
    },
    jump: {
        title: 'JUMP & IMPACT BOUNCE',
        from: {
            title: 'FROM: AIRBORNE PEAK',
            la: { x: -30, y: 0, z: 0 },
            ra: { x: -30, y: 0, z: 0 },
            ll: { x: 35, y: 0, z: 0 },
            rl: { x: 35, y: 0, z: 0 }
        },
        to: {
            title: 'TO: IMPACT LANDING',
            la: { x: 10, y: 0, z: 0 },
            ra: { x: 10, y: 0, z: 0 },
            ll: { x: -15, y: 0, z: 0 },
            rl: { x: -15, y: 0, z: 0 }
        }
    }
};

const DEFAULT_CAMERA_SETTINGS = {
    distance: 3.25,
    height: 2.75,
    pitch: 0.01,
    fov: 66
};

const DEFAULT_SCANNER_SETTINGS = {
    posX: 0.70,
    posY: 2.70,
    posZ: 0.14,
    scale: 1.60
};

// ============================================================================
// MAIN TEST LAB COMPONENT WITH SEPARATE LEFT/RIGHT ARM & LEG 3-AXIS CONTROLS
// ROUTE: /home/card/joker/testing
// ============================================================================
export const Joker3DTestRoom: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [doorsState, setDoorsState] = useState<{ [key: string]: boolean }>({
        north: false,
        south: false,
        east: false,
        west: false
    });
    const [cameraViewMode, setCameraViewMode] = useState<'tps' | 'fps'>('tps');
    const [showSettingsSidebar, setShowSettingsSidebar] = useState(true);
    const [settingsTab, setSettingsTab] = useState<'all' | 'corridor' | 'glass' | 'wall' | 'environment' | 'camera' | 'scanner' | 'limbs'>('corridor');

    // Live Corridor & Wall Opening Size Settings (Width, Height, Wallpaper Scaling, Corner Edge Cut)
    const [corridorSettings, setCorridorSettings] = useState({
        corridorWidth: 4.15,
        corridorHeight: 4.60,
        cornerEdgeCut: 0.55,
        wallScaleNorth: 1.0,
        wallScaleSides: 1.0
    });
    const corridorSettingsRef = useRef(corridorSettings);

    const initialSavedTheme = typeof window !== 'undefined' ? localStorage.getItem('joker_room_theme') : null;
    const defaultTheme = ROOM_THEME_OPTIONS.some(t => t.id === initialSavedTheme) ? (initialSavedTheme as string) : 'green';
    const activeThemeConfig = THEME_DEFAULTS[defaultTheme] || THEME_DEFAULTS['green'];
    const activeThemeOption = ROOM_THEME_OPTIONS.find(t => t.id === defaultTheme) || ROOM_THEME_OPTIONS[1];

    const isPlainWhiteTheme = (defaultTheme === 'Plain White' || defaultTheme === 'white_room' || !activeThemeOption.imageUrl);

    // Wall Material & Texture Customization Settings
    const [wallSettings, setWallSettings] = useState<EnvironmentSurfaceSettings>({
        useTexture: !isPlainWhiteTheme,
        imageUrl: isPlainWhiteTheme ? '' : activeThemeOption.imageUrl,
        color: '#ffffff',
        repeatX: 1.0,
        repeatY: 1.0,
        offsetX: 0.0,
        offsetY: 0.0,
        rotation: activeThemeConfig.wallRotation,
        wrapMode: 'repeat'
    });

    // Floor & Ceiling (Top) Material & Texture Customization Settings
    const [floorSettings, setFloorSettings] = useState<EnvironmentSurfaceSettings>({
        useTexture: activeThemeConfig.useFloorTexture,
        imageUrl: activeThemeOption.imageUrl,
        color: activeThemeConfig.floorColor,
        repeatX: 1.0,
        repeatY: 1.1,
        offsetX: 0.0,
        offsetY: 0.0,
        rotation: 0,
        wrapMode: 'repeat'
    });

    const [ceilingSettings, setCeilingSettings] = useState<EnvironmentSurfaceSettings>({
        useTexture: activeThemeConfig.useCeilingTexture,
        imageUrl: activeThemeOption.imageUrl,
        color: activeThemeConfig.ceilingColor,
        repeatX: 1.0,
        repeatY: 1.0,
        offsetX: 0.0,
        offsetY: 0.0,
        rotation: 0,
        wrapMode: 'repeat'
    });

    // Freeze & Pick 3D Part Mode
    const [isFreezePickerActive, setIsFreezePickerActive] = useState(false);
    const [selectedMeshName, setSelectedMeshName] = useState<string | null>(null);

    // Character Selector Modal State
    const [showCharacterModal, setShowCharacterModal] = useState(false);
    const initialSavedModel = typeof window !== 'undefined' ? localStorage.getItem('joker_equipped_character') : null;
    const initialIndex = CHARACTER_OPTIONS.findIndex(c => c.modelUrl === initialSavedModel);
    const defaultIndex = initialIndex >= 0 ? initialIndex : 5; // Default to Joker (Arkham Origins) index 5
    const [selectedCharIndex, setSelectedCharIndex] = useState(defaultIndex);
    const [activeCharModelUrl, setActiveCharModelUrl] = useState(initialSavedModel || CHARACTER_OPTIONS[defaultIndex]?.modelUrl || '/joker_batman_arkham_origins.glb');

    // Live Pose Settings State loaded from character folder / saved storage
    const [poseSettings, setPoseSettings] = useState<CharacterPoseSettings>(() => {
        return loadCharacterPose(initialSavedModel || CHARACTER_OPTIONS[defaultIndex]?.modelUrl);
    });

    // Live Camera Controls State (Distance, Height, Pitch, FOV)
    const [cameraSettings, setCameraSettings] = useState({ ...DEFAULT_CAMERA_SETTINGS });
    const cameraSettingsRef = useRef(cameraSettings);

    // Live Scanner Controls State (Position X, Y, Z & Scale)
    const [scannerSettings, setScannerSettings] = useState({ ...DEFAULT_SCANNER_SETTINGS });
    const scannerSettingsRef = useRef(scannerSettings);

    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

    // Custom Parts List State
    const [customParts, setCustomParts] = useState<CustomPartTransform[]>([]);

    // Door Glass Customization Settings (Live Color & Transparency) - initialized to match room floor
    const [glassSettings, setGlassSettings] = useState({
        color: activeThemeConfig.floorColor,
        opacity: 1.0,
        transmission: 0.40,
        roughness: 0.0,
        metalness: 0.1
    });

    // Biometric Face Scan & 5-Second Countdown State
    const [scanInfo, setScanInfo] = useState<{
        active: boolean;
        stage: 'scanning' | 'countdown' | 'opening';
        secondsLeft: number;
        doorDir: 'north' | 'south' | 'east' | 'west';
        doorLabel: string;
    } | null>(null);
    const scanInfoRef = useRef(scanInfo);
    const isScanningRef = useRef(false);

    // Ctrl Key Cursor Release State
    const [isCtrlHeld, setIsCtrlHeld] = useState(false);
    const isCtrlRef = useRef(false);

    // Cursor Lock to Tab State
    const [isCursorLocked, setIsCursorLocked] = useState(false);
    const isCursorLockedRef = useRef(false);


    // Custom confined cursor (canvas layer): tracks position within the canvas div
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [cursorInCanvas, setCursorInCanvas] = useState(false);
    const cursorInCanvasRef = useRef(false);

    // Camera Angles, Zoom-Out Interpolation & Heading (Default: dist=3.25, height=2.75, pitch=0.01)
    const cameraYaw = useRef<number>(0);
    const targetHeadingAngle = useRef<number>(0); // 0 = North, PI/2 = West, -PI/2 = East, PI = South
    const curHeadHeight = useRef<number>(2.75);
    const curDistance = useRef<number>(3.25);
    const curPitch = useRef<number>(0.01);

    // Character Preview Studio Controls State
    const [previewModelScale, setPreviewModelScale] = useState(() => poseSettings.modelScale || 1.73);
    const [previewAutoRotate, setPreviewAutoRotate] = useState(false);
    const [previewActiveEmote, setPreviewActiveEmote] = useState<'none' | 'walk' | 'door' | 'scanner' | 'jump'>('none');
    const [previewIsPaused, setPreviewIsPaused] = useState(false);
    const [previewScrubProgress, setPreviewScrubProgress] = useState(-1);
    const [liveCoords, setLiveCoords] = useState<LiveCoordsData>({
        la: { x: 0, y: 0, z: 0 },
        ra: { x: 0, y: 0, z: 0 },
        le: { x: 0, y: 0, z: 0 },
        re: { x: 0, y: 0, z: 0 },
        ll: { x: 0, y: 0, z: 0 },
        rl: { x: 0, y: 0, z: 0 },
        lk: { x: 0, y: 0, z: 0 },
        rk: { x: 0, y: 0, z: 0 },
        progress: 0,
        stageName: 'IDLE STAND'
    });
    const [copiedKeyframes, setCopiedKeyframes] = useState(false);

    // Custom Emote Keyframe Tracks & Studio State loaded per character
    const [customEmoteTracks, setCustomEmoteTracks] = useState<Record<string, KeyframePoint[]>>(() => {
        return loadCharacterEmotes(initialSavedModel || CHARACTER_OPTIONS[defaultIndex]?.modelUrl);
    });
    const [showKeyframeStudioModal, setShowKeyframeStudioModal] = useState(false);
    const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState(0);
    const [autoPropagateOffsets, setAutoPropagateOffsets] = useState(true);

    const handleUpdateKeyframeValue = (
        emoteKey: string,
        kfIndex: number,
        limbGroup: 'la' | 'ra' | 'le' | 're' | 'll' | 'rl' | 'lk' | 'rk',
        axis: 'x' | 'y' | 'z',
        newVal: number
    ) => {
        setCustomEmoteTracks(prev => {
            const track = [...(prev[emoteKey] || DEFAULT_EMOTE_TRACKS[emoteKey] || [])];
            if (!track[kfIndex]) return prev;

            const existingGroup = track[kfIndex][limbGroup] || { x: 0, y: 0, z: 0 };
            const oldVal = existingGroup[axis] ?? 0;
            const delta = newVal - oldVal;

            let updatedTrack: KeyframePoint[];
            if (autoPropagateOffsets) {
                // If auto-propagate is enabled, shift/replicate the delta to all other percentages so the entire motion curve shifts smoothly
                updatedTrack = track.map((kf, i) => {
                    const existing = kf[limbGroup] || { x: 0, y: 0, z: 0 };
                    if (i === kfIndex) {
                        return {
                            ...kf,
                            [limbGroup]: { ...existing, [axis]: newVal }
                        };
                    } else {
                        // Smooth proportional / direct replication across percentages
                        return {
                            ...kf,
                            [limbGroup]: { ...existing, [axis]: Math.round(existing[axis] + delta) }
                        };
                    }
                });
            } else {
                // Manual individual keyframe edit
                const existing = track[kfIndex][limbGroup] || { x: 0, y: 0, z: 0 };
                updatedTrack = track.map((kf, i) =>
                    i === kfIndex
                        ? { ...kf, [limbGroup]: { ...existing, [axis]: newVal } }
                        : kf
                );
            }

            const updatedEmotes = {
                ...prev,
                [emoteKey]: updatedTrack
            };

            const currentChar = CHARACTER_OPTIONS[selectedCharIndex];
            if (currentChar) {
                saveCharacterEmotes(currentChar.modelUrl, updatedEmotes);
            }
            if (characterRef.current && activeCharModelUrl === currentChar?.modelUrl) {
                characterRef.current.setEmoteTracks(updatedEmotes);
            }

            return updatedEmotes;
        });
    };

    // Emote Testing State in World Room
    const [isTestWalkActive, setIsTestWalkActive] = useState(false);
    const isTestWalkActiveRef = useRef(false);

    const handleToggleTestWalk = () => {
        setIsTestWalkActive(prev => {
            const next = !prev;
            isTestWalkActiveRef.current = next;
            if (characterRef.current) {
                characterRef.current.isWalking = next;
            }
            return next;
        });
    };


    // Room Theme Modal State
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [activeTheme, setActiveTheme] = useState<string>(defaultTheme);

    const handleSelectCharacter = (charIndex: number) => {
        const targetChar = CHARACTER_OPTIONS[charIndex];
        if (!targetChar) return;
        setSelectedCharIndex(charIndex);
        setActiveCharModelUrl(targetChar.modelUrl);
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem('joker_equipped_character', targetChar.modelUrl);
            }
        } catch {}

        const charPose = loadCharacterPose(targetChar.modelUrl);
        const charEmotes = loadCharacterEmotes(targetChar.modelUrl);
        setPoseSettings(charPose);
        setPreviewModelScale(charPose.modelScale || 0.85);
        setCustomEmoteTracks(charEmotes);

        if (characterRef.current) {
            characterRef.current.loadModel(targetChar.modelUrl, () => {
                characterRef.current?.updatePoseSettings(charPose);
                characterRef.current?.setEmoteTracks(charEmotes);
            });
        }
        setShowCharacterModal(false);
    };

    const handleSelectRoomTheme = (themeId: string) => {
        setActiveTheme(themeId);
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem('joker_room_theme', themeId);
            }
        } catch {}
        const theme = ROOM_THEME_OPTIONS.find(t => t.id === themeId);
        const imageUrl = theme?.imageUrl || (themeId === 'Plain White' || themeId === 'white_room' ? '' : `/Color/${themeId}.jpg`);
        if (hallwayRef.current) {
            hallwayRef.current.applyRoomTheme(themeId, imageUrl);
        }

        const config = THEME_DEFAULTS[themeId] || {
            wallRotation: 0,
            floorColor: '#ffffff',
            ceilingColor: '#ffffff',
            useFloorTexture: false,
            useCeilingTexture: false
        };

        const isPlainWhite = (themeId === 'Plain White' || themeId === 'white_room' || !imageUrl);

        setWallSettings(prev => ({
            ...prev,
            useTexture: !isPlainWhite,
            imageUrl: isPlainWhite ? '' : imageUrl,
            color: '#ffffff',
            rotation: config.wallRotation,
            repeatX: 1.0,
            repeatY: 1.0,
            offsetX: 0.0,
            offsetY: 0.0
        }));

        setFloorSettings(prev => ({
            ...prev,
            useTexture: config.useFloorTexture,
            color: config.floorColor,
            imageUrl: isPlainWhite ? '' : imageUrl,
            repeatX: 1.0,
            repeatY: 1.1,
            offsetX: 0.0,
            offsetY: 0.0,
            rotation: 0
        }));

        setCeilingSettings(prev => ({
            ...prev,
            useTexture: config.useCeilingTexture,
            color: config.ceilingColor,
            imageUrl: isPlainWhite ? '' : imageUrl,
            repeatX: 1.0,
            repeatY: 1.0,
            offsetX: 0.0,
            offsetY: 0.0,
            rotation: 0
        }));

        setGlassSettings(prev => ({
            ...prev,
            color: config.floorColor
        }));

        doorSystemRef.current?.updateDoorThemeColors(config.floorColor);

        setShowThemeModal(false);
    };

    // Wall, Floor & Ceiling File Input Refs & Upload Handlers
    const wallFileInputRef = useRef<HTMLInputElement | null>(null);
    const floorFileInputRef = useRef<HTMLInputElement | null>(null);
    const ceilingFileInputRef = useRef<HTMLInputElement | null>(null);

    const handleWallFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setWallSettings(prev => ({
                    ...prev,
                    useTexture: true,
                    imageUrl: event.target!.result as string
                }));
            }
        };
        reader.readAsDataURL(file);
    };

    const handleFloorFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setFloorSettings(prev => ({
                    ...prev,
                    useTexture: true,
                    imageUrl: event.target!.result as string
                }));
            }
        };
        reader.readAsDataURL(file);
    };

    const handleCeilingFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setCeilingSettings(prev => ({
                    ...prev,
                    useTexture: true,
                    imageUrl: event.target!.result as string
                }));
            }
        };
        reader.readAsDataURL(file);
    };

    // FPS Pitch Camera State
    const fpsPitch = useRef<number>(0);
    const cameraViewModeRef = useRef<'tps' | 'fps'>(cameraViewMode);

    // Mobile Auto-Landscape Rotated Studio View & Touch Detection
    const [isMobilePortrait, setIsMobilePortrait] = useState(false);
    const [enableMobileLandscape, setEnableMobileLandscape] = useState(true);
    const [isTouchMobile, setIsTouchMobile] = useState(false);

    useEffect(() => {
        const checkOrientation = () => {
            const isPortrait = window.innerWidth < window.innerHeight && window.innerWidth < 850;
            const isTouch = (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth < 1024);
            setIsMobilePortrait(isPortrait);
            setIsTouchMobile(isPortrait || isTouch);
        };
        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);
        return () => {
            window.removeEventListener('resize', checkOrientation);
            window.removeEventListener('orientationchange', checkOrientation);
        };
    }, []);

    // Trigger canvas resize recalculation when switching between portrait & mini-laptop landscape
    useEffect(() => {
        const timer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 50);
        return () => clearTimeout(timer);
    }, [enableMobileLandscape, isMobilePortrait]);

    useEffect(() => {
        cameraViewModeRef.current = cameraViewMode;
    }, [cameraViewMode]);

    const hallwayRef = useRef<DungeonHallway | null>(null);
    const doorSystemRef = useRef<TestDoorSystem | null>(null);
    const playerControllerRef = useRef<PlayerController | null>(null);
    const characterRef = useRef<Stylized3DCharacter | null>(null);

    const moveInput = useRef({ forward: false, backward: false, left: false, right: false });

    // Mobile Virtual Joystick & Touch Look Controls
    const joystickTouchId = useRef<number | null>(null);
    const joystickOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const joystickVector = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const lookTouchId = useRef<number | null>(null);
    const lookPrevPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const triggerDoorScanRef = useRef<(forcedDir?: 'north' | 'south' | 'east' | 'west') => void>(() => { });
    const [nearDoor, setNearDoor] = useState<{ direction: 'north' | 'south' | 'east' | 'west'; label: string; isSelected: boolean } | null>(null);
    const nearDoorRef = useRef<{ direction: 'north' | 'south' | 'east' | 'west'; label: string; isSelected: boolean } | null>(null);

    const [joystickUI, setJoystickUI] = useState<{ active: boolean; cx: number; cy: number }>({
        active: false, cx: 0, cy: 0
    });
    const [isInfoCollapsed, setIsInfoCollapsed] = useState(true);

    const isAutoWalkingRef = useRef<boolean>(false);

    // Smoothly walk character to destination using walking locomotion emote
    const walkCharacterTo = (
        targetX: number,
        targetZ: number,
        finalRotY: number,
        onComplete?: () => void
    ) => {
        const pc = playerControllerRef.current;
        const char = characterRef.current;
        if (!pc || !char) {
            onComplete?.();
            return;
        }

        const startX = pc.position.x;
        const startZ = pc.position.z;
        const dx = targetX - startX;
        const dz = targetZ - startZ;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.08) {
            isAutoWalkingRef.current = false;
            char.isWalking = false;
            char.targetRotationY = finalRotY;
            targetHeadingAngle.current = finalRotY;
            onComplete?.();
            return;
        }

        // Steer heading towards destination while walking
        const walkHeading = Math.atan2(-dx, -dz);
        char.targetRotationY = walkHeading;
        targetHeadingAngle.current = walkHeading;
        isAutoWalkingRef.current = true;
        char.isWalking = true;

        // Realistic walking speed (~2.2 m/s), bounded between 0.6s and 2.5s
        const duration = Math.max(0.6, Math.min(2.5, dist / 2.2));

        gsap.killTweensOf(pc.position);
        gsap.to(pc.position, {
            x: targetX,
            z: targetZ,
            duration,
            ease: 'linear',
            onUpdate: () => {
                isAutoWalkingRef.current = true;
                if (characterRef.current) {
                    characterRef.current.isWalking = true;
                    characterRef.current.position.copy(pc.position);
                }
            },
            onComplete: () => {
                isAutoWalkingRef.current = false;
                if (characterRef.current) {
                    characterRef.current.isWalking = false;
                    characterRef.current.targetRotationY = finalRotY;
                    targetHeadingAngle.current = finalRotY;
                }
                onComplete?.();
            }
        });
    };

    // Trigger Door Pull Emote: walks character directly in front of closest door and pulls handle
    const handleTriggerDoorEmote = () => {
        if (!characterRef.current || !playerControllerRef.current) return;
        const pos = playerControllerRef.current.position;
        const wallDist = 8.0;
        const doorStandDist = 1.30;
        const doors = [
            { dir: 'north' as const, x: -0.2, z: -wallDist + doorStandDist, rotY: 0 },
            { dir: 'south' as const, x: 0.2, z: wallDist - doorStandDist, rotY: Math.PI },
            { dir: 'east' as const, x: wallDist - doorStandDist, z: -0.2, rotY: -Math.PI / 2 },
            { dir: 'west' as const, x: -wallDist + doorStandDist, z: 0.2, rotY: Math.PI / 2 },
        ];

        let target = doors[0];
        let minDist = Infinity;
        for (const d of doors) {
            const dist = Math.hypot(pos.x - d.x, pos.z - d.z);
            if (dist < minDist) {
                minDist = dist;
                target = d;
            }
        }

        walkCharacterTo(target.x, target.z, target.rotY, () => {
            characterRef.current?.triggerScannerTouchEmote();
        });
    };

    // Sync pose settings with 3D character engine & persistence
    useEffect(() => {
        if (characterRef.current) {
            characterRef.current.updatePoseSettings(poseSettings);
        }
        const currentChar = CHARACTER_OPTIONS[selectedCharIndex];
        if (currentChar) {
            saveCharacterPose(currentChar.modelUrl, poseSettings);
        }
    }, [poseSettings, selectedCharIndex]);

    // Sync camera settings (FOV)
    useEffect(() => {
        cameraSettingsRef.current = cameraSettings;
        if (cameraRef.current) {
            cameraRef.current.fov = cameraSettings.fov;
            cameraRef.current.updateProjectionMatrix();
        }
    }, [cameraSettings]);

    // Sync scanner transform with door system
    useEffect(() => {
        scannerSettingsRef.current = scannerSettings;
        if (doorSystemRef.current) {
            doorSystemRef.current.setScannerTransform(
                scannerSettings.posX,
                scannerSettings.posY,
                scannerSettings.posZ,
                scannerSettings.scale
            );
        }
    }, [scannerSettings]);

    // Sync custom parts list with 3D character engine
    useEffect(() => {
        if (characterRef.current) {
            characterRef.current.customParts = customParts;
        }
    }, [customParts]);

    // Sync scanInfo ref
    useEffect(() => {
        scanInfoRef.current = scanInfo;
        if (!scanInfo?.active) {
            isScanningRef.current = false;
        }
    }, [scanInfo]);

    // Live sync corridor & wall opening dimensions and wallpaper scaling with 3D dungeon hallway
    useEffect(() => {
        corridorSettingsRef.current = corridorSettings;
        if (hallwayRef.current) {
            hallwayRef.current.updateCorridorAndWallSettings(corridorSettings);
        }
        if (doorSystemRef.current) {
            doorSystemRef.current.setDoorDimensions(corridorSettings.corridorWidth, corridorSettings.corridorHeight);
        }
    }, [corridorSettings]);

    // Sync door glass color & transparency with 3D door system
    useEffect(() => {
        if (doorSystemRef.current) {
            doorSystemRef.current.updateDoorGlass(glassSettings);
        }
    }, [glassSettings]);

    // Automatically match door glass color and door accents to floor color whenever floor color changes
    useEffect(() => {
        if (floorSettings.color) {
            const targetColor = floorSettings.color;
            setGlassSettings(prev => {
                if (prev.color.toLowerCase() === targetColor.toLowerCase()) return prev;
                return { ...prev, color: targetColor };
            });
            if (doorSystemRef.current) {
                doorSystemRef.current.updateDoorThemeColors(targetColor);
            }
        }
    }, [floorSettings.color]);

    // Live sync wall, floor & ceiling (top) texture & color settings with 3D dungeon hallway
    useEffect(() => {
        if (hallwayRef.current) {
            hallwayRef.current.updateWallSettings(wallSettings);
        }
    }, [wallSettings]);

    useEffect(() => {
        if (hallwayRef.current) {
            hallwayRef.current.updateFloorSettings(floorSettings);
        }
    }, [floorSettings]);

    useEffect(() => {
        if (hallwayRef.current) {
            hallwayRef.current.updateCeilingSettings(ceilingSettings);
        }
    }, [ceilingSettings]);

    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;

        // 1. THREE.JS INITIALIZATION
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf1f5f9);

        const camera = new THREE.PerspectiveCamera(
            cameraSettingsRef.current.fov,
            containerRef.current.clientWidth / containerRef.current.clientHeight,
            0.1,
            1000
        );
        camera.position.set(0, 2.4, 3.9);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
        renderer.localClippingEnabled = true;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.BasicShadowMap;
        renderer.toneMapping = THREE.LinearToneMapping;
        renderer.toneMappingExposure = 1.15;

        // Bright Studio / Hallway Lights for Full Character Color & Room Vibrancy
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
        scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.8);
        mainLight.position.set(4, 10, 4);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.set(1024, 1024);
        mainLight.shadow.bias = -0.0005;
        scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0xe0f2fe, 1.2);
        fillLight.position.set(-4, 8, -4);
        scene.add(fillLight);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 1.6);
        scene.add(hemiLight);

        // 2. DUNGEON HALLWAY & DOORS INITIALIZATION
        const dungeonHallway = new DungeonHallway(scene);
        hallwayRef.current = dungeonHallway;

        const soundEngine = new SoundEngine();
        const doorSystem = new TestDoorSystem(scene, soundEngine);
        doorSystem.currentFloorColor = activeThemeConfig.floorColor;
        doorSystemRef.current = doorSystem;

        const mockCell: any = {
            r: 3,
            c: 3,
            type: 'empty',
            doors: [
                { direction: 'up', cost: 10, cardType: 'standard' },
                { direction: 'down', cost: 10, cardType: 'standard' },
                { direction: 'left', cost: 10, cardType: 'standard' },
                { direction: 'right', cost: 10, cardType: 'special' }
            ]
        };

        const gridMatrix: any[][] = Array(7).fill(null).map((_, r) =>
            Array(7).fill(null).map((_, c) => ({
                r, c, type: 'empty',
                doors: [
                    { direction: 'up', cost: 10, cardType: 'standard' },
                    { direction: 'down', cost: 10, cardType: 'standard' },
                    { direction: 'left', cost: 10, cardType: 'standard' },
                    { direction: 'right', cost: 10, cardType: 'special' }
                ]
            }))
        );

        dungeonHallway.rebuildRoomForCell(mockCell, doorSystem as any, gridMatrix, false, undefined, true);
        const activeThemeOption = ROOM_THEME_OPTIONS.find(t => t.id === defaultTheme);
        dungeonHallway.applyRoomTheme(defaultTheme, activeThemeOption?.imageUrl);
        doorSystem.updateDoorGlass({ color: activeThemeConfig.floorColor });
        doorSystem.updateDoorThemeColors(activeThemeConfig.floorColor);

        // Apply custom scanner transform on initial build
        doorSystem.setScannerTransform(
            scannerSettingsRef.current.posX,
            scannerSettingsRef.current.posY,
            scannerSettingsRef.current.posZ,
            scannerSettingsRef.current.scale
        );

        // 3. INSTANTIATE HIGH QUALITY 3D CHARACTER
        const character = new Stylized3DCharacter(activeCharModelUrl);
        character.customParts = customParts;
        character.updatePoseSettings(poseSettings);
        character.setEmoteTracks(customEmoteTracks);
        scene.add(character.mesh);
        characterRef.current = character;

        // 4. INSTANTIATE PLAYER CONTROLLER
        const playerController = new PlayerController(camera, containerRef.current, soundEngine);
        playerController.isCameraLocked = true;
        playerControllerRef.current = playerController;

        // --- 360-DEGREE FREELOOK ORBIT DRAG & RAYCASTER PICKER HANDLER ---
        let isDragging = false;
        let prevPointerX = 0;
        let prevPointerY = 0;

        const raycaster = new THREE.Raycaster();
        const mouseVec = new THREE.Vector2();

        const handlePointerDown = (clientX: number, clientY: number) => {
            isDragging = true;
            prevPointerX = clientX;
            prevPointerY = clientY;

            // Freeze & Pick Mode
            if (isFreezePickerActive && containerRef.current && characterRef.current?.modelGroup) {
                const rect = containerRef.current.getBoundingClientRect();
                mouseVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
                mouseVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;

                raycaster.setFromCamera(mouseVec, camera);
                const intersects = raycaster.intersectObject(characterRef.current.modelGroup, true);

                if (intersects.length > 0) {
                    const hitMesh = intersects[0].object as THREE.Mesh;
                    const name = hitMesh.name || `BodyPart_${Date.now()}`;
                    setSelectedMeshName(name);

                    setCustomParts(prev => {
                        if (prev.some(p => p.meshName === name)) return prev;
                        const newPart: CustomPartTransform = {
                            id: `part_${Date.now()}`,
                            meshName: name,
                            displayName: name,
                            rotX: 0,
                            rotY: 0,
                            rotZ: 0,
                            posX: hitMesh.position.x,
                            posY: hitMesh.position.y,
                            posZ: hitMesh.position.z,
                        };
                        return [...prev, newPart];
                    });
                }
            }
        };

        const handlePointerMove = (e: MouseEvent, forceTrack: boolean = false) => {
            if (isFreezePickerActive || isCtrlRef.current || isScanningRef.current || scanInfoRef.current?.active) return;
            if (!isDragging && !forceTrack && !isCursorLockedRef.current) return;

            const isLocked = isCursorLockedRef.current;
            const deltaX = isLocked ? (e.movementX || 0) : (e.clientX - prevPointerX);
            const deltaY = isLocked ? (e.movementY || 0) : (e.clientY - prevPointerY);
            prevPointerX = e.clientX;
            prevPointerY = e.clientY;

            if (!isLocked && (Math.abs(deltaX) > 100 || Math.abs(deltaY) > 100)) return; // Ignore large cursor leaps when not locked

            const sensitivity = isLocked ? 0.0035 : 0.0055;

            if (cameraViewModeRef.current === 'fps') {
                targetHeadingAngle.current -= deltaX * sensitivity;
                fpsPitch.current = Math.max(-0.7, Math.min(0.7, fpsPitch.current - deltaY * (sensitivity * 0.75)));
            } else {
                // TPS Mode: Cursor smoothly steers character heading and camera yaw
                targetHeadingAngle.current -= deltaX * sensitivity;
            }
        };

        const handlePointerUp = () => { isDragging = false; };

        const dom = containerRef.current;

        let pointerDownPos = { x: 0, y: 0 };
        let pointerDownTime = 0;

        const onMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('.sidebar-panel') || target.closest('button') || target.closest('input') || target.closest('.interactive-ui') || target.closest('a')) {
                return;
            }
            pointerDownPos = { x: e.clientX, y: e.clientY };
            pointerDownTime = performance.now();
            handlePointerDown(e.clientX, e.clientY);

            // Trap / lock cursor strictly inside this browser tab unless Ctrl is held
            if (!isCtrlRef.current && !document.pointerLockElement && dom) {
                try {
                    dom.requestPointerLock();
                } catch {}
            }
        };
        const onMouseMove = (e: MouseEvent) => {
            if (isCtrlRef.current || isScanningRef.current || scanInfoRef.current?.active) return;
            const target = e.target as HTMLElement;
            if (target.closest('.sidebar-panel') || target.closest('button') || target.closest('input')) return;
            handlePointerMove(e, true);
        };
        const onMouseUp = (e: MouseEvent) => {
            handlePointerUp();
            const clickDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
            const clickDuration = performance.now() - pointerDownTime;

            // If it was a quick click without dragging and not in freeze picker mode
            if (clickDist < 8 && clickDuration < 350 && !isFreezePickerActive && containerRef.current && doorSystemRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                raycaster.setFromCamera(mouseVec, camera);

                for (const d of doorSystemRef.current.doors) {
                    const hits = raycaster.intersectObject(d.doorLocationGroup, true);
                    if (hits.length > 0) {
                        doorSystemRef.current.setDoorSelected(d.direction);
                        triggerDoorScan(d.direction);
                        break;
                    }
                }
            }
        };

        const triggerDoorScan = (forcedDir?: 'north' | 'south' | 'east' | 'west') => {
            if (isScanningRef.current || scanInfoRef.current?.active) return;

            const pos = playerController.position;
            let nearDoorDir: 'north' | 'south' | 'east' | 'west' | null = forcedDir || null;
            let scanX = pos.x, scanZ = pos.z;
            let touchX = pos.x, touchZ = pos.z;
            let targetRotY = 0;
            let doorLabel = '';

            // Calculate exact world coordinates of scanner based on scannerSettings & dynamic corridor/door width
            const doorWidth = corridorSettingsRef.current?.corridorWidth ?? 4.15;
            const scOffset = doorWidth / 2 + (scannerSettingsRef.current?.posX ?? 0.70); // default (4.15 / 2) + 0.70 = 2.775m
            const wallDist = 8.0; // ROOM_SIZE / 2
            const faceScanStandDist = 1.35; // 1.35m away from wall directly in scanner beam
            const doorStandDist = 1.30; // directly in front of the door handle

            let doorX = 0;
            let doorZ = 0;

            if (!nearDoorDir) {
                if (pos.z < -1.5) {
                    nearDoorDir = 'north';
                } else if (pos.z > 1.5) {
                    nearDoorDir = 'south';
                } else if (pos.x > 1.5) {
                    nearDoorDir = 'east';
                } else if (pos.x < -1.5) {
                    nearDoorDir = 'west';
                } else {
                    const dists = [
                        { dir: 'north' as const, d: Math.abs(pos.z - (-wallDist)) },
                        { dir: 'south' as const, d: Math.abs(pos.z - wallDist) },
                        { dir: 'east' as const, d: Math.abs(pos.x - wallDist) },
                        { dir: 'west' as const, d: Math.abs(pos.x - (-wallDist)) }
                    ];
                    dists.sort((a, b) => a.d - b.d);
                    nearDoorDir = dists[0].dir;
                }
            }

            if (nearDoorDir === 'north') {
                scanX = scOffset; scanZ = -wallDist + faceScanStandDist;
                doorX = -0.2; doorZ = -wallDist + doorStandDist;
                targetRotY = 0;
                doorLabel = 'UP (NORTH) DOOR';
            } else if (nearDoorDir === 'south') {
                scanX = -scOffset; scanZ = wallDist - faceScanStandDist;
                doorX = 0.2; doorZ = wallDist - doorStandDist;
                targetRotY = Math.PI;
                doorLabel = 'DOWN (SOUTH) DOOR';
            } else if (nearDoorDir === 'east') {
                scanX = wallDist - faceScanStandDist; scanZ = scOffset;
                doorX = wallDist - doorStandDist; doorZ = -0.2;
                targetRotY = -Math.PI / 2;
                doorLabel = 'RIGHT (EAST) DOOR';
            } else if (nearDoorDir === 'west') {
                scanX = -wallDist + faceScanStandDist; scanZ = -scOffset;
                doorX = -wallDist + doorStandDist; doorZ = 0.2;
                targetRotY = Math.PI / 2;
                doorLabel = 'LEFT (WEST) DOOR';
            }

            if (nearDoorDir) {
                isScanningRef.current = true;
                doorSystem.setDoorSelected(nearDoorDir);
                // Clear any leftover movement keys/joystick immediately to freeze manual controls
                moveInput.current.forward = false;
                moveInput.current.backward = false;
                joystickVector.current = { x: 0, y: 0 };
                setJoystickUI({ active: false, cx: 0, cy: 0 });

                // STEP 1: Walk to face-scan position directly in front of the scanner with walking animation
                setScanInfo({ active: true, stage: 'scanning', secondsLeft: 5, doorDir: nearDoorDir, doorLabel });
                doorSystem.updateScannerStatus(nearDoorDir, 'SCANNING FACE...', 'scanning');

                walkCharacterTo(scanX, scanZ, targetRotY, () => {
                    // Added delay of 2 seconds before face-scan laser sweep begins
                    doorSystem.updateScannerStatus(nearDoorDir!, 'ALIGNING OPTICAL SENSOR (2s)...', 'scanning');

                    setTimeout(() => {
                        doorSystem.updateScannerStatus(nearDoorDir!, 'SCANNING FACE...', 'scanning');

                        // STEP 2: Face-scan laser sweep → scanner glows GREEN
                        doorSystem.triggerFaceScan(nearDoorDir!, () => {
                            // Green scanner glow on selected door
                            doorSystem.setScannerGlow(nearDoorDir!, 'green');
                            doorSystem.setDoorSelected(nearDoorDir!);
                            doorSystem.updateScannerStatus(nearDoorDir!, 'ACCESS GRANTED (5s)', 'granted');

                            // STEP 3: 5-second countdown
                            setScanInfo({ active: true, stage: 'countdown', secondsLeft: 5, doorDir: nearDoorDir!, doorLabel });

                            let remaining = 5;
                            const countInterval = setInterval(() => {
                                remaining -= 1;
                                if (remaining > 0) {
                                    setScanInfo({ active: true, stage: 'countdown', secondsLeft: remaining, doorDir: nearDoorDir!, doorLabel });
                                    doorSystem.updateScannerStatus(nearDoorDir!, `ACCESS GRANTED (${remaining}s)`, 'granted');
                                } else {
                                    clearInterval(countInterval);
                                    setScanInfo({ active: true, stage: 'opening', secondsLeft: 0, doorDir: nearDoorDir!, doorLabel });
                                    doorSystem.updateScannerStatus(nearDoorDir!, 'STATUS: UNLOCKED', 'open');

                                    // STEP 4: Character walks directly in front of the door with walking emote
                                    walkCharacterTo(doorX, doorZ, targetRotY, () => {
                                        // STEP 5: Perform SCANNER TOUCH EMOTE in front of the door
                                        if (characterRef.current) {
                                            characterRef.current.triggerScannerTouchEmote();
                                        }

                                        // STEP 6: Open door as biometric touch authenticates
                                        setTimeout(() => {
                                            doorSystem.openBoughtDoor(nearDoorDir!, false, false);
                                            setTimeout(() => {
                                                setScanInfo(null);
                                                isScanningRef.current = false;
                                                doorSystem.updateScannerStatus(nearDoorDir!, 'STATUS: UNLOCKED', 'open');
                                            }, 1500);
                                        }, 480);
                                    });
                                }
                            }, 1000);
                        });
                    }, 2000);
                });
            }
        };
        triggerDoorScanRef.current = triggerDoorScan;

        const onTouchStart = (e: TouchEvent) => {
            if (isCtrlRef.current || isFreezePickerActive || isScanningRef.current || scanInfoRef.current?.active) return;
            if ((e.target as HTMLElement).closest('.sidebar-panel') || (e.target as HTMLElement).closest('button')) return;

            const rect = dom.getBoundingClientRect();

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const relX = touch.clientX - rect.left;
                const relY = touch.clientY - rect.top;

                // Left Side Touch -> Virtual Joystick
                if (relX < rect.width * 0.48 && joystickTouchId.current === null) {
                    joystickTouchId.current = touch.identifier;
                    joystickOrigin.current = { x: touch.clientX, y: touch.clientY };
                    joystickVector.current = { x: 0, y: 0 };
                    setJoystickUI({ active: true, cx: 0, cy: 0 });
                }
                // Right Side Touch -> Drag Camera / Look Direction
                else if (relX >= rect.width * 0.48 && lookTouchId.current === null) {
                    lookTouchId.current = touch.identifier;
                    lookPrevPos.current = { x: touch.clientX, y: touch.clientY };
                }
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            if (isScanningRef.current || scanInfoRef.current?.active) return;
            const rect = dom.getBoundingClientRect();

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];

                // Update Virtual Joystick Vector
                if (touch.identifier === joystickTouchId.current) {
                    const dx = touch.clientX - joystickOrigin.current.x;
                    const dy = touch.clientY - joystickOrigin.current.y;
                    const dist = Math.hypot(dx, dy);
                    const maxR = 36;
                    const angle = Math.atan2(dy, dx);
                    const clampedDist = Math.min(dist, maxR);

                    const clampedX = Math.cos(angle) * clampedDist;
                    const clampedY = Math.sin(angle) * clampedDist;

                    joystickVector.current = {
                        x: clampedX / maxR,
                        y: -clampedY / maxR // Upward drag = forward movement
                    };

                    setJoystickUI({
                        active: true,
                        cx: clampedX,
                        cy: clampedY
                    });
                }
                // Update Look / Heading Direction
                else if (touch.identifier === lookTouchId.current) {
                    const deltaX = touch.clientX - lookPrevPos.current.x;
                    const deltaY = touch.clientY - lookPrevPos.current.y;
                    lookPrevPos.current = { x: touch.clientX, y: touch.clientY };

                    targetHeadingAngle.current += deltaX * 0.007;
                    curPitch.current = THREE.MathUtils.clamp(curPitch.current - deltaY * 0.004, -0.35, 0.55);
                }
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === joystickTouchId.current) {
                    joystickTouchId.current = null;
                    joystickVector.current = { x: 0, y: 0 };
                    setJoystickUI({ active: false, cx: 0, cy: 0 });
                }
                if (touch.identifier === lookTouchId.current) {
                    lookTouchId.current = null;
                }
            }
        };

        const onPointerLockChange = () => {
            const locked = document.pointerLockElement === dom || document.pointerLockElement === canvasRef.current;
            setIsCursorLocked(locked);
            isCursorLockedRef.current = locked;
        };
        document.addEventListener('pointerlockchange', onPointerLockChange);

        dom.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        dom.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('touchend', onTouchEnd);

        // Keyboard Listeners (Spacebar Door Biometric Scan -> 5s Countdown -> Knob Pull & Open)
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
                isCtrlRef.current = true;
                setIsCtrlHeld(true);
                // Immediately release pointer lock so cursor can freely leave the tab and interact with UI
                if (document.pointerLockElement) {
                    try {
                        document.exitPointerLock();
                    } catch {}
                }
            }

            if (isFreezePickerActive || isScanningRef.current || scanInfoRef.current?.active) return;
            if (e.code === 'KeyW' || e.code === 'ArrowUp') moveInput.current.forward = true;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') moveInput.current.backward = true;

            // 90-degree turn left/right (disabled in FPS view mode so mouse steers heading)
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
                if (cameraViewModeRef.current !== 'fps') {
                    targetHeadingAngle.current += Math.PI / 2; // Turn 90 deg Left
                }
            }
            if (e.code === 'KeyD' || e.code === 'ArrowRight') {
                if (cameraViewModeRef.current !== 'fps') {
                    targetHeadingAngle.current -= Math.PI / 2; // Turn 90 deg Right
                }
            }

            if (e.code === 'Space') {
                e.preventDefault();
                triggerDoorScan();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
                isCtrlRef.current = false;
                setIsCtrlHeld(false);
            }
            if (isScanningRef.current || scanInfoRef.current?.active) return;
            if (e.code === 'KeyW' || e.code === 'ArrowUp') moveInput.current.forward = false;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') moveInput.current.backward = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // 5. ANIMATION & RENDER LOOP
        let animationFrameId: number;
        let lastTime = performance.now();
        const clock = new THREE.Clock();

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);

            const currentTime = performance.now();
            const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
            lastTime = currentTime;


            // Character movement (Keyboard + Touch Virtual Joystick)
            if (!isFreezePickerActive) {
                const isScanningActive = isScanningRef.current || scanInfoRef.current?.active;

                let isMoving = false;
                if (!isScanningActive) {
                    let keyFwd = 0;
                    if (moveInput.current.forward) keyFwd += 1;
                    if (moveInput.current.backward) keyFwd -= 1;

                    const jY = joystickVector.current.y;
                    const jX = joystickVector.current.x;

                    const totalFwd = Math.max(-1, Math.min(1, keyFwd + jY));
                    const totalStrafe = jX;

                    isMoving = Math.abs(totalFwd) > 0.05 || Math.abs(totalStrafe) > 0.05;

                    if (isMoving) {
                        const fwdX = -Math.sin(targetHeadingAngle.current);
                        const fwdZ = -Math.cos(targetHeadingAngle.current);
                        const rightX = Math.cos(targetHeadingAngle.current);
                        const rightZ = -Math.sin(targetHeadingAngle.current);

                        const speed = 4.5;
                        const nextX = playerController.position.x + (fwdX * totalFwd + rightX * totalStrafe) * speed * delta;
                        const nextZ = playerController.position.z + (fwdZ * totalFwd + rightZ * totalStrafe) * speed * delta;
                        playerController.position.x = Math.max(-7.4, Math.min(7.4, nextX));
                        playerController.position.z = Math.max(-7.4, Math.min(7.4, nextZ));
                    }
                } else {
                    moveInput.current.forward = false;
                    moveInput.current.backward = false;
                    joystickVector.current = { x: 0, y: 0 };
                }

                if (characterRef.current) {
                    if (!isScanningActive && !isAutoWalkingRef.current) {
                        characterRef.current.targetRotationY = targetHeadingAngle.current;
                    }
                    characterRef.current.position.copy(playerController.position);
                    const shouldWalk = isMoving || isAutoWalkingRef.current || isTestWalkActiveRef.current;
                    characterRef.current.isWalking = shouldWalk;
                    characterRef.current.update(delta, shouldWalk);
                }

                if (doorSystem.centerMesh) {
                    doorSystem.centerMesh.rotation.y += delta * 1.2;
                }

                // Check proximity to any of the 4 doors
                const pX = playerController.position.x;
                const pZ = playerController.position.z;
                let currentNearDir: 'north' | 'south' | 'east' | 'west' | null = null;
                let currentDoorLabel = '';

                if (pZ < -2.2) {
                    currentNearDir = 'north';
                    currentDoorLabel = 'UP (NORTH) DOOR';
                } else if (pZ > 2.2) {
                    currentNearDir = 'south';
                    currentDoorLabel = 'DOWN (SOUTH) DOOR';
                } else if (pX < -2.2) {
                    currentNearDir = 'west';
                    currentDoorLabel = 'LEFT (WEST) DOOR';
                } else if (pX > 2.2) {
                    currentNearDir = 'east';
                    currentDoorLabel = 'RIGHT (EAST) DOOR';
                }

                if (currentNearDir !== nearDoorRef.current?.direction) {
                    if (currentNearDir) {
                        const isSel = doorSystem.doors.find(d => d.direction === currentNearDir)?.isSelected ?? false;
                        const newNear = { direction: currentNearDir, label: currentDoorLabel, isSelected: isSel };
                        nearDoorRef.current = newNear;
                        setNearDoor(newNear);
                    } else {
                        nearDoorRef.current = null;
                        setNearDoor(null);
                    }
                }
            } else if (characterRef.current) {
                characterRef.current.update(delta);
            }

            // --- MULTI-VIEW CAMERA RENDERING (TPS, FPS) WITH LIVE CAMERA CONTROLS ---
            const viewMode = cameraViewModeRef.current;
            const charPos = playerController.position;
            const isEmoteActive = characterRef.current && (characterRef.current.doorEmoteTimer > 0 || characterRef.current.scannerTouchTimer > 0);

            const wallMargin = 7.3;
            const ceilingMargin = 7.5;

            if (characterRef.current) {
                characterRef.current.mesh.visible = (viewMode !== 'fps');
            }

            if (viewMode === 'fps') {
                // --- FPS: FIRST PERSON VIEW WITH LIVE CAMERA CONTROLS ---
                const camConf = cameraSettingsRef.current;
                const eyeHeight = camConf.height;
                const totalPitch = fpsPitch.current + camConf.pitch;

                const camX = charPos.x - Math.sin(targetHeadingAngle.current) * 0.25;
                const camY = charPos.y + eyeHeight;
                const camZ = charPos.z - Math.cos(targetHeadingAngle.current) * 0.25;

                const lookDistance = 6.0;
                const lookX = charPos.x - Math.sin(targetHeadingAngle.current) * Math.cos(totalPitch) * lookDistance;
                const lookY = charPos.y + eyeHeight + Math.sin(totalPitch) * lookDistance;
                const lookZ = charPos.z - Math.cos(targetHeadingAngle.current) * Math.cos(totalPitch) * lookDistance;

                camera.position.set(camX, camY, camZ);
                camera.lookAt(lookX, lookY, lookZ);
            } else {
                // --- TPS: THIRD PERSON VIEW (LIVE DISTANCE, HEIGHT, PITCH, FOV) ---
                if (characterRef.current) {
                    let diffAngle = targetHeadingAngle.current - cameraYaw.current;
                    while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
                    while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
                    cameraYaw.current += diffAngle * Math.min(1.0, delta * 7.0);
                }

                // Live dynamic camera controls
                const camConf = cameraSettingsRef.current;
                const targetHeadHeight = isEmoteActive ? (camConf.height + 0.15) : camConf.height;
                const targetDistance = isEmoteActive ? (camConf.distance + 0.30) : camConf.distance;
                const targetPitch = isEmoteActive ? (camConf.pitch + 0.04) : camConf.pitch;

                curHeadHeight.current = THREE.MathUtils.lerp(curHeadHeight.current, targetHeadHeight, Math.min(1.0, delta * 8.0));
                curDistance.current = THREE.MathUtils.lerp(curDistance.current, targetDistance, Math.min(1.0, delta * 8.0));
                curPitch.current = THREE.MathUtils.lerp(curPitch.current, targetPitch, Math.min(1.0, delta * 8.0));

                const dist = curDistance.current;
                const pitch = curPitch.current;
                const height = curHeadHeight.current;

                // Desired camera position in world space
                const desiredCamX = charPos.x + Math.sin(cameraYaw.current) * Math.cos(pitch) * dist;
                const desiredCamY = charPos.y + height + Math.sin(pitch) * dist;
                const desiredCamZ = charPos.z + Math.cos(cameraYaw.current) * Math.cos(pitch) * dist;

                // Smart Room Boundary Clamping (prevents camera clipping outside room without squashing into character)
                const maxRoomBound = 7.5;
                const minHeightBound = 0.5;
                const maxHeightBound = 7.5;

                const safeCamX = THREE.MathUtils.clamp(desiredCamX, -maxRoomBound, maxRoomBound);
                const safeCamZ = THREE.MathUtils.clamp(desiredCamZ, -maxRoomBound, maxRoomBound);
                let safeCamY = THREE.MathUtils.clamp(desiredCamY, minHeightBound, maxHeightBound);

                // If camera position is clamped near a wall, smoothly elevate to prevent character occlusion
                const isClampedX = Math.abs(safeCamX - desiredCamX) > 0.05;
                const isClampedZ = Math.abs(safeCamZ - desiredCamZ) > 0.05;
                if (isClampedX || isClampedZ) {
                    safeCamY = Math.min(maxHeightBound, safeCamY + 0.35);
                }

                // Look target tilted and positioned dynamically according to height and pitch
                const lookDistance = 5.0;
                const lookX = charPos.x - Math.sin(cameraYaw.current) * Math.cos(pitch) * lookDistance;
                const lookY = charPos.y + (height * 0.85) - Math.sin(pitch) * lookDistance;
                const lookZ = charPos.z - Math.cos(cameraYaw.current) * Math.cos(pitch) * lookDistance;

                camera.position.set(safeCamX, safeCamY, safeCamZ);
                camera.lookAt(lookX, lookY, lookZ);
            }

            // Update Spaceship Door Animation Mixers
            doorSystemRef.current?.update(delta);

            renderer.render(scene, camera);
        };

        animate();

        // 6. RESIZE HANDLER
        const handleResize = () => {
            if (!containerRef.current) return;
            camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationFrameId);
            document.removeEventListener('pointerlockchange', onPointerLockChange);
            if (document.pointerLockElement) {
                try {
                    document.exitPointerLock();
                } catch {}
            }
            dom.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            dom.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('resize', handleResize);
            renderer.dispose();
        };
    }, [cameraViewMode, isFreezePickerActive]);

    // Handle Door Open / Close Toggle
    const handleToggleDoor = (direction: 'north' | 'south' | 'east' | 'west') => {
        if (!doorSystemRef.current) return;
        const newStatus = !doorsState[direction];
        setDoorsState(prev => ({ ...prev, [direction]: newStatus }));

        if (newStatus) {
            doorSystemRef.current.setDoorSelected(direction);
        } else {
            const otherOpen = Object.entries(doorsState).find(([k, v]) => k !== direction && v);
            doorSystemRef.current.setDoorSelected(otherOpen ? (otherOpen[0] as any) : null);
        }

        const targetDoor = doorSystemRef.current.doors.find(d => d.direction === direction);
        if (targetDoor) {
            if (newStatus) {
                const wallDist = 8.0;
                const doorStandDist = 1.30;
                const doorCoords = {
                    north: { x: -0.2, z: -wallDist + doorStandDist, rotY: 0 },
                    south: { x: 0.2, z: wallDist - doorStandDist, rotY: Math.PI },
                    east: { x: wallDist - doorStandDist, z: -0.2, rotY: -Math.PI / 2 },
                    west: { x: -wallDist + doorStandDist, z: 0.2, rotY: Math.PI / 2 }
                }[direction];

                // Walk character in front of selected door with walking emote, then trigger scanner touch emote!
                walkCharacterTo(doorCoords.x, doorCoords.z, doorCoords.rotY, () => {
                    characterRef.current?.triggerScannerTouchEmote();
                    setTimeout(() => {
                        doorSystemRef.current?.openDoor(targetDoor);
                    }, 480);
                });
            } else {
                targetDoor.isOpen = false;
                doorSystemRef.current?.closeDoor(targetDoor);
                gsap.to(targetDoor.pivotGroup.rotation, { y: 0, duration: 1.0, ease: 'power2.out' });
            }
        }
    };

    return (
        <div
            className={`fixed inset-0 z-[1000] bg-white flex flex-col font-mono select-none overflow-hidden text-slate-900 ${isMobilePortrait ? 'mobile-portrait-rotated' : ''}`}
            style={
                isMobilePortrait
                    ? {
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vh',
                        height: '100vw',
                        transformOrigin: 'top left',
                        transform: 'rotate(90deg) translateY(-100%)',
                        overflow: 'hidden'
                    }
                    : undefined
            }
        >
            {/* TOP HUD BAR: COMPACT ICON BUTTONS ON MOBILE, FULL LABELS ON LAPTOP */}
            <div className="w-full bg-white/95 backdrop-blur-md border-b border-slate-300 px-2 sm:px-4 py-2 flex items-center justify-between gap-1.5 sm:gap-3 shadow-xs z-50 shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden shrink-0">
                    <Shield className="text-cyan-600 shrink-0" size={18} />
                    <span className="font-black text-[11px] sm:text-xs md:text-sm uppercase tracking-widest text-slate-900 hidden sm:inline truncate">
                        3D CHARACTER POSE STUDIO
                    </span>
                    <span className="bg-slate-900 text-cyan-400 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold hidden lg:inline">
                        {characterRef.current?.debugInfo || 'ACTIVE'}
                    </span>
                </div>

                {/* CONTROLS HUB */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    {/* DOOR TOGGLES (ICON ARROWS ON MOBILE, FULL LABELS ON LAPTOP) */}
                    <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 p-0.5 sm:p-1 rounded-lg border border-slate-300">
                        {(['north', 'south', 'east', 'west'] as const).map(dir => {
                            const iconArrow = dir === 'north' ? '▲' : dir === 'south' ? '▼' : dir === 'east' ? '▶' : '◀';
                            const shortLabel = dir === 'north' ? 'N' : dir === 'south' ? 'S' : dir === 'east' ? 'E' : 'W';
                            return (
                                <button
                                    key={dir}
                                    onClick={() => handleToggleDoor(dir)}
                                    title={`${dir.toUpperCase()} DOOR: ${doorsState[dir] ? 'OPEN' : 'CLOSE'}`}
                                    className={`px-1.5 py-1 sm:px-2.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-0.5 ${doorsState[dir]
                                        ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400'
                                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                                        }`}
                                >
                                    <span>{iconArrow}</span>
                                    <span className="md:hidden text-[8px]">{shortLabel}</span>
                                    <span className="hidden md:inline">{dir}: {doorsState[dir] ? 'OPEN' : 'CLOSE'}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* MOVE / WALK LOCOMOTION EMOTE BUTTON */}
                    <button
                        onClick={handleToggleTestWalk}
                        title={isTestWalkActive ? 'Stop Walk Motion' : 'Start Walk Motion Gait'}
                        className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${isTestWalkActive
                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 animate-pulse'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300'
                            }`}
                    >
                        <Move size={14} className="shrink-0" />
                        <span className="hidden md:inline">{isTestWalkActive ? 'WALKING...' : 'MOVE'}</span>
                    </button>

                    {/* DOOR INTERACTION EMOTE BUTTON */}
                    <button
                        onClick={handleTriggerDoorEmote}
                        title="Trigger Character Door Reach & Pull Emote"
                        className="px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ring-1 ring-amber-400/50"
                    >
                        <Lock size={14} className="shrink-0" />
                        <span className="hidden md:inline">DOOR EMOTE</span>
                    </button>

                    {/* ROOM THEME SELECTOR BUTTON */}
                    <button
                        onClick={() => setShowThemeModal(true)}
                        title={`Select Room Theme (Current: ${ROOM_THEME_OPTIONS.find(t => t.id === activeTheme)?.name || activeTheme})`}
                        className="px-2 sm:px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-600 text-white ring-1 ring-purple-400/50"
                    >
                        <Palette size={14} className="shrink-0" />
                        <span className="hidden md:inline">ROOM: {ROOM_THEME_OPTIONS.find(t => t.id === activeTheme)?.name || activeTheme}</span>
                    </button>

                    {/* CHARACTER SELECTOR BUTTON */}
                    <button
                        onClick={() => setShowCharacterModal(true)}
                        title="Select 3D Character (Arkham Origins vs Classic Joker)"
                        className="px-2 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ring-1 ring-purple-400/50"
                    >
                        <User size={14} className="shrink-0" />
                        <span className="hidden md:inline">CHARACTERS</span>
                    </button>

                    {/* WALL & CORRIDOR SIZE BUTTON */}
                    <button
                        onClick={() => {
                            setSettingsTab('corridor');
                            setShowSettingsSidebar(true);
                        }}
                        title="Edit Door Corridor & Wall Space Size"
                        className="px-2 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ring-1 ring-amber-400/50"
                    >
                        <Maximize2 size={14} className="shrink-0" />
                        <span className="hidden md:inline">WALL CORRIDOR</span>
                    </button>

                    {/* FREEZE & SELECT PART MODE BUTTON */}
                    <button
                        onClick={() => setIsFreezePickerActive(!isFreezePickerActive)}
                        title={isFreezePickerActive ? 'Exit Freeze Mode' : 'Freeze 3D Pose & Pick Mesh Part'}
                        className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${isFreezePickerActive
                            ? 'bg-rose-600 text-white border border-rose-400 animate-pulse'
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400'
                            }`}
                    >
                        <Crosshair size={14} className="shrink-0" />
                        <span className="hidden md:inline">{isFreezePickerActive ? 'PICK: ON' : 'FREEZE PART'}</span>
                    </button>

                    {/* SETTINGS SIDEBAR TOGGLE */}
                    <button
                        onClick={() => setShowSettingsSidebar(!showSettingsSidebar)}
                        title="Studio Appearance & Pose Settings"
                        className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${showSettingsSidebar
                            ? 'bg-slate-900 text-white border border-slate-700'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300'
                            }`}
                    >
                        <Settings size={14} className="shrink-0" />
                        <span className="hidden md:inline">SETTINGS</span>
                    </button>

                    {/* CAMERA VIEW MODE (TPS vs FPS) */}
                    <button
                        onClick={() => {
                            if (cameraViewMode === 'tps') setCameraViewMode('fps');
                            else setCameraViewMode('tps');
                        }}
                        title={`Camera View Mode: ${cameraViewMode.toUpperCase()}`}
                        className="px-2 sm:px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                        <Eye size={14} className="shrink-0" />
                        <span className="hidden md:inline">{cameraViewMode.toUpperCase()}</span>
                    </button>

                    {onClose && (
                        <button
                            onClick={onClose}
                            title="Exit 3D Lab"
                            className="px-2 sm:px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
                        >
                            <LogOut size={14} className="shrink-0" />
                            <span className="hidden md:inline">EXIT</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 3D CANVAS VIEWPORT */}
            <div ref={containerRef} className="w-full h-full relative cursor-default overflow-hidden" style={{ userSelect: 'none' }}>
                <canvas ref={canvasRef} className="w-full h-full block" />


                {/* PREMIUM SCI-FI MOBILE VIRTUAL JOYSTICK AT BOTTOM-LEFT (MOBILE / TOUCH ONLY) */}
                {isTouchMobile && (
                    <div
                        className="fixed bottom-6 left-6 z-40 w-28 h-28 rounded-full border border-cyan-400/40 bg-slate-950/70 backdrop-blur-xl flex items-center justify-center shadow-2xl pointer-events-none select-none"
                    >
                        {/* Outer Compass Chevrons */}
                        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-black text-cyan-400/70 select-none">▲</div>
                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[7px] font-black text-cyan-400/70 select-none">▼</div>
                        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[7px] font-black text-cyan-400/70 select-none">◀</div>
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[7px] font-black text-cyan-400/70 select-none">▶</div>

                        {/* Subtle Inner Ring Guide */}
                        <div className="w-20 h-20 rounded-full border border-dashed border-cyan-400/25 absolute pointer-events-none" />

                        {/* Center Draggable Knob */}
                        <div
                            className={`w-13 h-13 rounded-full border-2 border-cyan-300 shadow-xl pointer-events-none transition-transform duration-75 flex items-center justify-center ${joystickUI.active
                                ? 'bg-gradient-to-br from-cyan-500 via-indigo-600 to-slate-900 shadow-cyan-400/50 ring-4 ring-cyan-400/30'
                                : 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-950 shadow-black/80'
                                }`}
                            style={{
                                transform: `translate(${joystickUI.cx}px, ${joystickUI.cy}px)`
                            }}
                        >
                            {/* Inner Metallic Grip & Glowing LED Core */}
                            <div className="w-5.5 h-5.5 rounded-full bg-slate-900/90 border border-cyan-400/60 flex items-center justify-center shadow-inner">
                                <div className={`w-2 h-2 rounded-full ${joystickUI.active ? 'bg-cyan-300 shadow-sm shadow-cyan-300 animate-pulse' : 'bg-cyan-400/80'}`} />
                            </div>
                        </div>
                    </div>
                )}

                {/* NEAR DOOR ACTION ICON BUTTON (MOBILE / TOUCH ONLY — RIGHT SIDE) */}
                {isTouchMobile && nearDoor && !scanInfo?.active && (
                    <div className="fixed bottom-6 right-6 z-40 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
                        <button
                            onClick={() => {
                                if (doorSystemRef.current && nearDoor) {
                                    doorSystemRef.current.setDoorSelected(nearDoor.direction);
                                    setNearDoor(prev => prev ? { ...prev, isSelected: true } : null);
                                    triggerDoorScanRef.current();
                                }
                            }}
                            className={`w-16 h-16 rounded-full border-2 shadow-2xl flex flex-col items-center justify-center font-mono font-black backdrop-blur-xl active:scale-90 hover:scale-105 transition-all cursor-pointer ${nearDoor.isSelected
                                ? 'bg-gradient-to-br from-rose-600 via-rose-800 to-slate-950 border-rose-400 text-white shadow-rose-500/40 ring-4 ring-rose-500/20'
                                : 'bg-gradient-to-br from-cyan-500 via-indigo-600 to-slate-950 border-cyan-300 text-white shadow-cyan-500/40 ring-4 ring-cyan-400/20'
                                }`}
                            title={`Select & Open ${nearDoor.label}`}
                        >
                            <Sparkles size={20} className="animate-spin-slow text-white" />
                            <span className="text-[7px] uppercase font-black tracking-wider mt-0.5">
                                {nearDoor.isSelected ? 'OPEN' : 'SELECT'}
                            </span>
                        </button>
                    </div>
                )}

                {/* BIOMETRIC SCAN & 5-SECOND COUNTDOWN HOLOGRAPHIC OVERLAY */}
                {scanInfo?.active && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none animate-in fade-in zoom-in duration-300">
                        <div className={`px-5 py-2.5 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center gap-3 font-mono ${scanInfo.stage === 'scanning'
                            ? 'bg-cyan-950/90 border-cyan-500/60 text-cyan-300 shadow-cyan-500/20'
                            : scanInfo.stage === 'countdown'
                                ? 'bg-amber-950/90 border-amber-500/60 text-amber-300 shadow-amber-500/20'
                                : 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300 shadow-emerald-500/20'
                            }`}>
                            {scanInfo.stage === 'scanning' && (
                                <>
                                    <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 animate-ping" />
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400">
                                            [ BIOMETRIC FACE ID SCANNING ]
                                        </span>
                                        <span className="text-[9px] text-cyan-200/80 font-bold">
                                            Aligning with optical sensor at {scanInfo.doorLabel}...
                                        </span>
                                    </div>
                                </>
                            )}

                            {scanInfo.stage === 'countdown' && (
                                <>
                                    <div className="text-2xl font-black text-amber-400 font-mono animate-bounce">
                                        {scanInfo.secondsLeft}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-amber-300">
                                            FACE AUTHENTICATED // ACCESS GRANTED
                                        </span>
                                        <span className="text-[9px] text-amber-200/80 font-bold">
                                            Auto unlatching & pulling door in {scanInfo.secondsLeft}s...
                                        </span>
                                    </div>
                                </>
                            )}

                            {scanInfo.stage === 'opening' && (
                                <>
                                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                                            [ PULLING DOOR HANDLE OPEN ]
                                        </span>
                                        <span className="text-[9px] text-emerald-200/80 font-bold">
                                            Unlatching mechanical lock & opening pathway...
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* COMPACT COLLAPSIBLE INFO BOX */}
                <div className="absolute top-3 left-3 z-40 max-w-[220px] pointer-events-auto">
                    <button
                        onClick={() => setIsInfoCollapsed(!isInfoCollapsed)}
                        className="bg-white/95 border border-slate-300 px-2.5 py-1 rounded-lg backdrop-blur-md shadow-md text-slate-900 text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                        <Compass size={13} className="text-cyan-600" />
                        <span>CONTROLS</span>
                        <span className="text-[8px] bg-slate-200 text-slate-700 px-1 py-0.2 rounded font-mono">
                            {isInfoCollapsed ? 'INFO' : 'HIDE'}
                        </span>
                    </button>

                    {!isInfoCollapsed && (
                        <div className="mt-1.5 bg-white/95 border border-slate-300 p-2.5 rounded-xl backdrop-blur-md shadow-xl text-slate-800 space-y-1 text-[9px] font-bold leading-tight animate-in fade-in zoom-in-95 duration-150">
                            {isMobilePortrait || window.innerWidth < 768 ? (
                                <>
                                    <p>🕹️ <span className="text-cyan-700 font-black">Left Screen</span>: Drag joystick to walk & strafe.</p>
                                    <p>👆 <span className="text-indigo-700 font-black">Right Screen</span>: Drag finger to steer & look.</p>
                                    <p>🟢 <span className="text-emerald-700 font-black">[SCAN] Button</span>: Tap near scanner to open door.</p>
                                </>
                            ) : (
                                <>
                                    <p>• <span className="text-cyan-700 font-black">Click View</span>: Locks cursor inside tab (cannot leave).</p>
                                    <p>• <span className="text-amber-700 font-black">Press [CTRL]</span>: Releases cursor to move outside tab.</p>
                                    <p>• <span className="text-purple-700 font-black">Spacebar</span>: Near door scanner to scan & open.</p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* CURSOR LOCK STATUS PILL (TRAPPED IN TAB UNLESS CTRL PRESSED) */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all duration-300">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wide flex items-center gap-2 backdrop-blur-md border shadow-md ${
                        isCursorLocked
                            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300 shadow-emerald-950/30'
                            : 'bg-white/90 border-slate-300 text-slate-800 shadow-slate-900/10'
                    }`}>
                        <span className={`w-2 h-2 rounded-full ${isCursorLocked ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500'}`} />
                        {isCursorLocked ? (
                            <span>🔒 Cursor locked in tab &bull; Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white border border-slate-600 font-mono font-black text-[9px]">CTRL</kbd> to exit</span>
                        ) : (
                            <span>🔓 Cursor free &bull; Click 3D view to lock in tab</span>
                        )}
                    </div>
                </div>

                {/* RIGHT SIDEBAR: INDEPENDENT LEFT/RIGHT ARM & LEG 3-AXIS CONTROLS */}
                {showSettingsSidebar && (
                    <div className={`sidebar-panel absolute top-3 right-3 z-40 bg-white/95 border border-slate-300 p-3.5 rounded-xl backdrop-blur-md shadow-2xl text-slate-900 w-80 space-y-3.5 max-h-[85vh] overflow-y-auto no-scrollbar pointer-events-auto transition-all ${isCtrlHeld ? 'ring-2 ring-amber-400 shadow-amber-500/20' : ''
                        }`}>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                                <Sliders size={16} className="text-cyan-600" />
                                STUDIO CONTROLS
                            </h4>
                            <button
                                onClick={() => {
                                    setPoseSettings({ ...DEFAULT_POSE_SETTINGS });
                                    setGlassSettings({ color: '#000766', opacity: 1.0, transmission: 0.40, roughness: 0.0, metalness: 0.1 });
                                    setCameraSettings({ ...DEFAULT_CAMERA_SETTINGS });
                                    setScannerSettings({ ...DEFAULT_SCANNER_SETTINGS });
                                    setCorridorSettings({ corridorWidth: 4.15, corridorHeight: 4.60, cornerEdgeCut: 0.55, wallScaleNorth: 1.0, wallScaleSides: 1.6 });
                                    setWallSettings({ useTexture: true, imageUrl: '/Color/green.jpg', color: '#ffffff', repeatX: 1.0, repeatY: 1.0, offsetX: 0.0, offsetY: 0.0, rotation: 0, wrapMode: 'repeat' });
                                }}
                                className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-black px-2 py-1 rounded uppercase tracking-wider border border-slate-300 cursor-pointer"
                            >
                                RESET ALL
                            </button>
                        </div>

                        {/* CATEGORY TABS */}
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 border-b border-slate-200">
                            <button
                                onClick={() => setSettingsTab('corridor')}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${settingsTab === 'corridor' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                                <Maximize2 size={11} />
                                <span>CORRIDOR</span>
                            </button>
                            <button
                                onClick={() => setSettingsTab('wall')}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${settingsTab === 'wall' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                                <Grid size={11} />
                                <span>WALL</span>
                            </button>
                            <button
                                onClick={() => setSettingsTab('glass')}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${settingsTab === 'glass' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                                <Palette size={11} />
                                <span>GLASS</span>
                            </button>
                            <button
                                onClick={() => setSettingsTab('environment')}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${settingsTab === 'environment' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                                <Sparkles size={11} />
                                <span>FLOOR & TOP</span>
                            </button>
                            <button
                                onClick={() => setSettingsTab('camera')}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${settingsTab === 'camera' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                                <Camera size={11} />
                                <span>CAMERA</span>
                            </button>
                            <button
                                onClick={() => setSettingsTab('scanner')}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${settingsTab === 'scanner' ? 'bg-teal-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                                <Scan size={11} />
                                <span>SCANNER</span>
                            </button>
                            <button
                                onClick={() => setSettingsTab('limbs')}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${settingsTab === 'limbs' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                                <User size={11} />
                                <span>LIMBS</span>
                            </button>
                        </div>

                        {/* SECTION CORRIDOR: DOOR CORRIDOR & PASSAGE SIZE */}
                        {(settingsTab === 'corridor' || settingsTab === 'all') && (
                            <div className="bg-amber-50/90 p-3.5 rounded-xl border border-amber-200 shadow-sm space-y-3">
                                <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                                    <h5 className="text-[11px] font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                                        <Maximize2 size={14} className="text-amber-600" />
                                        CORRIDOR & WALL OPENING SIZE
                                    </h5>
                                    <button
                                        onClick={() => setCorridorSettings({ corridorWidth: 4.15, corridorHeight: 4.60, cornerEdgeCut: 0.55, wallScaleNorth: 1.0, wallScaleSides: 1.6 })}
                                        className="text-[8px] bg-white hover:bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded border border-amber-300 cursor-pointer"
                                    >
                                        RESET
                                    </button>
                                </div>

                                {/* QUICK PRESET BUTTONS */}
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-800">QUICK PRESETS</span>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <button
                                            onClick={() => setCorridorSettings(prev => ({ ...prev, corridorWidth: 2.40, corridorHeight: 3.60 }))}
                                            className={`px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all cursor-pointer ${Math.abs(corridorSettings.corridorWidth - 2.40) < 0.05 ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs ring-1 ring-amber-400' : 'bg-white text-slate-700 hover:bg-amber-100/60 border-slate-300'}`}
                                        >
                                            COMPACT (2.4m)
                                        </button>
                                        <button
                                            onClick={() => setCorridorSettings(prev => ({ ...prev, corridorWidth: 2.80, corridorHeight: 3.90 }))}
                                            className={`px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all cursor-pointer ${Math.abs(corridorSettings.corridorWidth - 2.80) < 0.05 ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs ring-1 ring-amber-400' : 'bg-white text-slate-700 hover:bg-amber-100/60 border-slate-300'}`}
                                        >
                                            STANDARD (2.8m)
                                        </button>
                                        <button
                                            onClick={() => setCorridorSettings(prev => ({ ...prev, corridorWidth: 3.40, corridorHeight: 4.20 }))}
                                            className={`px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all cursor-pointer ${Math.abs(corridorSettings.corridorWidth - 3.40) < 0.05 ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs ring-1 ring-amber-400' : 'bg-white text-slate-700 hover:bg-amber-100/60 border-slate-300'}`}
                                        >
                                            WIDE (3.4m)
                                        </button>
                                        <button
                                            onClick={() => setCorridorSettings(prev => ({ ...prev, corridorWidth: 4.20, corridorHeight: 4.60 }))}
                                            className={`px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all cursor-pointer ${Math.abs(corridorSettings.corridorWidth - 4.20) < 0.05 ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs ring-1 ring-amber-400' : 'bg-white text-slate-700 hover:bg-amber-100/60 border-slate-300'}`}
                                        >
                                            EXPANDED (4.2m)
                                        </button>
                                    </div>
                                </div>

                                {/* CORRIDOR OPENING WIDTH */}
                                <div className="space-y-1.5 bg-white/70 p-2 rounded-lg border border-amber-200/80">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>CORRIDOR WIDTH</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setCorridorSettings(prev => ({ ...prev, corridorWidth: Math.max(1.5, parseFloat((prev.corridorWidth - 0.2).toFixed(2))) }))}
                                                className="w-5 h-5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-black text-xs flex items-center justify-center cursor-pointer border border-amber-300"
                                            >
                                                -
                                            </button>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="1.5"
                                                max="5.5"
                                                value={corridorSettings.corridorWidth}
                                                onChange={(e) => setCorridorSettings(prev => ({ ...prev, corridorWidth: parseFloat(e.target.value) || 2.80 }))}
                                                className="w-14 text-center px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-amber-800 text-xs bg-white"
                                            />
                                            <button
                                                onClick={() => setCorridorSettings(prev => ({ ...prev, corridorWidth: Math.min(5.5, parseFloat((prev.corridorWidth + 0.2).toFixed(2))) }))}
                                                className="w-5 h-5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-black text-xs flex items-center justify-center cursor-pointer border border-amber-300"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.5"
                                        max="5.5"
                                        step="0.05"
                                        value={corridorSettings.corridorWidth}
                                        onChange={(e) => setCorridorSettings(prev => ({ ...prev, corridorWidth: parseFloat(e.target.value) }))}
                                        className="w-full accent-amber-600 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[8px] text-slate-500 font-semibold">
                                        <span>Narrow (1.5m)</span>
                                        <span>Wide (5.5m)</span>
                                    </div>
                                </div>

                                {/* CORRIDOR OPENING HEIGHT */}
                                <div className="space-y-1.5 bg-white/70 p-2 rounded-lg border border-amber-200/80">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>CORRIDOR HEIGHT</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setCorridorSettings(prev => ({ ...prev, corridorHeight: Math.max(2.0, parseFloat((prev.corridorHeight - 0.2).toFixed(2))) }))}
                                                className="w-5 h-5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-black text-xs flex items-center justify-center cursor-pointer border border-amber-300"
                                            >
                                                -
                                            </button>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="2.0"
                                                max="6.0"
                                                value={corridorSettings.corridorHeight}
                                                onChange={(e) => setCorridorSettings(prev => ({ ...prev, corridorHeight: parseFloat(e.target.value) || 3.90 }))}
                                                className="w-14 text-center px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-amber-800 text-xs bg-white"
                                            />
                                            <button
                                                onClick={() => setCorridorSettings(prev => ({ ...prev, corridorHeight: Math.min(6.0, parseFloat((prev.corridorHeight + 0.2).toFixed(2))) }))}
                                                className="w-5 h-5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-black text-xs flex items-center justify-center cursor-pointer border border-amber-300"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min="2.0"
                                        max="6.0"
                                        step="0.05"
                                        value={corridorSettings.corridorHeight}
                                        onChange={(e) => setCorridorSettings(prev => ({ ...prev, corridorHeight: parseFloat(e.target.value) }))}
                                        className="w-full accent-amber-600 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[8px] text-slate-500 font-semibold">
                                        <span>Low (2.0m)</span>
                                        <span>High (6.0m)</span>
                                    </div>
                                </div>

                                {/* CORNER EDGE CUT (CHAMFER) */}
                                <div className="space-y-1.5 bg-white/70 p-2 rounded-lg border border-amber-200/80">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>CORNER EDGE CUT (CHAMFER)</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setCorridorSettings(prev => ({ ...prev, cornerEdgeCut: Math.max(0.0, parseFloat((prev.cornerEdgeCut - 0.05).toFixed(2))) }))}
                                                className="w-5 h-5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-black text-xs flex items-center justify-center cursor-pointer border border-amber-300"
                                            >
                                                -
                                            </button>
                                            <input
                                                type="number"
                                                step="0.05"
                                                min="0.0"
                                                max="1.2"
                                                value={corridorSettings.cornerEdgeCut}
                                                onChange={(e) => setCorridorSettings(prev => ({ ...prev, cornerEdgeCut: parseFloat(e.target.value) || 0.0 }))}
                                                className="w-14 text-center px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-amber-800 text-xs bg-white"
                                            />
                                            <button
                                                onClick={() => setCorridorSettings(prev => ({ ...prev, cornerEdgeCut: Math.min(1.2, parseFloat((prev.cornerEdgeCut + 0.05).toFixed(2))) }))}
                                                className="w-5 h-5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-black text-xs flex items-center justify-center cursor-pointer border border-amber-300"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.0"
                                        max="1.2"
                                        step="0.02"
                                        value={corridorSettings.cornerEdgeCut}
                                        onChange={(e) => setCorridorSettings(prev => ({ ...prev, cornerEdgeCut: parseFloat(e.target.value) }))}
                                        className="w-full accent-amber-600 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[8px] text-slate-500 font-semibold">
                                        <span>Square (0.0m)</span>
                                        <span>Deep Sci-Fi Cut (1.2m)</span>
                                    </div>
                                </div>

                                {/* WALLPAPER UV SCALING */}
                                <div className="space-y-2 bg-white/70 p-2 rounded-lg border border-amber-200/80">
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                            <span>NORTH WALL MOON SCALE</span>
                                            <span className="font-mono font-black text-amber-800 text-xs">{corridorSettings.wallScaleNorth.toFixed(1)}x</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="3.0"
                                            step="0.1"
                                            value={corridorSettings.wallScaleNorth}
                                            onChange={(e) => setCorridorSettings(prev => ({ ...prev, wallScaleNorth: parseFloat(e.target.value) }))}
                                            className="w-full accent-amber-600 cursor-pointer"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                            <span>SIDE WALLS SCALE (E/S/W)</span>
                                            <span className="font-mono font-black text-amber-800 text-xs">{corridorSettings.wallScaleSides.toFixed(1)}x</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="3.0"
                                            step="0.1"
                                            value={corridorSettings.wallScaleSides}
                                            onChange={(e) => setCorridorSettings(prev => ({ ...prev, wallScaleSides: parseFloat(e.target.value) }))}
                                            className="w-full accent-amber-600 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SECTION 0: DOOR GLASS COLOR & TRANSPARENCY CONTROLS */}
                        {(settingsTab === 'glass' || settingsTab === 'all') && (
                            <div className="bg-gradient-to-br from-indigo-50/90 to-cyan-50/90 p-3 rounded-xl border border-indigo-200 shadow-sm space-y-2.5">
                                <div className="flex items-center justify-between border-b border-indigo-100 pb-1.5">
                                    <h5 className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Palette size={14} className="text-indigo-600" />
                                        DOOR GLASS APPEARANCE
                                    </h5>
                                    <span className="text-[9px] font-mono font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                                        LIVE 3D
                                    </span>
                                </div>

                                {/* Glass Color Picker & Quick Presets */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>GLASS COLOR</span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => setGlassSettings(prev => ({ ...prev, color: floorSettings.color || '#ffffff' }))}
                                                className="px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[8px] font-mono font-black uppercase transition-all border border-emerald-300 cursor-pointer"
                                                title={`Match to Floor Color (${floorSettings.color || '#ffffff'})`}
                                            >
                                                MATCH FLOOR
                                            </button>
                                            <input
                                                type="color"
                                                value={glassSettings.color}
                                                onChange={(e) => setGlassSettings(prev => ({ ...prev, color: e.target.value }))}
                                                className="w-5 h-5 rounded cursor-pointer border border-slate-300 p-0 overflow-hidden"
                                            />
                                            <span className="font-mono text-[10px] text-slate-600">{glassSettings.color.toUpperCase()}</span>
                                        </div>
                                    </div>

                                    {/* Preset Buttons */}
                                    <div className="grid grid-cols-7 gap-1">
                                        {[
                                            { name: 'Blue Room Floor', color: '#241830', border: 'border-purple-500' },
                                            { name: 'Green Room Floor', color: '#0c1f00', border: 'border-emerald-500' },
                                            { name: 'Red Room Floor', color: '#460735', border: 'border-rose-500' },
                                            { name: 'White Room Floor', color: '#bfbfbf', border: 'border-slate-300' },
                                            { name: 'Yellow Room Floor', color: '#5f5d21', border: 'border-amber-500' },
                                            { name: 'Clean White', color: '#ffffff', border: 'border-slate-300' },
                                            { name: 'Dark Obsidian', color: '#0b1120', border: 'border-slate-800' }
                                        ].map((p) => (
                                            <button
                                                key={p.name}
                                                onClick={() => setGlassSettings(prev => ({ ...prev, color: p.color }))}
                                                title={p.name}
                                                className={`h-5 rounded border ${p.border} transition-transform hover:scale-110 shadow-xs cursor-pointer flex items-center justify-center ${glassSettings.color.toLowerCase() === p.color.toLowerCase() ? 'ring-2 ring-indigo-500 scale-105' : ''
                                                    }`}
                                                style={{ backgroundColor: p.color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Transparency / Opacity Slider */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>OPACITY (TRANSPARENCY)</span>
                                        <span className="font-mono font-black text-indigo-700 text-xs">
                                            {Math.round(glassSettings.opacity * 100)}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.05"
                                        max="1.0"
                                        step="0.01"
                                        value={glassSettings.opacity}
                                        onChange={(e) => setGlassSettings(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                                        className="w-full accent-indigo-600 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[8px] text-slate-500 font-semibold">
                                        <span>Transparent (5%)</span>
                                        <span>Solid (100%)</span>
                                    </div>
                                </div>

                                {/* Transmission (Glass Refraction) Slider */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>GLASS TRANSMISSION</span>
                                        <span className="font-mono font-black text-indigo-700 text-xs">
                                            {Math.round(glassSettings.transmission * 100)}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.0"
                                        max="1.0"
                                        step="0.01"
                                        value={glassSettings.transmission}
                                        onChange={(e) => setGlassSettings(prev => ({ ...prev, transmission: parseFloat(e.target.value) }))}
                                        className="w-full accent-indigo-600 cursor-pointer"
                                    />
                                </div>

                                {/* Glass Glossiness / Roughness Slider */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>SURFACE FINISH</span>
                                        <span className="font-mono font-black text-indigo-700 text-xs">
                                            {glassSettings.roughness < 0.1 ? 'CRYSTAL' : glassSettings.roughness < 0.4 ? 'SEMI-GLOSS' : 'FROSTED'}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.0"
                                        max="0.8"
                                        step="0.02"
                                        value={glassSettings.roughness}
                                        onChange={(e) => setGlassSettings(prev => ({ ...prev, roughness: parseFloat(e.target.value) }))}
                                        className="w-full accent-indigo-600 cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}

                        {/* SECTION WALL: 4-WALLS TEXTURE & BG IMAGE STUDIO */}
                        {(settingsTab === 'wall' || settingsTab === 'all') && (
                            <div className="bg-gradient-to-br from-purple-50/90 to-indigo-50/90 p-3.5 rounded-xl border border-purple-200 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-purple-200/80 pb-1.5">
                                    <h5 className="text-[11px] font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                                        <Grid size={14} className="text-purple-600" />
                                        4-WALLS TEXTURE & BG IMAGE STUDIO
                                    </h5>
                                    <button
                                        onClick={() => {
                                            setWallSettings({
                                                useTexture: true,
                                                imageUrl: '/Color/green.jpg',
                                                color: '#ffffff',
                                                repeatX: 1.0,
                                                repeatY: 1.0,
                                                offsetX: 0.0,
                                                offsetY: 0.0,
                                                rotation: 0,
                                                wrapMode: 'repeat'
                                            });
                                        }}
                                        className="text-[8px] bg-white hover:bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded border border-purple-300 cursor-pointer transition-all shadow-xs"
                                    >
                                        RESET WALL GREEN
                                    </button>
                                </div>

                                {/* WALL SURFACE */}
                                <div className="space-y-2.5 bg-white/80 p-2.5 rounded-xl border border-purple-200 shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <Layers size={13} className="text-purple-700" />
                                            <span className="text-[11px] font-black uppercase text-purple-950">WALL SURFACE</span>
                                        </div>
                                        {/* Surface Mode Toggle */}
                                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                            <button
                                                onClick={() => setWallSettings(prev => ({ ...prev, useTexture: false }))}
                                                className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all cursor-pointer ${!wallSettings.useTexture ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                SOLID COLOR
                                            </button>
                                            <button
                                                onClick={() => setWallSettings(prev => ({ ...prev, useTexture: true, color: '#ffffff' }))}
                                                className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all cursor-pointer ${wallSettings.useTexture ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                BG IMAGE
                                            </button>
                                        </div>
                                    </div>

                                    {/* WALL COLOR PICKER & PRESETS */}
                                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                            <span>{wallSettings.useTexture ? 'WALL IMAGE TINT / BLEND' : 'WALL SOLID COLOR'}</span>
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="color"
                                                    value={wallSettings.color || '#ffffff'}
                                                    onChange={(e) => setWallSettings(prev => ({ ...prev, color: e.target.value }))}
                                                    className="w-5 h-5 rounded cursor-pointer border border-slate-300 p-0 overflow-hidden"
                                                />
                                                <span className="font-mono text-[10px] font-bold text-purple-800 uppercase">
                                                    {wallSettings.color}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {SURFACE_COLOR_PRESETS.map((preset) => (
                                                <button
                                                    key={preset.color}
                                                    onClick={() => setWallSettings(prev => ({ ...prev, color: preset.color }))}
                                                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all cursor-pointer ${(wallSettings.color || '').toLowerCase() === preset.color.toLowerCase()
                                                        ? 'bg-purple-600 text-white border-purple-700 shadow-xs ring-1 ring-purple-400'
                                                        : 'bg-white text-slate-700 hover:bg-purple-50 border-slate-300'
                                                        }`}
                                                >
                                                    <span className="inline-block w-2 h-2 rounded-full mr-1 border border-slate-300 align-middle" style={{ backgroundColor: preset.color }} />
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* WALL BG IMAGE ADVANCED PROPERTIES */}
                                    {wallSettings.useTexture && (
                                        <div className="space-y-3 pt-2 border-t border-purple-100 animate-in fade-in duration-200">
                                            {/* Image Source & Upload Buttons */}
                                            <div className="space-y-1.5">
                                                <span className="text-[10px] font-bold text-slate-800">WALL IMAGE SOURCE</span>
                                                <div className="grid grid-cols-3 gap-1">
                                                    {ROOM_THEME_OPTIONS.map((theme) => (
                                                        <button
                                                            key={theme.id}
                                                            onClick={() => {
                                                                const config = THEME_DEFAULTS[theme.name] || THEME_DEFAULTS[theme.id];
                                                                setWallSettings(prev => ({
                                                                    ...prev,
                                                                    useTexture: true,
                                                                    imageUrl: theme.imageUrl,
                                                                    rotation: config ? config.wallRotation : prev.rotation
                                                                }));
                                                            }}
                                                            className={`px-1.5 py-1 rounded text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all border ${wallSettings.imageUrl === theme.imageUrl
                                                                ? 'bg-purple-600 text-white border-purple-700 shadow-xs ring-1 ring-purple-400'
                                                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                                                                }`}
                                                        >
                                                            <span>{theme.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="pt-1">
                                                    <button
                                                        onClick={() => wallFileInputRef.current?.click()}
                                                        className="w-full px-2 py-1.5 rounded-lg border bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-purple-700 text-[9px] font-black uppercase flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
                                                    >
                                                        <Upload size={12} />
                                                        <span>Upload Local Wall Image...</span>
                                                    </button>
                                                    <input
                                                        type="file"
                                                        ref={wallFileInputRef}
                                                        onChange={handleWallFileUpload}
                                                        accept="image/*"
                                                        className="hidden"
                                                    />
                                                </div>
                                            </div>

                                            {/* EXPAND & STRETCH SIZE: WIDTH SCALE (REPEAT X) */}
                                            <div className="space-y-1 bg-purple-50/50 p-2 rounded-lg border border-purple-200/60">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                                    <span>WIDTH SCALE / STRETCH (X)</span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setWallSettings(prev => ({ ...prev, repeatX: Math.max(0.1, parseFloat(((prev.repeatX ?? 1.0) - 0.1).toFixed(2))) }))}
                                                            className="w-4.5 h-4.5 bg-white text-slate-800 rounded font-bold text-xs flex items-center justify-center border border-slate-300 hover:bg-slate-100 cursor-pointer"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="font-mono font-black text-purple-800 text-xs w-10 text-center">
                                                            {(wallSettings.repeatX ?? 1.0).toFixed(1)}x
                                                        </span>
                                                        <button
                                                            onClick={() => setWallSettings(prev => ({ ...prev, repeatX: Math.min(6.0, parseFloat(((prev.repeatX ?? 1.0) + 0.1).toFixed(2))) }))}
                                                            className="w-4.5 h-4.5 bg-white text-slate-800 rounded font-bold text-xs flex items-center justify-center border border-slate-300 hover:bg-slate-100 cursor-pointer"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.1"
                                                    max="5.0"
                                                    step="0.05"
                                                    value={wallSettings.repeatX ?? 1.0}
                                                    onChange={(e) => setWallSettings(prev => ({ ...prev, repeatX: parseFloat(e.target.value) }))}
                                                    className="w-full accent-purple-600 cursor-pointer"
                                                />
                                                <div className="flex justify-between text-[8px] text-slate-500 font-semibold">
                                                    <span>Expanded (0.1x)</span>
                                                    <span>1.0x Normal</span>
                                                    <span>Tiled Compact (5.0x)</span>
                                                </div>
                                            </div>

                                            {/* EXPAND & STRETCH SIZE: HEIGHT SCALE (REPEAT Y) */}
                                            <div className="space-y-1 bg-purple-50/50 p-2 rounded-lg border border-purple-200/60">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                                    <span>HEIGHT SCALE / STRETCH (Y)</span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setWallSettings(prev => ({ ...prev, repeatY: Math.max(0.1, parseFloat(((prev.repeatY ?? 1.0) - 0.1).toFixed(2))) }))}
                                                            className="w-4.5 h-4.5 bg-white text-slate-800 rounded font-bold text-xs flex items-center justify-center border border-slate-300 hover:bg-slate-100 cursor-pointer"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="font-mono font-black text-purple-800 text-xs w-10 text-center">
                                                            {(wallSettings.repeatY ?? 1.0).toFixed(1)}x
                                                        </span>
                                                        <button
                                                            onClick={() => setWallSettings(prev => ({ ...prev, repeatY: Math.min(6.0, parseFloat(((prev.repeatY ?? 1.0) + 0.1).toFixed(2))) }))}
                                                            className="w-4.5 h-4.5 bg-white text-slate-800 rounded font-bold text-xs flex items-center justify-center border border-slate-300 hover:bg-slate-100 cursor-pointer"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.1"
                                                    max="5.0"
                                                    step="0.05"
                                                    value={wallSettings.repeatY ?? 1.0}
                                                    onChange={(e) => setWallSettings(prev => ({ ...prev, repeatY: parseFloat(e.target.value) }))}
                                                    className="w-full accent-purple-600 cursor-pointer"
                                                />
                                            </div>

                                            {/* POSITION OFFSET (X & Y) */}
                                            <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                                    <span>POSITION OFFSET</span>
                                                    <button
                                                        onClick={() => setWallSettings(prev => ({ ...prev, offsetX: 0, offsetY: 0 }))}
                                                        className="text-[8px] text-purple-700 hover:underline font-bold cursor-pointer"
                                                    >
                                                        CENTER
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-0.5">
                                                        <div className="flex justify-between text-[9px] font-semibold text-slate-600">
                                                            <span>Offset X</span>
                                                            <span className="font-mono font-bold">{(wallSettings.offsetX ?? 0).toFixed(2)}</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="-1.5"
                                                            max="1.5"
                                                            step="0.05"
                                                            value={wallSettings.offsetX ?? 0}
                                                            onChange={(e) => setWallSettings(prev => ({ ...prev, offsetX: parseFloat(e.target.value) }))}
                                                            className="w-full accent-purple-600 cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <div className="flex justify-between text-[9px] font-semibold text-slate-600">
                                                            <span>Offset Y</span>
                                                            <span className="font-mono font-bold">{(wallSettings.offsetY ?? 0).toFixed(2)}</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="-1.5"
                                                            max="1.5"
                                                            step="0.05"
                                                            value={wallSettings.offsetY ?? 0}
                                                            onChange={(e) => setWallSettings(prev => ({ ...prev, offsetY: parseFloat(e.target.value) }))}
                                                            className="w-full accent-purple-600 cursor-pointer"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ROTATION ANGLE & QUICK PRESETS */}
                                            <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                                    <span className="flex items-center gap-1">
                                                        <RotateCw size={11} className="text-purple-700" />
                                                        ROTATION ANGLE
                                                    </span>
                                                    <span className="font-mono font-black text-purple-800 text-xs">
                                                        {wallSettings.rotation ?? 0}°
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="360"
                                                    step="5"
                                                    value={wallSettings.rotation ?? 0}
                                                    onChange={(e) => setWallSettings(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
                                                    className="w-full accent-purple-600 cursor-pointer"
                                                />
                                                <div className="flex items-center gap-1">
                                                    {[0, 90, 180, 270].map((deg) => (
                                                        <button
                                                            key={deg}
                                                            onClick={() => setWallSettings(prev => ({ ...prev, rotation: deg }))}
                                                            className={`flex-1 py-1 rounded text-[8px] font-bold border cursor-pointer transition-all ${wallSettings.rotation === deg ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
                                                        >
                                                            {deg}°
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* REPEAT / WRAP MODE */}
                                            <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                <span className="text-[10px] font-bold text-slate-800">IMAGE WRAPPING / REPEAT</span>
                                                <div className="grid grid-cols-3 gap-1">
                                                    {[
                                                        { id: 'clamp', label: 'Single Stretch' },
                                                        { id: 'repeat', label: 'Tiled Repeat' },
                                                        { id: 'mirror', label: 'Mirrored Grid' }
                                                    ].map((wrap) => (
                                                        <button
                                                            key={wrap.id}
                                                            onClick={() => setWallSettings(prev => ({ ...prev, wrapMode: wrap.id as any }))}
                                                            className={`py-1 px-1 rounded text-[8px] font-bold uppercase transition-all border cursor-pointer ${wallSettings.wrapMode === wrap.id ? 'bg-purple-600 text-white border-purple-700 shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
                                                        >
                                                            {wrap.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* SECTION ENVIRONMENT: FLOOR & CEILING (TOP) TEXTURE & BG IMAGE STUDIO */}
                        {(settingsTab === 'environment' || settingsTab === 'all') && (
                            <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/90 p-3.5 rounded-xl border border-emerald-200 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-1.5">
                                    <h5 className="text-[11px] font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                                        <Sparkles size={14} className="text-emerald-600" />
                                        FLOOR & CEILING (TOP) STUDIO
                                    </h5>
                                    <button
                                        onClick={() => {
                                            setFloorSettings({
                                                useTexture: false,
                                                imageUrl: '/download (1).jpg',
                                                color: '#052e16',
                                                repeatX: 1.0,
                                                repeatY: 1.0,
                                                offsetX: 0.0,
                                                offsetY: 0.0,
                                                rotation: 0,
                                                wrapMode: 'repeat'
                                            });
                                            setCeilingSettings({
                                                useTexture: false,
                                                imageUrl: '/download (1).jpg',
                                                color: '#064e3b',
                                                repeatX: 1.0,
                                                repeatY: 1.0,
                                                offsetX: 0.0,
                                                offsetY: 0.0,
                                                rotation: 0,
                                                wrapMode: 'repeat'
                                            });
                                        }}
                                        className="text-[8px] bg-white hover:bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded border border-emerald-300 cursor-pointer transition-all shadow-xs"
                                    >
                                        RESET JOKER GREEN
                                    </button>
                                </div>

                                {/* ==================== FLOOR CUSTOMIZATION ==================== */}
                                <div className="space-y-2.5 bg-white/80 p-2.5 rounded-xl border border-emerald-200 shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <Layers size={13} className="text-emerald-700" />
                                            <span className="text-[11px] font-black uppercase text-emerald-950">FLOOR SURFACE</span>
                                        </div>
                                        {/* Surface Mode Toggle */}
                                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                            <button
                                                onClick={() => setFloorSettings(prev => ({ ...prev, useTexture: false }))}
                                                className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all cursor-pointer ${!floorSettings.useTexture ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                SOLID COLOR
                                            </button>
                                            <button
                                                onClick={() => setFloorSettings(prev => ({ ...prev, useTexture: true, color: '#ffffff' }))}
                                                className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all cursor-pointer ${floorSettings.useTexture ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                BG IMAGE
                                            </button>
                                        </div>
                                    </div>

                                    {/* FLOOR COLOR PICKER & PRESETS */}
                                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                            <span>{floorSettings.useTexture ? 'FLOOR IMAGE TINT / BLEND' : 'FLOOR SOLID COLOR'}</span>
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="color"
                                                    value={floorSettings.color || '#052e16'}
                                                    onChange={(e) => setFloorSettings(prev => ({ ...prev, color: e.target.value }))}
                                                    className="w-5 h-5 rounded cursor-pointer border border-slate-300 p-0 overflow-hidden"
                                                />
                                                <span className="font-mono text-[10px] font-bold text-emerald-800 uppercase">
                                                    {floorSettings.color}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {SURFACE_COLOR_PRESETS.map((preset) => (
                                                <button
                                                    key={preset.color}
                                                    onClick={() => setFloorSettings(prev => ({ ...prev, color: preset.color }))}
                                                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all cursor-pointer ${(floorSettings.color || '').toLowerCase() === preset.color.toLowerCase()
                                                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-1 ring-emerald-400'
                                                        : 'bg-white text-slate-700 hover:bg-emerald-50 border-slate-300'
                                                        }`}
                                                >
                                                    <span className="inline-block w-2 h-2 rounded-full mr-1 border border-slate-300 align-middle" style={{ backgroundColor: preset.color }} />
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* FLOOR BG IMAGE ADVANCED PROPERTIES */}
                                    {floorSettings.useTexture && (
                                        <div className="space-y-3 pt-2 border-t border-emerald-100 animate-in fade-in duration-200">
                                            {/* Image Source & Upload Buttons */}
                                            <div className="space-y-1.5">
                                                <span className="text-[10px] font-bold text-slate-800">FLOOR IMAGE SOURCE</span>
                                                <div className="grid grid-cols-3 gap-1">
                                                    {ROOM_THEME_OPTIONS.map((theme) => (
                                                        <button
                                                            key={theme.id}
                                                            onClick={() => setFloorSettings(prev => ({ ...prev, useTexture: true, imageUrl: theme.imageUrl }))}
                                                            className={`px-1.5 py-1 rounded text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all border ${floorSettings.imageUrl === theme.imageUrl
                                                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-1 ring-emerald-400'
                                                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                                                                }`}
                                                        >
                                                            <span>{theme.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="pt-1">
                                                    <button
                                                        onClick={() => floorFileInputRef.current?.click()}
                                                        className="w-full px-2 py-1.5 rounded-lg border bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white border-teal-700 text-[9px] font-black uppercase flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
                                                    >
                                                        <Upload size={12} />
                                                        <span>Upload Local Floor Image...</span>
                                                    </button>
                                                    <input
                                                        type="file"
                                                        ref={floorFileInputRef}
                                                        onChange={handleFloorFileUpload}
                                                        accept="image/*"
                                                        className="hidden"
                                                    />
                                                </div>
                                            </div>

                                            {/* EXPAND & STRETCH SIZE: WIDTH SCALE (REPEAT X) */}
                                            <div className="space-y-1 bg-emerald-50/50 p-2 rounded-lg border border-emerald-200/60">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                                    <span>WIDTH SCALE / STRETCH (X)</span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setFloorSettings(prev => ({ ...prev, repeatX: Math.max(0.1, parseFloat(((prev.repeatX ?? 1.0) - 0.1).toFixed(2))) }))}
                                                            className="w-4.5 h-4.5 bg-white text-slate-800 rounded font-bold text-xs flex items-center justify-center border border-slate-300 hover:bg-slate-100 cursor-pointer"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="font-mono font-black text-emerald-800 text-xs w-10 text-center">
                                                            {(floorSettings.repeatX ?? 1.0).toFixed(1)}x
                                                        </span>
                                                        <button
                                                            onClick={() => setFloorSettings(prev => ({ ...prev, repeatX: Math.min(6.0, parseFloat(((prev.repeatX ?? 1.0) + 0.1).toFixed(2))) }))}
                                                            className="w-4.5 h-4.5 bg-white text-slate-800 rounded font-bold text-xs flex items-center justify-center border border-slate-300 hover:bg-slate-100 cursor-pointer"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.1"
                                                    max="5.0"
                                                    step="0.05"
                                                    value={floorSettings.repeatX ?? 1.0}
                                                    onChange={(e) => setFloorSettings(prev => ({ ...prev, repeatX: parseFloat(e.target.value) }))}
                                                    className="w-full accent-emerald-600 cursor-pointer"
                                                />
                                                <div className="flex justify-between text-[8px] text-slate-500 font-semibold">
                                                    <span>Expanded (0.1x)</span>
                                                    <span>1.0x Normal</span>
                                                    <span>Tiled Compact (5.0x)</span>
                                                </div>
                                            </div>

                                            {/* EXPAND & STRETCH SIZE: HEIGHT SCALE (REPEAT Y) */}
                                            <div className="space-y-1 bg-emerald-50/50 p-2 rounded-lg border border-emerald-200/60">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                                    <span>HEIGHT SCALE / STRETCH (Y)</span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setFloorSettings(prev => ({ ...prev, repeatY: Math.max(0.1, parseFloat(((prev.repeatY ?? 1.0) - 0.1).toFixed(2))) }))}
                                                            className="w-4.5 h-4.5 bg-white text-slate-800 rounded font-bold text-xs flex items-center justify-center border border-slate-300 hover:bg-slate-100 cursor-pointer"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="font-mono font-black text-emerald-800 text-xs w-10 text-center">
                                                            {(floorSettings.repeatY ?? 1.0).toFixed(1)}x
                                                        </span>
                                                        <button
                                                            onClick={() => setFloorSettings(prev => ({ ...prev, repeatY: Math.min(6.0, parseFloat(((prev.repeatY ?? 1.0) + 0.1).toFixed(2))) }))}
                                                            className="w-4.5 h-4.5 bg-white text-slate-800 rounded font-bold text-xs flex items-center justify-center border border-slate-300 hover:bg-slate-100 cursor-pointer"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.1"
                                                    max="5.0"
                                                    step="0.05"
                                                    value={floorSettings.repeatY ?? 1.0}
                                                    onChange={(e) => setFloorSettings(prev => ({ ...prev, repeatY: parseFloat(e.target.value) }))}
                                                    className="w-full accent-emerald-600 cursor-pointer"
                                                />
                                            </div>

                                            {/* POSITION OFFSET (X & Y) */}
                                            <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                                    <span>POSITION OFFSET</span>
                                                    <button
                                                        onClick={() => setFloorSettings(prev => ({ ...prev, offsetX: 0, offsetY: 0 }))}
                                                        className="text-[8px] text-emerald-700 hover:underline font-bold cursor-pointer"
                                                    >
                                                        CENTER
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-0.5">
                                                        <div className="flex justify-between text-[9px] font-semibold text-slate-600">
                                                            <span>Offset X</span>
                                                            <span className="font-mono font-bold">{(floorSettings.offsetX ?? 0).toFixed(2)}</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="-1.5"
                                                            max="1.5"
                                                            step="0.05"
                                                            value={floorSettings.offsetX ?? 0}
                                                            onChange={(e) => setFloorSettings(prev => ({ ...prev, offsetX: parseFloat(e.target.value) }))}
                                                            className="w-full accent-emerald-600 cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <div className="flex justify-between text-[9px] font-semibold text-slate-600">
                                                            <span>Offset Y</span>
                                                            <span className="font-mono font-bold">{(floorSettings.offsetY ?? 0).toFixed(2)}</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="-1.5"
                                                            max="1.5"
                                                            step="0.05"
                                                            value={floorSettings.offsetY ?? 0}
                                                            onChange={(e) => setFloorSettings(prev => ({ ...prev, offsetY: parseFloat(e.target.value) }))}
                                                            className="w-full accent-emerald-600 cursor-pointer"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ROTATION ANGLE & QUICK PRESETS */}
                                            <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                                    <span className="flex items-center gap-1">
                                                        <RotateCw size={11} className="text-emerald-700" />
                                                        ROTATION ANGLE
                                                    </span>
                                                    <span className="font-mono font-black text-emerald-800 text-xs">
                                                        {floorSettings.rotation ?? 0}°
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="360"
                                                    step="5"
                                                    value={floorSettings.rotation ?? 0}
                                                    onChange={(e) => setFloorSettings(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
                                                    className="w-full accent-emerald-600 cursor-pointer"
                                                />
                                                <div className="flex items-center gap-1">
                                                    {[0, 90, 180, 270].map((deg) => (
                                                        <button
                                                            key={deg}
                                                            onClick={() => setFloorSettings(prev => ({ ...prev, rotation: deg }))}
                                                            className={`flex-1 py-1 rounded text-[8px] font-bold border cursor-pointer transition-all ${floorSettings.rotation === deg ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
                                                        >
                                                            {deg}°
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* REPEAT / WRAP MODE */}
                                            <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                <span className="text-[10px] font-bold text-slate-800">IMAGE WRAPPING / REPEAT</span>
                                                <div className="grid grid-cols-3 gap-1">
                                                    {[
                                                        { id: 'clamp', label: 'Single Stretch' },
                                                        { id: 'repeat', label: 'Tiled Repeat' },
                                                        { id: 'mirror', label: 'Mirrored Grid' }
                                                    ].map((wrap) => (
                                                        <button
                                                            key={wrap.id}
                                                            onClick={() => setFloorSettings(prev => ({ ...prev, wrapMode: wrap.id as any }))}
                                                            className={`py-1 px-1 rounded text-[8px] font-bold uppercase transition-all border cursor-pointer ${floorSettings.wrapMode === wrap.id ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'}`}
                                                        >
                                                            {wrap.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ==================== CEILING (TOP) CUSTOMIZATION ==================== */}
                                <div className="space-y-2.5 bg-white/80 p-2.5 rounded-xl border border-emerald-200 shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <Layers size={13} className="text-emerald-700" />
                                            <span className="text-[11px] font-black uppercase text-emerald-950">CEILING (TOP) SURFACE</span>
                                        </div>
                                        {/* Surface Mode Toggle */}
                                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                            <button
                                                onClick={() => setCeilingSettings(prev => ({ ...prev, useTexture: false }))}
                                                className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all cursor-pointer ${!ceilingSettings.useTexture ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                SOLID COLOR
                                            </button>
                                            <button
                                                onClick={() => setCeilingSettings(prev => ({ ...prev, useTexture: true, color: '#ffffff' }))}
                                                className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all cursor-pointer ${ceilingSettings.useTexture ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                BG IMAGE
                                            </button>
                                        </div>
                                    </div>

                                    {/* CEILING COLOR PICKER & PRESETS */}
                                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                            <span>{ceilingSettings.useTexture ? 'CEILING IMAGE TINT / BLEND' : 'CEILING SOLID COLOR'}</span>
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="color"
                                                    value={ceilingSettings.color || '#064e3b'}
                                                    onChange={(e) => setCeilingSettings(prev => ({ ...prev, color: e.target.value }))}
                                                    className="w-5 h-5 rounded cursor-pointer border border-slate-300 p-0 overflow-hidden"
                                                />
                                                <span className="font-mono text-[10px] font-bold text-emerald-800 uppercase">
                                                    {ceilingSettings.color}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {SURFACE_COLOR_PRESETS.map((preset) => (
                                                    <button
                                                        key={preset.color}
                                                        onClick={() => setCeilingSettings(prev => ({ ...prev, color: preset.color }))}
                                                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all cursor-pointer ${(ceilingSettings.color || '').toLowerCase() === preset.color.toLowerCase()
                                                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-1 ring-emerald-400'
                                                            : 'bg-white text-slate-700 hover:bg-emerald-50 border-slate-300'
                                                            }`}
                                                    >
                                                        <span className="inline-block w-2 h-2 rounded-full mr-1 border border-slate-300 align-middle" style={{ backgroundColor: preset.color }} />
                                                        {preset.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* CEILING BG IMAGE ADVANCED PROPERTIES */}
                                    {ceilingSettings.useTexture && (
                                        <div className="space-y-3 pt-2 border-t border-emerald-100 animate-in fade-in duration-200">
                                            {/* Ceiling Image Source & Upload */}
                                            <div className="space-y-1.5">
                                                <span className="text-[10px] font-bold text-slate-800">CEILING IMAGE SOURCE</span>
                                                <div className="grid grid-cols-3 gap-1">
                                                    {ROOM_THEME_OPTIONS.map((theme) => (
                                                        <button
                                                            key={theme.id}
                                                            onClick={() => setCeilingSettings(prev => ({ ...prev, useTexture: true, imageUrl: theme.imageUrl }))}
                                                            className={`px-1.5 py-1 rounded text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all border ${ceilingSettings.imageUrl === theme.imageUrl
                                                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-1 ring-emerald-400'
                                                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                                                                }`}
                                                        >
                                                            <span>{theme.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="pt-1">
                                                    <button
                                                        onClick={() => ceilingFileInputRef.current?.click()}
                                                        className="w-full px-2 py-1.5 rounded-lg border bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white border-teal-700 text-[9px] font-black uppercase flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
                                                    >
                                                        <Upload size={12} />
                                                        <span>Upload Local Ceiling Image...</span>
                                                    </button>
                                                    <input
                                                        type="file"
                                                        ref={ceilingFileInputRef}
                                                        onChange={handleCeilingFileUpload}
                                                        accept="image/*"
                                                        className="hidden"
                                                    />
                                                </div>
                                            </div>

                                            {/* CEILING SCALE X & Y */}
                                            <div className="grid grid-cols-2 gap-2 bg-emerald-50/50 p-2 rounded-lg border border-emerald-200/60">
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-800">
                                                        <span>WIDTH (X)</span>
                                                        <span className="font-mono text-emerald-800 font-bold">{(ceilingSettings.repeatX ?? 1.0).toFixed(1)}x</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0.1"
                                                        max="5.0"
                                                        step="0.05"
                                                        value={ceilingSettings.repeatX ?? 1.0}
                                                        onChange={(e) => setCeilingSettings(prev => ({ ...prev, repeatX: parseFloat(e.target.value) }))}
                                                        className="w-full accent-emerald-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-800">
                                                        <span>HEIGHT (Y)</span>
                                                        <span className="font-mono text-emerald-800 font-bold">{(ceilingSettings.repeatY ?? 1.0).toFixed(1)}x</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0.1"
                                                        max="5.0"
                                                        step="0.05"
                                                        value={ceilingSettings.repeatY ?? 1.0}
                                                        onChange={(e) => setCeilingSettings(prev => ({ ...prev, repeatY: parseFloat(e.target.value) }))}
                                                        className="w-full accent-emerald-600 cursor-pointer"
                                                    />
                                                </div>
                                            </div>

                                            {/* CEILING ROTATION & WRAP */}
                                            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-800">
                                                        <span>ROTATION</span>
                                                        <span className="font-mono text-emerald-800 font-bold">{ceilingSettings.rotation ?? 0}°</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="360"
                                                        step="90"
                                                        value={ceilingSettings.rotation ?? 0}
                                                        onChange={(e) => setCeilingSettings(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
                                                        className="w-full accent-emerald-600 cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[9px] font-bold text-slate-800 block">WRAP MODE</span>
                                                    <div className="flex items-center gap-1">
                                                        {(['clamp', 'repeat', 'mirror'] as const).map((w) => (
                                                            <button
                                                                key={w}
                                                                onClick={() => setCeilingSettings(prev => ({ ...prev, wrapMode: w }))}
                                                                className={`flex-1 py-0.5 rounded text-[7px] font-bold uppercase border cursor-pointer ${ceilingSettings.wrapMode === w ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'}`}
                                                            >
                                                                {w}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* SECTION CAMERA: CAMERA POSITION & PERSPECTIVE CONTROLS */}
                        {(settingsTab === 'camera' || settingsTab === 'all') && (
                            <div className="bg-sky-50/80 p-3 rounded-xl border border-sky-200 shadow-sm space-y-2.5">
                                <div className="flex items-center justify-between border-b border-sky-100 pb-1.5">
                                    <h5 className="text-[11px] font-black text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Camera size={14} className="text-sky-600" />
                                        CAMERA POSITION & PERSPECTIVE
                                    </h5>
                                    <button
                                        onClick={() => setCameraSettings({ ...DEFAULT_CAMERA_SETTINGS })}
                                        className="text-[8px] bg-white hover:bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded border border-sky-300 cursor-pointer"
                                    >
                                        RESET CAM
                                    </button>
                                </div>

                                {/* Camera Distance Slider & Input */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>CAMERA DISTANCE (TPS)</span>
                                        <input
                                            type="number"
                                            step="0.05"
                                            value={cameraSettings.distance}
                                            onChange={(e) => setCameraSettings(prev => ({ ...prev, distance: parseFloat(e.target.value) || 2.65 }))}
                                            className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-sky-700 text-xs bg-white"
                                        />
                                    </div>
                                    <input
                                        type="range"
                                        min="1.0"
                                        max="8.0"
                                        step="0.05"
                                        value={cameraSettings.distance}
                                        onChange={(e) => setCameraSettings(prev => ({ ...prev, distance: parseFloat(e.target.value) }))}
                                        className="w-full accent-sky-600 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[8px] text-slate-500 font-semibold">
                                        <span>Close (1.0m)</span>
                                        <span>Far (8.0m)</span>
                                    </div>
                                </div>

                                {/* Camera Height Slider & Input */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>CAMERA HEIGHT</span>
                                        <input
                                            type="number"
                                            step="0.05"
                                            value={cameraSettings.height}
                                            onChange={(e) => setCameraSettings(prev => ({ ...prev, height: parseFloat(e.target.value) || 1.90 }))}
                                            className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-sky-700 text-xs bg-white"
                                        />
                                    </div>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="5.0"
                                        step="0.05"
                                        value={cameraSettings.height}
                                        onChange={(e) => setCameraSettings(prev => ({ ...prev, height: parseFloat(e.target.value) }))}
                                        className="w-full accent-sky-600 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[8px] text-slate-500 font-semibold">
                                        <span>Low (0.5m)</span>
                                        <span>High (5.0m)</span>
                                    </div>
                                </div>

                                {/* Camera Pitch Slider & Input */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>CAMERA PITCH (TILT)</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={cameraSettings.pitch}
                                            onChange={(e) => setCameraSettings(prev => ({ ...prev, pitch: parseFloat(e.target.value) || 0.08 }))}
                                            className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-sky-700 text-xs bg-white"
                                        />
                                    </div>
                                    <input
                                        type="range"
                                        min="-0.40"
                                        max="0.60"
                                        step="0.01"
                                        value={cameraSettings.pitch}
                                        onChange={(e) => setCameraSettings(prev => ({ ...prev, pitch: parseFloat(e.target.value) }))}
                                        className="w-full accent-sky-600 cursor-pointer"
                                    />
                                </div>

                                {/* Field of View (FOV) Slider & Input */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>FIELD OF VIEW (FOV)</span>
                                        <input
                                            type="number"
                                            min="30"
                                            max="90"
                                            value={cameraSettings.fov}
                                            onChange={(e) => setCameraSettings(prev => ({ ...prev, fov: parseInt(e.target.value) || 55 }))}
                                            className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-sky-700 text-xs bg-white"
                                        />
                                    </div>
                                    <input
                                        type="range"
                                        min="30"
                                        max="90"
                                        step="1"
                                        value={cameraSettings.fov}
                                        onChange={(e) => setCameraSettings(prev => ({ ...prev, fov: parseInt(e.target.value) }))}
                                        className="w-full accent-sky-600 cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}

                        {/* SECTION SCANNER: SCANNER 3D POSITION & SCALE CONTROLS */}
                        {(settingsTab === 'scanner' || settingsTab === 'all') && (
                            <div className="bg-teal-50/80 p-3 rounded-xl border border-teal-200 shadow-sm space-y-2.5">
                                <div className="flex items-center justify-between border-b border-teal-100 pb-1.5">
                                    <h5 className="text-[11px] font-black text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Scan size={14} className="text-teal-600" />
                                        SCANNER 3D POSITION & SCALE
                                    </h5>
                                    <button
                                        onClick={() => setScannerSettings({ ...DEFAULT_SCANNER_SETTINGS })}
                                        className="text-[8px] bg-white hover:bg-teal-100 text-teal-800 font-bold px-1.5 py-0.5 rounded border border-teal-300 cursor-pointer"
                                    >
                                        RESET SCANNER
                                    </button>
                                </div>

                                {/* Scanner Offset X (Side) */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>SIDE OFFSET X (FROM DOOR)</span>
                                        <input
                                            type="number"
                                            step="0.05"
                                            value={scannerSettings.posX}
                                            onChange={(e) => setScannerSettings(prev => ({ ...prev, posX: parseFloat(e.target.value) || 0.35 }))}
                                            className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-teal-700 text-xs bg-white"
                                        />
                                    </div>
                                    <input
                                        type="range"
                                        min="-2.0"
                                        max="2.5"
                                        step="0.05"
                                        value={scannerSettings.posX}
                                        onChange={(e) => setScannerSettings(prev => ({ ...prev, posX: parseFloat(e.target.value) }))}
                                        className="w-full accent-teal-600 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[8px] text-slate-500 font-semibold">
                                        <span>Center (-2.0m)</span>
                                        <span>Outer (+2.5m)</span>
                                    </div>
                                </div>

                                {/* Scanner Height Y */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>HEIGHT Y</span>
                                        <input
                                            type="number"
                                            step="0.05"
                                            value={scannerSettings.posY}
                                            onChange={(e) => setScannerSettings(prev => ({ ...prev, posY: parseFloat(e.target.value) || 1.45 }))}
                                            className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-teal-700 text-xs bg-white"
                                        />
                                    </div>
                                    <input
                                        type="range"
                                        min="0.2"
                                        max="3.5"
                                        step="0.05"
                                        value={scannerSettings.posY}
                                        onChange={(e) => setScannerSettings(prev => ({ ...prev, posY: parseFloat(e.target.value) }))}
                                        className="w-full accent-teal-600 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[8px] text-slate-500 font-semibold">
                                        <span>Ground (0.2m)</span>
                                        <span>High (3.5m)</span>
                                    </div>
                                </div>

                                {/* Scanner Depth Z */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>DEPTH Z (WALL DISTANCE)</span>
                                        <input
                                            type="number"
                                            step="0.02"
                                            value={scannerSettings.posZ}
                                            onChange={(e) => setScannerSettings(prev => ({ ...prev, posZ: parseFloat(e.target.value) || 0.08 }))}
                                            className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-teal-700 text-xs bg-white"
                                        />
                                    </div>
                                    <input
                                        type="range"
                                        min="-0.5"
                                        max="1.2"
                                        step="0.02"
                                        value={scannerSettings.posZ}
                                        onChange={(e) => setScannerSettings(prev => ({ ...prev, posZ: parseFloat(e.target.value) }))}
                                        className="w-full accent-teal-600 cursor-pointer"
                                    />
                                </div>

                                {/* Scanner Scale */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                        <span>TERMINAL SCALE</span>
                                        <input
                                            type="number"
                                            step="0.05"
                                            value={scannerSettings.scale}
                                            onChange={(e) => setScannerSettings(prev => ({ ...prev, scale: parseFloat(e.target.value) || 1.0 }))}
                                            className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-teal-700 text-xs bg-white"
                                        />
                                    </div>
                                    <input
                                        type="range"
                                        min="0.3"
                                        max="2.0"
                                        step="0.05"
                                        value={scannerSettings.scale}
                                        onChange={(e) => setScannerSettings(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                                        className="w-full accent-teal-600 cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}

                        {/* SECTION LIMBS: INDEPENDENT LIMB CONTROLS & PICKED PARTS */}
                        {(settingsTab === 'limbs' || settingsTab === 'all') && (
                            <>

                        {/* SECTION 1: LEFT ARM CONTROLS (X, Y, Z) */}
                        <div className="bg-cyan-50/70 p-3 rounded-xl border border-cyan-200 space-y-2">
                            <h5 className="text-[11px] font-black text-cyan-800 uppercase tracking-wider">LEFT ARM (X, Y, Z)</h5>

                            {/* Left Arm Z */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                    <span>LEFT ARM Z (RAISE/LOWER)</span>
                                    <input
                                        type="number"
                                        value={poseSettings.leftArmZ}
                                        onChange={(e) => setPoseSettings(prev => ({ ...prev, leftArmZ: parseFloat(e.target.value) || 0 }))}
                                        className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-cyan-700 text-xs bg-white"
                                    />
                                </div>
                                <input
                                    type="range" min="-180" max="180" value={poseSettings.leftArmZ}
                                    onChange={(e) => setPoseSettings(prev => ({ ...prev, leftArmZ: parseFloat(e.target.value) }))}
                                    className="w-full accent-cyan-600 cursor-pointer"
                                />
                            </div>

                            {/* Left Arm X */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                    <span>LEFT ARM X (FORWARD/BACK)</span>
                                    <input
                                        type="number"
                                        value={poseSettings.leftArmX}
                                        onChange={(e) => setPoseSettings(prev => ({ ...prev, leftArmX: parseFloat(e.target.value) || 0 }))}
                                        className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-cyan-700 text-xs bg-white"
                                    />
                                </div>
                                <input
                                    type="range" min="-180" max="180" value={poseSettings.leftArmX}
                                    onChange={(e) => setPoseSettings(prev => ({ ...prev, leftArmX: parseFloat(e.target.value) }))}
                                    className="w-full accent-cyan-600 cursor-pointer"
                                />
                            </div>

                            {/* Left Arm Y */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                    <span>LEFT ARM Y (TWIST)</span>
                                    <input
                                        type="number"
                                        value={poseSettings.leftArmY}
                                        onChange={(e) => setPoseSettings(prev => ({ ...prev, leftArmY: parseFloat(e.target.value) || 0 }))}
                                        className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-cyan-700 text-xs bg-white"
                                    />
                                </div>
                                <input
                                    type="range" min="-180" max="180" value={poseSettings.leftArmY}
                                    onChange={(e) => setPoseSettings(prev => ({ ...prev, leftArmY: parseFloat(e.target.value) }))}
                                    className="w-full accent-cyan-600 cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* SECTION 2: RIGHT ARM CONTROLS (X, Y, Z) */}
                        <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 space-y-2">
                            <h5 className="text-[11px] font-black text-indigo-800 uppercase tracking-wider">RIGHT ARM (X, Y, Z)</h5>

                            {/* Right Arm Z */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                    <span>RIGHT ARM Z (RAISE/LOWER)</span>
                                    <input
                                        type="number"
                                        value={poseSettings.rightArmZ}
                                        onChange={(e) => setPoseSettings(prev => ({ ...prev, rightArmZ: parseFloat(e.target.value) || 0 }))}
                                        className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-indigo-700 text-xs bg-white"
                                    />
                                </div>
                                <input
                                    type="range" min="-180" max="180" value={poseSettings.rightArmZ}
                                    onChange={(e) => setPoseSettings(prev => ({ ...prev, rightArmZ: parseFloat(e.target.value) }))}
                                    className="w-full accent-indigo-600 cursor-pointer"
                                />
                            </div>

                            {/* Right Arm X */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                    <span>RIGHT ARM X (FORWARD/BACK)</span>
                                    <input
                                        type="number"
                                        value={poseSettings.rightArmX}
                                        onChange={(e) => setPoseSettings(prev => ({ ...prev, rightArmX: parseFloat(e.target.value) || 0 }))}
                                        className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-indigo-700 text-xs bg-white"
                                    />
                                </div>
                                <input
                                    type="range" min="-180" max="180" value={poseSettings.rightArmX}
                                    onChange={(e) => setPoseSettings(prev => ({ ...prev, rightArmX: parseFloat(e.target.value) }))}
                                    className="w-full accent-indigo-600 cursor-pointer"
                                />
                            </div>

                            {/* Right Arm Y */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                    <span>RIGHT ARM Y (TWIST)</span>
                                    <input
                                        type="number"
                                        value={poseSettings.rightArmY}
                                        onChange={(e) => setPoseSettings(prev => ({ ...prev, rightArmY: parseFloat(e.target.value) || 0 }))}
                                        className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-indigo-700 text-xs bg-white"
                                    />
                                </div>
                                <input
                                    type="range" min="-180" max="180" value={poseSettings.rightArmY}
                                    onChange={(e) => setPoseSettings(prev => ({ ...prev, rightArmY: parseFloat(e.target.value) }))}
                                    className="w-full accent-indigo-600 cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* SECTION 3: LEFT LEG CONTROLS (X, Y, Z SLIDERS & INPUTS) */}
                        <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 space-y-2">
                            <h5 className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">LEFT LEG (X, Y, Z)</h5>

                            {/* Left Leg X */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                    <span>LEFT LEG X (FORWARD/BACK)</span>
                                    <input
                                        type="number" value={poseSettings.leftLegX}
                                        onChange={(e) => setPoseSettings(prev => ({ ...prev, leftLegX: parseFloat(e.target.value) || 0 }))}
                                        className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-emerald-700 text-xs bg-white"
                                    />
                                </div>
                                <input
                                    type="range" min="-180" max="180" value={poseSettings.leftLegX}
                                    onChange={(e) => setPoseSettings(prev => ({ ...prev, leftLegX: parseFloat(e.target.value) }))}
                                    className="w-full accent-emerald-600 cursor-pointer"
                                />
                            </div>

                            {/* Left Leg Y */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                    <span>LEFT LEG Y (TWIST)</span>
                                    <input
                                        type="number" value={poseSettings.leftLegY}
                                        onChange={(e) => setPoseSettings(prev => ({ ...prev, leftLegY: parseFloat(e.target.value) || 0 }))}
                                        className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-emerald-700 text-xs bg-white"
                                    />
                                </div>
                                <input
                                    type="range" min="-180" max="180" value={poseSettings.leftLegY}
                                    onChange={(e) => setPoseSettings(prev => ({ ...prev, leftLegY: parseFloat(e.target.value) }))}
                                    className="w-full accent-emerald-600 cursor-pointer"
                                />
                            </div>

                            {/* Left Leg Z */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                    <span>LEFT LEG Z (IN/OUT)</span>
                                    <input
                                        type="number" value={poseSettings.leftLegZ}
                                        onChange={(e) => setPoseSettings(prev => ({ ...prev, leftLegZ: parseFloat(e.target.value) || 0 }))}
                                        className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-emerald-700 text-xs bg-white"
                                    />
                                </div>
                                <input
                                    type="range" min="-180" max="180" value={poseSettings.leftLegZ}
                                    onChange={(e) => setPoseSettings(prev => ({ ...prev, leftLegZ: parseFloat(e.target.value) }))}
                                    className="w-full accent-emerald-600 cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* SECTION 4: RIGHT LEG CONTROLS (X, Y, Z SLIDERS & INPUTS) */}
                        <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 space-y-2">
                            <h5 className="text-[11px] font-black text-amber-800 uppercase tracking-wider">RIGHT LEG (X, Y, Z)</h5>

                            {/* Right Leg X */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                    <span>RIGHT LEG X (FORWARD/BACK)</span>
                                    <input
                                        type="number" value={poseSettings.rightLegX}
                                        onChange={(e) => setPoseSettings(prev => ({ ...prev, rightLegX: parseFloat(e.target.value) || 0 }))}
                                        className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-amber-700 text-xs bg-white"
                                    />
                                </div>
                                <input
                                    type="range" min="-180" max="180" value={poseSettings.rightLegX}
                                    onChange={(e) => setPoseSettings(prev => ({ ...prev, rightLegX: parseFloat(e.target.value) }))}
                                    className="w-full accent-amber-600 cursor-pointer"
                                />
                            </div>

                            {/* Right Leg Y */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                    <span>RIGHT LEG Y (TWIST)</span>
                                    <input
                                        type="number" value={poseSettings.rightLegY}
                                        onChange={(e) => setPoseSettings(prev => ({ ...prev, rightLegY: parseFloat(e.target.value) || 0 }))}
                                        className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-amber-700 text-xs bg-white"
                                    />
                                </div>
                                <input
                                    type="range" min="-180" max="180" value={poseSettings.rightLegY}
                                    onChange={(e) => setPoseSettings(prev => ({ ...prev, rightLegY: parseFloat(e.target.value) }))}
                                    className="w-full accent-amber-600 cursor-pointer"
                                />
                            </div>

                            {/* Right Leg Z */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800">
                                    <span>RIGHT LEG Z (IN/OUT)</span>
                                    <input
                                        type="number" value={poseSettings.rightLegZ}
                                        onChange={(e) => setPoseSettings(prev => ({ ...prev, rightLegZ: parseFloat(e.target.value) || 0 }))}
                                        className="w-14 text-right px-1 py-0.5 rounded border border-slate-300 font-mono font-black text-amber-700 text-xs bg-white"
                                    />
                                </div>
                                <input
                                    type="range" min="-180" max="180" value={poseSettings.rightLegZ}
                                    onChange={(e) => setPoseSettings(prev => ({ ...prev, rightLegZ: parseFloat(e.target.value) }))}
                                    className="w-full accent-amber-600 cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* SECTION 5: MODEL SCALE */}
                        <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                                <span>MODEL SCALE</span>
                                <input
                                    type="number" step="0.01" value={poseSettings.modelScale}
                                    onChange={(e) => setPoseSettings(prev => ({ ...prev, modelScale: parseFloat(e.target.value) || 0.28 }))}
                                    className="w-16 text-right px-1.5 py-0.5 rounded border border-slate-300 font-mono font-black text-cyan-700 text-xs bg-white"
                                />
                            </div>
                            <input
                                type="range" min="0.05" max="1.5" step="0.01" value={poseSettings.modelScale}
                                onChange={(e) => setPoseSettings(prev => ({ ...prev, modelScale: parseFloat(e.target.value) }))}
                                className="w-full accent-cyan-600 cursor-pointer"
                            />
                        </div>

                        {/* PICKED BODY PARTS INSPECTOR */}
                        <div className="border-t border-slate-200 pt-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <h5 className="text-[11px] font-black text-rose-700 uppercase tracking-wider flex items-center gap-1">
                                    <Crosshair size={14} />
                                    PICKED 3D BODY PARTS ({customParts.length})
                                </h5>
                            </div>

                            {customParts.length === 0 ? (
                                <p className="text-[10px] text-slate-500 italic bg-slate-50 p-2.5 rounded border border-dashed border-slate-300 text-center">
                                    Click "FREEZE & PICK PART" at the top, then click any 3D part on the character to inspect & rename!
                                </p>
                            ) : (
                                customParts.map((part) => (
                                    <div key={part.id} className="bg-slate-100 p-2.5 rounded-xl border border-slate-300 space-y-2">
                                        <div className="flex items-center justify-between gap-1">
                                            <input
                                                type="text"
                                                value={part.displayName}
                                                onChange={(e) => {
                                                    const name = e.target.value;
                                                    setCustomParts(prev => prev.map(p => p.id === part.id ? { ...p, displayName: name } : p));
                                                }}
                                                className="w-full px-2 py-0.5 text-xs font-black text-slate-900 bg-white border border-slate-300 rounded"
                                            />
                                            <button
                                                onClick={() => setCustomParts(prev => prev.filter(p => p.id !== part.id))}
                                                className="text-rose-600 hover:bg-rose-100 p-1 rounded cursor-pointer"
                                                title="Delete Part"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                                            <div>
                                                <span className="font-bold text-slate-600">ROT X</span>
                                                <input
                                                    type="number" value={part.rotX}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        setCustomParts(prev => prev.map(p => p.id === part.id ? { ...p, rotX: val } : p));
                                                    }}
                                                    className="w-full px-1 py-0.5 font-mono text-center font-black bg-white border border-slate-300 rounded"
                                                />
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-600">ROT Y</span>
                                                <input
                                                    type="number" value={part.rotY}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        setCustomParts(prev => prev.map(p => p.id === part.id ? { ...p, rotY: val } : p));
                                                    }}
                                                    className="w-full px-1 py-0.5 font-mono text-center font-black bg-white border border-slate-300 rounded"
                                                />
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-600">ROT Z</span>
                                                <input
                                                    type="number" value={part.rotZ} onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        setCustomParts(prev => prev.map(p => p.id === part.id ? { ...p, rotZ: val } : p));
                                                    }}
                                                    className="w-full px-1 py-0.5 font-mono text-center font-black bg-white border border-slate-300 rounded"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        </>
                        )}
                    </div>
                )}

                {/* ========================================================================= */}
                {/* 1. 3D CHARACTER SELECTOR & ANIMATION STUDIO (FULL SCREEN BIG CENTER CARD) */}
                {/* ========================================================================= */}
                {showCharacterModal && (
                    <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
                        <div className="bg-slate-950/95 border-2 border-indigo-500/80 rounded-3xl w-full h-full max-w-[1450px] max-h-[96vh] overflow-hidden shadow-[0_0_100px_rgba(99,102,241,0.35)] flex flex-col font-mono">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 px-6 py-3 border-b border-indigo-500/40 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-400/50 flex items-center justify-center text-indigo-300">
                                        <User size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-sm sm:text-base uppercase tracking-widest text-white flex items-center gap-2">
                                            <span>3D CHARACTER & EMOTE STUDIO</span>
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-400/40">
                                                {CHARACTER_OPTIONS[selectedCharIndex].badge}
                                            </span>
                                        </h3>
                                        <span className="text-[10px] font-mono text-slate-400">
                                            {selectedCharIndex + 1} of {CHARACTER_OPTIONS.length} • {CHARACTER_OPTIONS[selectedCharIndex].name}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowCharacterModal(false)}
                                    className="w-9 h-9 rounded-full bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-all cursor-pointer shadow-md hover:scale-105"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Full-Screen Main Content Stage */}
                            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                                {/* BIG CENTER 3D CHARACTER STAGE */}
                                <div className="flex-1 relative flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950 p-2 sm:p-4 overflow-hidden">
                                    {/* Left Arrow Button */}
                                    <button
                                        onClick={() => {
                                            const nextIdx = (selectedCharIndex - 1 + CHARACTER_OPTIONS.length) % CHARACTER_OPTIONS.length;
                                            setSelectedCharIndex(nextIdx);
                                            const nextChar = CHARACTER_OPTIONS[nextIdx];
                                            const newPose = loadCharacterPose(nextChar.modelUrl);
                                            const newEmotes = loadCharacterEmotes(nextChar.modelUrl);
                                            setPoseSettings(newPose);
                                            setPreviewModelScale(newPose.modelScale || 0.85);
                                            setCustomEmoteTracks(newEmotes);
                                        }}
                                        className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-indigo-950/80 border-2 border-indigo-500/70 hover:bg-indigo-600 text-white flex items-center justify-center cursor-pointer shadow-[0_0_25px_rgba(99,102,241,0.5)] hover:scale-110 active:scale-95 transition-all"
                                        title="Previous Character"
                                    >
                                        <ChevronLeft size={28} />
                                    </button>

                                    {/* Right Arrow Button */}
                                    <button
                                        onClick={() => {
                                            const nextIdx = (selectedCharIndex + 1) % CHARACTER_OPTIONS.length;
                                            setSelectedCharIndex(nextIdx);
                                            const nextChar = CHARACTER_OPTIONS[nextIdx];
                                            const newPose = loadCharacterPose(nextChar.modelUrl);
                                            const newEmotes = loadCharacterEmotes(nextChar.modelUrl);
                                            setPoseSettings(newPose);
                                            setPreviewModelScale(newPose.modelScale || 0.85);
                                            setCustomEmoteTracks(newEmotes);
                                        }}
                                        className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-indigo-950/80 border-2 border-indigo-500/70 hover:bg-indigo-600 text-white flex items-center justify-center cursor-pointer shadow-[0_0_25px_rgba(99,102,241,0.5)] hover:scale-110 active:scale-95 transition-all"
                                        title="Next Character"
                                    >
                                        <ChevronRight size={28} />
                                    </button>

                                    {/* Huge 3D Character Viewport */}
                                    <div className="w-full h-full flex-1 max-w-4xl relative rounded-2xl overflow-hidden border border-indigo-500/30 shadow-2xl bg-black/40">
                                        <CharacterPreview3D
                                            key={CHARACTER_OPTIONS[selectedCharIndex].modelUrl}
                                            modelUrl={CHARACTER_OPTIONS[selectedCharIndex].modelUrl}
                                            poseSettings={poseSettings}
                                            modelScale={previewModelScale}
                                            autoRotate={previewAutoRotate}
                                            activeEmote={previewActiveEmote}
                                            isPaused={previewIsPaused}
                                            manualScrubProgress={previewScrubProgress}
                                            customKeyframes={previewActiveEmote !== 'none' ? customEmoteTracks[previewActiveEmote] : undefined}
                                            onLiveCoordsUpdate={(data) => setLiveCoords(data)}
                                            className="w-full h-full"
                                        />

                                        {/* Character Info Overlay & Auto-Rotate Toggle */}
                                        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-auto">
                                            <div className="bg-black/75 backdrop-blur-md px-3.5 py-2 rounded-xl border border-indigo-500/40">
                                                <h4 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                                                    {CHARACTER_OPTIONS[selectedCharIndex].name}
                                                </h4>
                                                <p className="text-[10px] text-indigo-300 font-bold">
                                                    {CHARACTER_OPTIONS[selectedCharIndex].subtitle}
                                                </p>
                                            </div>

                                            {/* Auto-Rotate Stop / Resume Toggle */}
                                            <button
                                                onClick={() => setPreviewAutoRotate(!previewAutoRotate)}
                                                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md w-fit ${previewAutoRotate
                                                    ? 'bg-indigo-600 text-white border border-indigo-400'
                                                    : 'bg-black/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
                                                    }`}
                                            >
                                                <RotateCw size={12} className={previewAutoRotate ? 'animate-spin' : ''} />
                                                <span>{previewAutoRotate ? 'AUTO-ROTATE: ON' : 'STOP AUTO-ROTATE (FROZEN)'}</span>
                                            </button>
                                        </div>

                                        {/* Emote Selector & Play/Pause/Stop Scrubber Control Bar Overlay */}
                                        <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-2 bg-black/80 backdrop-blur-lg p-3 rounded-2xl border border-indigo-500/50 shadow-2xl">
                                            {/* Emote Select Tabs */}
                                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                                                <span className="text-[9px] font-black text-cyan-300 uppercase tracking-widest flex items-center gap-1">
                                                    <span>🎬 EMOTE SETTING:</span>
                                                </span>
                                                <div className="flex flex-wrap items-center gap-1">
                                                    {(['none', 'walk', 'door', 'scanner', 'jump'] as const).map((emoteKey) => (
                                                        <button
                                                            key={emoteKey}
                                                            onClick={() => {
                                                                setPreviewActiveEmote(emoteKey);
                                                                setPreviewIsPaused(false);
                                                                setPreviewScrubProgress(-1);
                                                            }}
                                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${previewActiveEmote === emoteKey
                                                                ? 'bg-indigo-600 text-white ring-1 ring-indigo-400 shadow-md'
                                                                : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-700'
                                                                }`}
                                                        >
                                                            {emoteKey === 'none' ? '🧍 IDLE' : emoteKey === 'walk' ? '🚶 WALK' : emoteKey === 'door' ? '🚪 DOOR' : emoteKey === 'scanner' ? '🖐 SCANNER' : '🦘 JUMP'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Playback Controls & Timeline Scrubber */}
                                            {previewActiveEmote !== 'none' && (
                                                <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800">
                                                    <button
                                                        onClick={() => {
                                                            setPreviewIsPaused(!previewIsPaused);
                                                            setPreviewScrubProgress(-1);
                                                        }}
                                                        className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${previewIsPaused
                                                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                                            : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                                            }`}
                                                        title={previewIsPaused ? 'Resume Playback' : 'Pause Animation'}
                                                    >
                                                        {previewIsPaused ? <Play size={14} /> : <Pause size={14} />}
                                                        <span>{previewIsPaused ? 'PLAY' : 'PAUSE'}</span>
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            setPreviewActiveEmote('none');
                                                            setPreviewIsPaused(false);
                                                            setPreviewScrubProgress(-1);
                                                        }}
                                                        className="p-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-rose-900 text-slate-200 hover:text-white transition-all cursor-pointer flex items-center gap-1 border border-slate-700"
                                                        title="Stop Emote"
                                                    >
                                                        <Square size={14} />
                                                        <span>STOP</span>
                                                    </button>

                                                    {/* Timeline Scrubber */}
                                                    <div className="flex-1 flex items-center gap-2">
                                                        <span className="text-[9px] font-mono text-cyan-300 whitespace-nowrap">
                                                            {liveCoords.stageName}
                                                        </span>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="1"
                                                            step="0.01"
                                                            value={previewScrubProgress >= 0 ? previewScrubProgress : liveCoords.progress}
                                                            onChange={(e) => {
                                                                setPreviewIsPaused(true);
                                                                setPreviewScrubProgress(parseFloat(e.target.value));
                                                            }}
                                                            className="flex-1 accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                                                        />
                                                        <span className="text-[9px] font-mono text-slate-400 w-9 text-right">
                                                            {Math.round((previewScrubProgress >= 0 ? previewScrubProgress : liveCoords.progress) * 100)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT SIDEBAR: MODEL SCALE, KEYFRAMES STUDIO BUTTON & SLIDER BARS FOR ALL LIMBS & JOINTS */}
                                <div className="w-full lg:w-[480px] border-t lg:border-t-0 lg:border-l border-indigo-500/40 bg-slate-900/95 p-4 flex flex-col gap-3 overflow-y-auto max-h-[48vh] lg:max-h-full">
                                    {/* Sidebar Header */}
                                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                        <div className="flex items-center gap-1.5 text-xs font-black text-cyan-300 uppercase tracking-wider">
                                            <Sliders size={14} />
                                            <span>STUDIO & EMOTE SETTINGS</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const currentChar = CHARACTER_OPTIONS[selectedCharIndex];
                                                const defPose = getCharacterDefaultPose(currentChar.modelUrl);
                                                const defEmotes = getCharacterDefinition(currentChar.modelUrl).emotes;
                                                setPoseSettings(defPose);
                                                setPreviewModelScale(defPose.modelScale || 0.85);
                                                setCustomEmoteTracks(defEmotes);
                                                saveCharacterPose(currentChar.modelUrl, defPose);
                                                saveCharacterEmotes(currentChar.modelUrl, defEmotes);
                                                if (characterRef.current && activeCharModelUrl === currentChar.modelUrl) {
                                                    characterRef.current.updatePoseSettings(defPose);
                                                    characterRef.current.setEmoteTracks(defEmotes);
                                                }
                                            }}
                                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer border border-slate-700"
                                        >
                                            RESET ALL
                                        </button>
                                    </div>

                                    {/* 1. MODEL SCALE SLIDER BAR */}
                                    <div className="bg-slate-950/90 p-3 rounded-xl border border-indigo-500/40 space-y-1.5 shadow-md">
                                        <div className="flex items-center justify-between text-[10px] font-black text-cyan-300 uppercase tracking-wider">
                                            <span>🔍 MODEL SCALE SIZE</span>
                                            <span className="font-mono text-cyan-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                                {previewModelScale.toFixed(2)}x
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range"
                                                min="0.5"
                                                max="4.0"
                                                step="0.01"
                                                value={previewModelScale}
                                                onChange={(e) => {
                                                    const s = parseFloat(e.target.value);
                                                    setPreviewModelScale(s);
                                                    setPoseSettings(prev => ({ ...prev, modelScale: s }));
                                                }}
                                                className="flex-1 accent-cyan-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                                            />
                                            <input
                                                type="number"
                                                min="0.1"
                                                max="10.0"
                                                step="0.01"
                                                value={previewModelScale}
                                                onChange={(e) => {
                                                    const s = Math.max(0.1, Math.min(10.0, parseFloat(e.target.value) || 1.73));
                                                    setPreviewModelScale(s);
                                                    setPoseSettings(prev => ({ ...prev, modelScale: s }));
                                                }}
                                                className="w-14 text-center font-mono font-bold text-cyan-300 bg-slate-900 border border-slate-700 rounded text-xs py-0.5"
                                            />
                                        </div>
                                    </div>

                                    {/* 2. ANIMATION KEYFRAMES & FULL STUDIO OPENER */}
                                    <div className="bg-slate-950 p-3 rounded-xl border-2 border-cyan-500/50 space-y-2 shadow-inner">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                                                <span>🎬 EMOTE COORDINATES</span>
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => setShowKeyframeStudioModal(true)}
                                                    className="text-[9px] font-black px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer flex items-center gap-1 shadow-md border border-indigo-400"
                                                >
                                                    <Edit3 size={11} />
                                                    <span>EDIT KEYFRAMES</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const trackData = customEmoteTracks[previewActiveEmote] || null;
                                                        const text = JSON.stringify({
                                                            selectedEmote: previewActiveEmote,
                                                            currentStage: liveCoords.stageName,
                                                            progress: liveCoords.progress,
                                                            modelScale: previewModelScale,
                                                            keyframeSequence: trackData,
                                                            liveCurrentCoordinates: liveCoords,
                                                            customLimbsPose: poseSettings
                                                        }, null, 2);
                                                        navigator.clipboard?.writeText(text);
                                                        setCopiedKeyframes(true);
                                                        setTimeout(() => setCopiedKeyframes(false), 2000);
                                                    }}
                                                    className={`text-[9px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${copiedKeyframes
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                                        }`}
                                                >
                                                    {copiedKeyframes ? <CheckCheck size={11} /> : <Copy size={11} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* LIVE Dynamic Real-time Coordinates Box */}
                                        <div className="bg-slate-900 p-2.5 rounded-lg border-2 border-cyan-400/50 text-[9px] font-mono space-y-1">
                                            <div className="font-bold text-cyan-300 flex items-center justify-between">
                                                <span>LIVE REAL-TIME TRACKING</span>
                                                <span className="text-[8px] bg-cyan-950 px-1.5 py-0.5 rounded text-cyan-400 animate-pulse font-bold">
                                                    {liveCoords.stageName}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1 text-slate-300 text-[8.5px]">
                                                <div>LA: <span className="text-cyan-300 font-bold">X:{liveCoords.la.x}° Y:{liveCoords.la.y}° Z:{liveCoords.la.z}°</span></div>
                                                <div>RA: <span className="text-cyan-300 font-bold">X:{liveCoords.ra.x}° Y:{liveCoords.ra.y}° Z:{liveCoords.ra.z}°</span></div>
                                                <div>LE: <span className="text-indigo-300 font-bold">X:{liveCoords.le?.x ?? 0}° Y:{liveCoords.le?.y ?? 0}° Z:{liveCoords.le?.z ?? 0}°</span></div>
                                                <div>RE: <span className="text-purple-300 font-bold">X:{liveCoords.re?.x ?? 0}° Y:{liveCoords.re?.y ?? 0}° Z:{liveCoords.re?.z ?? 0}°</span></div>
                                                <div>LL: <span className="text-emerald-300 font-bold">X:{liveCoords.ll.x}° Y:{liveCoords.ll.y}° Z:{liveCoords.ll.z}°</span></div>
                                                <div>RL: <span className="text-amber-300 font-bold">X:{liveCoords.rl.x}° Y:{liveCoords.rl.y}° Z:{liveCoords.rl.z}°</span></div>
                                                <div>LK: <span className="text-teal-300 font-bold">X:{liveCoords.lk?.x ?? 0}° Y:{liveCoords.lk?.y ?? 0}° Z:{liveCoords.lk?.z ?? 0}°</span></div>
                                                <div>RK: <span className="text-orange-300 font-bold">X:{liveCoords.rk?.x ?? 0}° Y:{liveCoords.rk?.y ?? 0}° Z:{liveCoords.rk?.z ?? 0}°</span></div>
                                            </div>
                                        </div>

                                        {/* Expandable Studio Button */}
                                        <button
                                            onClick={() => setShowKeyframeStudioModal(true)}
                                            className="w-full py-1.5 rounded-lg bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 hover:from-indigo-900 hover:to-indigo-900 border border-indigo-500/50 text-[10px] font-black text-cyan-300 hover:text-white uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                                        >
                                            <Sliders size={12} />
                                            <span>OPEN FULL KEYFRAME COORDINATION MATRIX & BARS</span>
                                        </button>
                                    </div>

                                    {/* 3. SLIDER TRACK BARS FOR ALL LIMBS & JOINTS SETTINGS */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                MANUAL LIMBS & JOINTS ROTATION (-180° to +180°)
                                            </span>
                                        </div>

                                        {/* Left Arm & Elbow/Hand Joint */}
                                        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-indigo-900/60 space-y-2">
                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                                <span>LEFT ARM (SHOULDER X, Y, Z)</span>
                                            </span>
                                            {(['leftArmX', 'leftArmY', 'leftArmZ'] as const).map(axis => {
                                                const axisLetter = axis.replace('leftArm', '').toUpperCase();
                                                const val = poseSettings[axis] || 0;
                                                return (
                                                    <div key={axis} className="space-y-1 bg-slate-900/90 p-1.5 rounded-lg border border-slate-800">
                                                        <div className="flex items-center justify-between text-[10px] font-bold">
                                                            <span className="text-indigo-300">ARM {axisLetter}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono text-[9px] text-cyan-300 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{val}°</span>
                                                                <input type="number" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-12 text-center font-mono font-bold text-indigo-300 bg-slate-950 border border-slate-700 rounded text-[9px] py-0.5" />
                                                            </div>
                                                        </div>
                                                        <input type="range" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                    </div>
                                                );
                                            })}

                                            <div className="border-t border-indigo-900/40 pt-1.5 mt-1.5">
                                                <span className="text-[9.5px] font-black text-indigo-300 uppercase tracking-wider">LEFT ELBOW / HAND JOINT</span>
                                                {(['leftElbowX', 'leftElbowY', 'leftElbowZ'] as const).map(axis => {
                                                    const axisLetter = axis.replace('leftElbow', '').toUpperCase();
                                                    const val = (poseSettings as any)[axis] || 0;
                                                    return (
                                                        <div key={axis} className="space-y-1 bg-slate-900/70 p-1.5 rounded-lg border border-slate-800 mt-1">
                                                            <div className="flex items-center justify-between text-[9px] font-bold">
                                                                <span className="text-indigo-400">ELBOW/HAND {axisLetter}</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-mono text-[8.5px] text-cyan-300 font-bold bg-slate-950 px-1.5 py-0.5 rounded">{val}°</span>
                                                                    <input type="number" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-11 text-center font-mono font-bold text-indigo-300 bg-slate-950 border border-slate-700 rounded text-[8.5px] py-0.5" />
                                                                </div>
                                                            </div>
                                                            <input type="range" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-full accent-indigo-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Right Arm & Elbow/Hand Joint */}
                                        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-cyan-900/60 space-y-2">
                                            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                                                <span>RIGHT ARM (SHOULDER X, Y, Z)</span>
                                            </span>
                                            {(['rightArmX', 'rightArmY', 'rightArmZ'] as const).map(axis => {
                                                const axisLetter = axis.replace('rightArm', '').toUpperCase();
                                                const val = poseSettings[axis] || 0;
                                                return (
                                                    <div key={axis} className="space-y-1 bg-slate-900/90 p-1.5 rounded-lg border border-slate-800">
                                                        <div className="flex items-center justify-between text-[10px] font-bold">
                                                            <span className="text-cyan-300">ARM {axisLetter}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono text-[9px] text-cyan-300 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{val}°</span>
                                                                <input type="number" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-12 text-center font-mono font-bold text-cyan-300 bg-slate-950 border border-slate-700 rounded text-[9px] py-0.5" />
                                                            </div>
                                                        </div>
                                                        <input type="range" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                    </div>
                                                );
                                            })}

                                            <div className="border-t border-cyan-900/40 pt-1.5 mt-1.5">
                                                <span className="text-[9.5px] font-black text-cyan-300 uppercase tracking-wider">RIGHT ELBOW / HAND JOINT</span>
                                                {(['rightElbowX', 'rightElbowY', 'rightElbowZ'] as const).map(axis => {
                                                    const axisLetter = axis.replace('rightElbow', '').toUpperCase();
                                                    const val = (poseSettings as any)[axis] || 0;
                                                    return (
                                                        <div key={axis} className="space-y-1 bg-slate-900/70 p-1.5 rounded-lg border border-slate-800 mt-1">
                                                            <div className="flex items-center justify-between text-[9px] font-bold">
                                                                <span className="text-cyan-400">ELBOW/HAND {axisLetter}</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-mono text-[8.5px] text-cyan-300 font-bold bg-slate-950 px-1.5 py-0.5 rounded">{val}°</span>
                                                                    <input type="number" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-11 text-center font-mono font-bold text-cyan-300 bg-slate-950 border border-slate-700 rounded text-[8.5px] py-0.5" />
                                                                </div>
                                                            </div>
                                                            <input type="range" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Left Leg & Knee Joint */}
                                        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-emerald-900/60 space-y-2">
                                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                                <span>LEFT LEG (THIGH X, Y, Z)</span>
                                            </span>
                                            {(['leftLegX', 'leftLegY', 'leftLegZ'] as const).map(axis => {
                                                const axisLetter = axis.replace('leftLeg', '').toUpperCase();
                                                const val = poseSettings[axis] || 0;
                                                return (
                                                    <div key={axis} className="space-y-1 bg-slate-900/90 p-1.5 rounded-lg border border-slate-800">
                                                        <div className="flex items-center justify-between text-[10px] font-bold">
                                                            <span className="text-emerald-300">LEG {axisLetter}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono text-[9px] text-emerald-300 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{val}°</span>
                                                                <input type="number" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-12 text-center font-mono font-bold text-emerald-300 bg-slate-950 border border-slate-700 rounded text-[9px] py-0.5" />
                                                            </div>
                                                        </div>
                                                        <input type="range" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                    </div>
                                                );
                                            })}

                                            <div className="border-t border-emerald-900/40 pt-1.5 mt-1.5">
                                                <span className="text-[9.5px] font-black text-emerald-300 uppercase tracking-wider">LEFT KNEE / SHIN JOINT</span>
                                                {(['leftKneeX', 'leftKneeY', 'leftKneeZ'] as const).map(axis => {
                                                    const axisLetter = axis.replace('leftKnee', '').toUpperCase();
                                                    const val = (poseSettings as any)[axis] || 0;
                                                    return (
                                                        <div key={axis} className="space-y-1 bg-slate-900/70 p-1.5 rounded-lg border border-slate-800 mt-1">
                                                            <div className="flex items-center justify-between text-[9px] font-bold">
                                                                <span className="text-emerald-400">KNEE {axisLetter}</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-mono text-[8.5px] text-emerald-300 font-bold bg-slate-950 px-1.5 py-0.5 rounded">{val}°</span>
                                                                    <input type="number" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-11 text-center font-mono font-bold text-emerald-300 bg-slate-950 border border-slate-700 rounded text-[8.5px] py-0.5" />
                                                                </div>
                                                            </div>
                                                            <input type="range" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Right Leg & Knee Joint */}
                                        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-amber-900/60 space-y-2">
                                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                                <span>RIGHT LEG (THIGH X, Y, Z)</span>
                                            </span>
                                            {(['rightLegX', 'rightLegY', 'rightLegZ'] as const).map(axis => {
                                                const axisLetter = axis.replace('rightLeg', '').toUpperCase();
                                                const val = poseSettings[axis] || 0;
                                                return (
                                                    <div key={axis} className="space-y-1 bg-slate-900/90 p-1.5 rounded-lg border border-slate-800">
                                                        <div className="flex items-center justify-between text-[10px] font-bold">
                                                            <span className="text-amber-300">LEG {axisLetter}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono text-[9px] text-amber-300 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{val}°</span>
                                                                <input type="number" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-12 text-center font-mono font-bold text-amber-300 bg-slate-950 border border-slate-700 rounded text-[9px] py-0.5" />
                                                            </div>
                                                        </div>
                                                        <input type="range" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                    </div>
                                                );
                                            })}

                                            <div className="border-t border-amber-900/40 pt-1.5 mt-1.5">
                                                <span className="text-[9.5px] font-black text-amber-300 uppercase tracking-wider">RIGHT KNEE / SHIN JOINT</span>
                                                {(['rightKneeX', 'rightKneeY', 'rightKneeZ'] as const).map(axis => {
                                                    const axisLetter = axis.replace('rightKnee', '').toUpperCase();
                                                    const val = (poseSettings as any)[axis] || 0;
                                                    return (
                                                        <div key={axis} className="space-y-1 bg-slate-900/70 p-1.5 rounded-lg border border-slate-800 mt-1">
                                                            <div className="flex items-center justify-between text-[9px] font-bold">
                                                                <span className="text-amber-400">KNEE {axisLetter}</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-mono text-[8.5px] text-amber-300 font-bold bg-slate-950 px-1.5 py-0.5 rounded">{val}°</span>
                                                                    <input type="number" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-11 text-center font-mono font-bold text-amber-300 bg-slate-950 border border-slate-700 rounded text-[8.5px] py-0.5" />
                                                                </div>
                                                            </div>
                                                            <input type="range" min="-180" max="180" value={val} onChange={(e) => setPoseSettings(prev => ({ ...prev, [axis]: parseFloat(e.target.value) || 0 }))} className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Action Bar */}
                            <div className="bg-slate-950 px-6 py-3 border-t border-indigo-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                                        Active Model: <span className="text-cyan-400 font-bold">{CHARACTER_OPTIONS[selectedCharIndex].modelUrl}</span>
                                    </span>
                                </div>

                                <button
                                    onClick={() => handleSelectCharacter(selectedCharIndex)}
                                    className={`px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 shadow-xl transition-all cursor-pointer ${activeCharModelUrl === CHARACTER_OPTIONS[selectedCharIndex].modelUrl
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/30 ring-2 ring-emerald-400'
                                        : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white shadow-indigo-500/40 ring-1 ring-indigo-400/50 hover:scale-105'
                                        }`}
                                >
                                    {activeCharModelUrl === CHARACTER_OPTIONS[selectedCharIndex].modelUrl ? (
                                        <>
                                            <Check size={16} />
                                            <span>EQUIPPED</span>
                                        </>
                                    ) : (
                                        <span>EQUIP CHARACTER</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* 1.5 FULL KEYFRAME COORDINATION STUDIO MODAL (WITH 3D VIEWPORT ON LEFT)     */}
                {/* ========================================================================= */}
                {showKeyframeStudioModal && (
                    <div className="fixed inset-0 z-[2200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
                        <div className="bg-slate-950 border-2 border-cyan-500/80 rounded-3xl w-full h-full max-w-7xl max-h-[95vh] overflow-hidden shadow-[0_0_100px_rgba(6,182,212,0.4)] flex flex-col font-mono">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-indigo-950 via-cyan-950 to-slate-950 px-6 py-3 border-b border-cyan-500/40 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-cyan-600/30 border border-cyan-400/50 flex items-center justify-center text-cyan-300">
                                        <Activity size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-sm sm:text-base uppercase tracking-widest text-white flex items-center gap-2">
                                            <span>EMOTE KEYFRAME FULL COORDINATION STUDIO</span>
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/30 text-cyan-300 border border-cyan-400/40">
                                                LIVE 3D & PERCENTAGE MATRIX
                                            </span>
                                        </h3>
                                        <span className="text-[10px] font-mono text-slate-400">
                                            Editing Emote: <span className="text-cyan-300 font-bold uppercase">{previewActiveEmote === 'none' ? 'walk' : previewActiveEmote}</span>
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowKeyframeStudioModal(false)}
                                    className="w-9 h-9 rounded-full bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-all cursor-pointer shadow-md hover:scale-105"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Toolbar & Auto-Replication Control */}
                            <div className="bg-slate-900/90 px-6 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                                {/* Emote Selector Tabs */}
                                <div className="flex items-center gap-1">
                                    {(['walk', 'door', 'scanner', 'jump'] as const).map(emoteKey => (
                                        <button
                                            key={emoteKey}
                                            onClick={() => {
                                                setPreviewActiveEmote(emoteKey);
                                                setSelectedKeyframeIndex(0);
                                            }}
                                            className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${(previewActiveEmote === emoteKey || (previewActiveEmote === 'none' && emoteKey === 'walk'))
                                                ? 'bg-cyan-600 text-white shadow-md ring-1 ring-cyan-400'
                                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                                }`}
                                        >
                                            {emoteKey === 'walk' ? '🚶 WALK' : emoteKey === 'door' ? '🚪 DOOR' : emoteKey === 'scanner' ? '🖐 SCANNER' : '🦘 JUMP'}
                                        </button>
                                    ))}
                                </div>

                                {/* AUTO-REPLICATION TOGGLE SWITCH */}
                                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-cyan-500/40">
                                    <button
                                        onClick={() => setAutoPropagateOffsets(!autoPropagateOffsets)}
                                        className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${autoPropagateOffsets
                                            ? 'bg-emerald-600 text-white ring-1 ring-emerald-400 shadow-md'
                                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                                            }`}
                                    >
                                        <Zap size={14} className={autoPropagateOffsets ? 'animate-bounce' : ''} />
                                        <span>{autoPropagateOffsets ? '⚡ AUTO-REPLICATE TO OTHER %: ON' : 'MANUAL % EDIT: ONLY THIS FRAME'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Auto-Replication Hint Banner */}
                            <div className="bg-cyan-950/30 px-6 py-1.5 border-b border-cyan-900/40 text-[10px] text-cyan-300 flex items-center justify-between">
                                <span>
                                    💡 {autoPropagateOffsets
                                        ? 'Auto-Replicate is ON: Adjusting 0% (e.g. +20° in X) automatically shifts all subsequent percentages proportionally!'
                                        : 'Manual Mode: Changes only affect the selected percentage keyframe.'}
                                </span>
                                <span className="font-bold text-slate-400 hidden sm:inline">
                                    Live 3D character on left updates in real time!
                                </span>
                            </div>

                            {/* Main Studio Body: 3D VIEWPORT ON LEFT + PERCENTAGES & SLIDERS ON RIGHT */}
                            {(() => {
                                const currentChar = CHARACTER_OPTIONS[selectedCharIndex];
                                const def = getCharacterDefinition(currentChar?.modelUrl);
                                const currentEmoteKey = previewActiveEmote === 'none' ? 'walk' : previewActiveEmote;
                                const track = customEmoteTracks[currentEmoteKey] || def.emotes[currentEmoteKey] || [];
                                const currentKf = track[selectedKeyframeIndex] || track[0];

                                return (
                                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                                        {/* LEFT SIDE: LIVE 3D CHARACTER PREVIEW VIEWPORT */}
                                        <div className="w-full lg:w-[45%] h-[300px] lg:h-full relative border-b lg:border-b-0 lg:border-r border-cyan-500/30 bg-black/60 flex flex-col">
                                            <CharacterPreview3D
                                                key={`studio-${CHARACTER_OPTIONS[selectedCharIndex].modelUrl}`}
                                                modelUrl={CHARACTER_OPTIONS[selectedCharIndex].modelUrl}
                                                poseSettings={poseSettings}
                                                modelScale={previewModelScale}
                                                autoRotate={previewAutoRotate}
                                                activeEmote={currentEmoteKey}
                                                isPaused={previewIsPaused}
                                                manualScrubProgress={previewScrubProgress}
                                                customKeyframes={track}
                                                onLiveCoordsUpdate={(data) => setLiveCoords(data)}
                                                className="w-full h-full flex-1"
                                            />

                                            {/* Top Overlay: Model Info & Auto-Rotate Toggle */}
                                            <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-auto">
                                                <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-cyan-500/40">
                                                    <h4 className="text-xs font-black text-white uppercase tracking-wider">
                                                        {CHARACTER_OPTIONS[selectedCharIndex].name}
                                                    </h4>
                                                </div>
                                                <button
                                                    onClick={() => setPreviewAutoRotate(!previewAutoRotate)}
                                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-md w-fit ${previewAutoRotate
                                                        ? 'bg-cyan-600 text-white border border-cyan-400'
                                                        : 'bg-black/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
                                                        }`}
                                                >
                                                    <RotateCw size={11} className={previewAutoRotate ? 'animate-spin' : ''} />
                                                    <span>{previewAutoRotate ? 'AUTO-ROTATE: ON' : 'FROZEN'}</span>
                                                </button>
                                            </div>

                                            {/* Bottom Overlay: Play/Pause/Stop Scrubber Toolbar */}
                                            <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-col gap-1.5 bg-black/85 backdrop-blur-lg p-2.5 rounded-xl border border-cyan-500/50 shadow-2xl">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setPreviewIsPaused(!previewIsPaused);
                                                            setPreviewScrubProgress(-1);
                                                        }}
                                                        className={`p-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${previewIsPaused
                                                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                                            : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                                            }`}
                                                    >
                                                        {previewIsPaused ? <Play size={12} /> : <Pause size={12} />}
                                                        <span>{previewIsPaused ? 'PLAY' : 'PAUSE'}</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setPreviewIsPaused(false);
                                                            setPreviewScrubProgress(-1);
                                                        }}
                                                        className="p-1.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                                                    >
                                                        <Square size={12} />
                                                        <span>LOOP</span>
                                                    </button>
                                                    <div className="flex-1 flex items-center gap-1.5">
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="1"
                                                            step="0.01"
                                                            value={previewScrubProgress >= 0 ? previewScrubProgress : liveCoords.progress}
                                                            onChange={(e) => {
                                                                setPreviewIsPaused(true);
                                                                setPreviewScrubProgress(parseFloat(e.target.value));
                                                            }}
                                                            className="flex-1 accent-cyan-500 cursor-pointer h-1.5"
                                                        />
                                                        <span className="text-[9px] font-mono text-cyan-300 w-8 text-right font-bold">
                                                            {Math.round((previewScrubProgress >= 0 ? previewScrubProgress : liveCoords.progress) * 100)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* MIDDLE: PERCENTAGE TIMELINE LIST */}
                                        <div className="w-full lg:w-48 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950/70 p-3 flex flex-col gap-2 overflow-y-auto shrink-0">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                KEYFRAME %
                                            </span>
                                            <div className="space-y-1.5">
                                                {track.map((kf, idx) => {
                                                    const isSelected = selectedKeyframeIndex === idx;
                                                    return (
                                                        <button
                                                            key={kf.percentage}
                                                            onClick={() => {
                                                                setSelectedKeyframeIndex(idx);
                                                                setPreviewScrubProgress(kf.percentage / 100);
                                                                setPreviewIsPaused(true);
                                                            }}
                                                            className={`w-full text-left p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${isSelected
                                                                ? 'bg-cyan-950/90 border-cyan-400 text-white shadow-lg ring-1 ring-cyan-500/50'
                                                                : 'bg-slate-900/70 hover:bg-slate-800 border-slate-800 text-slate-300'
                                                                }`}
                                                        >
                                                            <div>
                                                                <div className="font-black text-xs text-white">
                                                                    {kf.percentage}% {idx === 0 ? '(START)' : idx === track.length - 1 ? '(END)' : ''}
                                                                </div>
                                                                <div className="text-[8.5px] text-slate-400">
                                                                    {kf.name || `${kf.percentage}% Frame`}
                                                                </div>
                                                            </div>
                                                            <div className="font-mono text-[8.5px] text-cyan-400 font-bold bg-slate-950 px-1 py-0.5 rounded border border-slate-800">
                                                                Z:{kf.ll?.z ?? kf.la?.z ?? 0}°
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Reset to Default Button */}
                                            <button
                                                onClick={() => {
                                                    const defTrack = def.emotes[currentEmoteKey] || DEFAULT_EMOTE_TRACKS[currentEmoteKey] || [];
                                                    setCustomEmoteTracks(prev => {
                                                        const next = {
                                                            ...prev,
                                                            [currentEmoteKey]: defTrack
                                                        };
                                                        if (currentChar) {
                                                            saveCharacterEmotes(currentChar.modelUrl, next);
                                                        }
                                                        if (characterRef.current && activeCharModelUrl === currentChar?.modelUrl) {
                                                            characterRef.current.setEmoteTracks(next);
                                                        }
                                                        return next;
                                                    });
                                                }}
                                                className="mt-auto py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-white uppercase transition-all cursor-pointer flex items-center justify-center gap-1"
                                            >
                                                <RotateCcw size={11} />
                                                <span>RESET PRESET</span>
                                            </button>
                                        </div>

                                        {/* RIGHT SIDE: SLIDER TRACK BARS FOR ALL LIMBS & JOINTS FOR THE SELECTED % */}
                                        <div className="flex-1 p-4 overflow-y-auto space-y-3">
                                            <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-cyan-500/40">
                                                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                                                    <span>FRAME:</span>
                                                    <span className="text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded-lg border border-cyan-500/50">
                                                        {currentKf?.percentage}% ({currentKf?.name})
                                                    </span>
                                                </h4>
                                                <span className="text-[9px] text-slate-400 font-mono">
                                                    -180° to +180°
                                                </span>
                                            </div>

                                            {/* 4 Limb & Joint Grids */}
                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                                {/* Left Arm & Elbow/Hand Joint */}
                                                <div className="bg-slate-950/80 p-3 rounded-xl border border-indigo-900/70 space-y-2.5 shadow-md">
                                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
                                                        LEFT ARM (SHOULDER X, Y, Z)
                                                    </span>
                                                    {(['x', 'y', 'z'] as const).map(axis => {
                                                        const val = currentKf?.la[axis] ?? 0;
                                                        return (
                                                            <div key={`la-${axis}`} className="space-y-0.5 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                                                                <div className="flex items-center justify-between text-[10px] font-bold">
                                                                    <span className="text-indigo-300">ARM ROTATION {axis.toUpperCase()}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="font-mono text-[9px] text-cyan-300 font-bold bg-slate-950 px-1 py-0.5 rounded">{val}°</span>
                                                                        <input type="number" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'la', axis, parseFloat(e.target.value) || 0)} className="w-12 text-center font-mono font-bold text-indigo-300 bg-slate-950 border border-slate-700 rounded text-[9px] py-0.5" />
                                                                    </div>
                                                                </div>
                                                                <input type="range" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'la', axis, parseFloat(e.target.value) || 0)} className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                            </div>
                                                        );
                                                    })}

                                                    <div className="border-t border-indigo-900/40 pt-1.5">
                                                        <span className="text-[9.5px] font-black text-indigo-300 uppercase tracking-wider">LEFT ELBOW / HAND JOINT</span>
                                                        {(['x', 'y', 'z'] as const).map(axis => {
                                                            const val = currentKf?.le?.[axis] ?? 0;
                                                            return (
                                                                <div key={`le-${axis}`} className="space-y-0.5 bg-slate-900/70 p-1.5 rounded-lg border border-slate-800 mt-1">
                                                                    <div className="flex items-center justify-between text-[9px] font-bold">
                                                                        <span className="text-indigo-400">ELBOW/HAND {axis.toUpperCase()}</span>
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="font-mono text-[8.5px] text-cyan-300 font-bold bg-slate-950 px-1 py-0.5 rounded">{val}°</span>
                                                                            <input type="number" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'le', axis, parseFloat(e.target.value) || 0)} className="w-11 text-center font-mono font-bold text-indigo-300 bg-slate-950 border border-slate-700 rounded text-[8.5px] py-0.5" />
                                                                        </div>
                                                                    </div>
                                                                    <input type="range" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'le', axis, parseFloat(e.target.value) || 0)} className="w-full accent-indigo-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Right Arm & Elbow/Hand Joint */}
                                                <div className="bg-slate-950/80 p-3 rounded-xl border border-cyan-900/70 space-y-2.5 shadow-md">
                                                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">
                                                        RIGHT ARM (SHOULDER X, Y, Z)
                                                    </span>
                                                    {(['x', 'y', 'z'] as const).map(axis => {
                                                        const val = currentKf?.ra[axis] ?? 0;
                                                        return (
                                                            <div key={`ra-${axis}`} className="space-y-0.5 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                                                                <div className="flex items-center justify-between text-[10px] font-bold">
                                                                    <span className="text-cyan-300">ARM ROTATION {axis.toUpperCase()}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="font-mono text-[9px] text-cyan-300 font-bold bg-slate-950 px-1 py-0.5 rounded">{val}°</span>
                                                                        <input type="number" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'ra', axis, parseFloat(e.target.value) || 0)} className="w-12 text-center font-mono font-bold text-cyan-300 bg-slate-950 border border-slate-700 rounded text-[9px] py-0.5" />
                                                                    </div>
                                                                </div>
                                                                <input type="range" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'ra', axis, parseFloat(e.target.value) || 0)} className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                            </div>
                                                        );
                                                    })}

                                                    <div className="border-t border-cyan-900/40 pt-1.5">
                                                        <span className="text-[9.5px] font-black text-cyan-300 uppercase tracking-wider">RIGHT ELBOW / HAND JOINT</span>
                                                        {(['x', 'y', 'z'] as const).map(axis => {
                                                            const val = currentKf?.re?.[axis] ?? 0;
                                                            return (
                                                                <div key={`re-${axis}`} className="space-y-0.5 bg-slate-900/70 p-1.5 rounded-lg border border-slate-800 mt-1">
                                                                    <div className="flex items-center justify-between text-[9px] font-bold">
                                                                        <span className="text-cyan-400">ELBOW/HAND {axis.toUpperCase()}</span>
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="font-mono text-[8.5px] text-cyan-300 font-bold bg-slate-950 px-1 py-0.5 rounded">{val}°</span>
                                                                            <input type="number" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 're', axis, parseFloat(e.target.value) || 0)} className="w-11 text-center font-mono font-bold text-cyan-300 bg-slate-950 border border-slate-700 rounded text-[8.5px] py-0.5" />
                                                                        </div>
                                                                    </div>
                                                                    <input type="range" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 're', axis, parseFloat(e.target.value) || 0)} className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Left Leg & Knee Joint */}
                                                <div className="bg-slate-950/80 p-3 rounded-xl border border-emerald-900/70 space-y-2.5 shadow-md">
                                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                                                        LEFT LEG (THIGH X, Y, Z)
                                                    </span>
                                                    {(['x', 'y', 'z'] as const).map(axis => {
                                                        const val = currentKf?.ll[axis] ?? 0;
                                                        return (
                                                            <div key={`ll-${axis}`} className="space-y-0.5 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                                                                <div className="flex items-center justify-between text-[10px] font-bold">
                                                                    <span className="text-emerald-300">LEG ROTATION {axis.toUpperCase()}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="font-mono text-[9px] text-emerald-300 font-bold bg-slate-950 px-1 py-0.5 rounded">{val}°</span>
                                                                        <input type="number" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'll', axis, parseFloat(e.target.value) || 0)} className="w-12 text-center font-mono font-bold text-emerald-300 bg-slate-950 border border-slate-700 rounded text-[9px] py-0.5" />
                                                                    </div>
                                                                </div>
                                                                <input type="range" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'll', axis, parseFloat(e.target.value) || 0)} className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                            </div>
                                                        );
                                                    })}

                                                    <div className="border-t border-emerald-900/40 pt-1.5">
                                                        <span className="text-[9.5px] font-black text-emerald-300 uppercase tracking-wider">LEFT KNEE / SHIN JOINT</span>
                                                        {(['x', 'y', 'z'] as const).map(axis => {
                                                            const val = currentKf?.lk?.[axis] ?? 0;
                                                            return (
                                                                <div key={`lk-${axis}`} className="space-y-0.5 bg-slate-900/70 p-1.5 rounded-lg border border-slate-800 mt-1">
                                                                    <div className="flex items-center justify-between text-[9px] font-bold">
                                                                        <span className="text-emerald-400">KNEE {axis.toUpperCase()}</span>
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="font-mono text-[8.5px] text-emerald-300 font-bold bg-slate-950 px-1 py-0.5 rounded">{val}°</span>
                                                                            <input type="number" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'lk', axis, parseFloat(e.target.value) || 0)} className="w-11 text-center font-mono font-bold text-emerald-300 bg-slate-950 border border-slate-700 rounded text-[8.5px] py-0.5" />
                                                                        </div>
                                                                    </div>
                                                                    <input type="range" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'lk', axis, parseFloat(e.target.value) || 0)} className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Right Leg & Knee Joint */}
                                                <div className="bg-slate-950/80 p-3 rounded-xl border border-amber-900/70 space-y-2.5 shadow-md">
                                                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
                                                        RIGHT LEG (THIGH X, Y, Z)
                                                    </span>
                                                    {(['x', 'y', 'z'] as const).map(axis => {
                                                        const val = currentKf?.rl[axis] ?? 0;
                                                        return (
                                                            <div key={`rl-${axis}`} className="space-y-0.5 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                                                                <div className="flex items-center justify-between text-[10px] font-bold">
                                                                    <span className="text-amber-300">LEG ROTATION {axis.toUpperCase()}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="font-mono text-[9px] text-amber-300 font-bold bg-slate-950 px-1 py-0.5 rounded">{val}°</span>
                                                                        <input type="number" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'rl', axis, parseFloat(e.target.value) || 0)} className="w-12 text-center font-mono font-bold text-amber-300 bg-slate-950 border border-slate-700 rounded text-[9px] py-0.5" />
                                                                    </div>
                                                                </div>
                                                                <input type="range" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'rl', axis, parseFloat(e.target.value) || 0)} className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                            </div>
                                                        );
                                                    })}

                                                    <div className="border-t border-amber-900/40 pt-1.5">
                                                        <span className="text-[9.5px] font-black text-amber-300 uppercase tracking-wider">RIGHT KNEE / SHIN JOINT</span>
                                                        {(['x', 'y', 'z'] as const).map(axis => {
                                                            const val = currentKf?.rk?.[axis] ?? 0;
                                                            return (
                                                                <div key={`rk-${axis}`} className="space-y-0.5 bg-slate-900/70 p-1.5 rounded-lg border border-slate-800 mt-1">
                                                                    <div className="flex items-center justify-between text-[9px] font-bold">
                                                                        <span className="text-amber-400">KNEE {axis.toUpperCase()}</span>
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="font-mono text-[8.5px] text-amber-300 font-bold bg-slate-950 px-1 py-0.5 rounded">{val}°</span>
                                                                            <input type="number" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'rk', axis, parseFloat(e.target.value) || 0)} className="w-11 text-center font-mono font-bold text-amber-300 bg-slate-950 border border-slate-700 rounded text-[8.5px] py-0.5" />
                                                                        </div>
                                                                    </div>
                                                                    <input type="range" min="-180" max="180" value={val} onChange={(e) => handleUpdateKeyframeValue(currentEmoteKey, selectedKeyframeIndex, 'rk', axis, parseFloat(e.target.value) || 0)} className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg" />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Modal Footer */}
                            <div className="bg-slate-950 px-6 py-3 border-t border-cyan-500/40 flex items-center justify-between gap-3 shrink-0">
                                <span className="text-[10px] font-mono text-slate-400">
                                    Coordinates are applied instantly to the 3D Character playback
                                </span>
                                <button
                                    onClick={() => setShowKeyframeStudioModal(false)}
                                    className="px-6 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-cyan-500/30"
                                >
                                    DONE & CLOSE STUDIO
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* 2. ROOM THEME SELECTOR MODAL (GREEN CARD ROOM vs WHITE ROOM) */}
                {/* ========================================================================= */}
                {showThemeModal && (
                    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.3)] flex flex-col">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 px-5 py-3 border-b border-emerald-500/40 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Palette className="text-emerald-400" size={20} />
                                    <h3 className="font-black text-sm uppercase tracking-widest text-white">
                                        CHOOSE ROOM THEME
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setShowThemeModal(false)}
                                    className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Theme Options */}
                            <div className="p-5 space-y-3.5">
                                {ROOM_THEME_OPTIONS.map((theme) => {
                                    const isSelected = activeTheme === theme.id;
                                    return (
                                        <div
                                            key={theme.id}
                                            onClick={() => handleSelectRoomTheme(theme.id)}
                                            className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${isSelected
                                                ? 'bg-slate-800 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)] ring-2 ring-emerald-500/50'
                                                : 'bg-slate-950/70 hover:bg-slate-800 border-slate-700 text-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                {/* Theme Visual Preview Thumbnail */}
                                                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${theme.bgPreview} border border-slate-600 shadow-md flex items-center justify-center shrink-0 overflow-hidden relative`}>
                                                    {theme.imageUrl ? (
                                                        <img src={theme.imageUrl} alt={theme.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-white flex flex-col items-center justify-center text-slate-900 font-mono">
                                                            <span className="text-[10px] font-black leading-none">SOLID</span>
                                                            <span className="text-[8px] font-bold text-slate-500">WHITE</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-black text-sm text-white uppercase tracking-wider">
                                                            {theme.name}
                                                        </h4>
                                                        <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 border border-emerald-500/30">
                                                            {theme.badge}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 leading-tight truncate">
                                                        {theme.subtitle}
                                                    </p>
                                                    <p className="text-[9px] font-mono text-slate-500">
                                                        Texture: {theme.imageUrl || 'None (Clean #ffffff)'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Selection Indicator */}
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${isSelected ? 'bg-emerald-500 border-emerald-300 text-slate-950 font-black' : 'border-slate-600'}`}>
                                                {isSelected && <Check size={14} />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Modal Footer */}
                            <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex items-center justify-between">
                                <span className="text-[9px] text-slate-400 font-mono">
                                    Instant 1-Click Environment Shader Switch
                                </span>
                                <button
                                    onClick={() => setShowThemeModal(false)}
                                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase cursor-pointer transition-all"
                                >
                                    DONE
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};