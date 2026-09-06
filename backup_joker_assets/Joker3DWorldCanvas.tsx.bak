import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Unlock, Zap, Briefcase, LogOut, AlertTriangle, Eye, Timer, ShieldAlert, User, Map as MapIcon, X } from 'lucide-react';
import type { DoorData, JokerPlayer, MapCell, JokerGameState } from '../jokerTypes';
import { DOOR_3D_CONFIG } from './door3dConfig';
import { DungeonHallway } from './DungeonHallway';
import { DoorSystem, type DoorData3D } from './DoorSystem';
import { PlayerController } from './PlayerController';
import { SoundEngine } from './SoundEngine';
import { calculateRedCostMultiplier } from '../jokerInventoryConfig';
import { PlayerCardModal } from '../../../PlayerCardModal';
import { parseMapMatrix } from '../jokerMapData';
import { JokerMapGrid } from '../JokerMapGrid';

interface Joker3DWorldCanvasProps {
    currentCell: MapCell;
    player: JokerPlayer;
    allPlayers: JokerPlayer[];
    gridMatrix: MapCell[][];
    phase: string;
    timeLeft: number;
    user?: any;
    gameState?: JokerGameState | null;
    onSelectDoor: (door: DoorData, finalCost: number, isSkip: boolean) => void;
    onEnterRoom?: () => void;
    onClaimSpecialCard?: (specialType: string) => void;
    onOpenInventory?: () => void;
    onClose?: () => void;
    onRefundSkipCard?: () => void;
    onUnblockDoorWithGreenCard?: (direction: 'up' | 'right' | 'down' | 'left') => void;
}

export const Joker3DWorldCanvas: React.FC<Joker3DWorldCanvasProps> = ({
    currentCell,
    player,
    allPlayers,
    gridMatrix,
    phase,
    timeLeft,
    user,
    gameState,
    onSelectDoor,
    onEnterRoom,
    onClaimSpecialCard,
    onOpenInventory,
    onClose,
    onRefundSkipCard,
    onUnblockDoorWithGreenCard
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [selectedDoor, setSelectedDoor] = useState<DoorData | null>(null);
    const [lockedDoorDir, setLockedDoorDir] = useState<'up' | 'right' | 'down' | 'left' | null>(null);
    const [skipErrorModal, setSkipErrorModal] = useState<{ show: boolean; title: string; message: string; pendingDoor?: DoorData } | null>(null);
    const [redBlockWarningModal, setRedBlockWarningModal] = useState<{ show: boolean; door: DoorData; jokerDir: 'up' | 'right' | 'down' | 'left' } | null>(null);
    const [nearbyDoorTitle, setNearbyDoorTitle] = useState<string | null>(null);
    const [autoTeleportTimer, setAutoTeleportTimer] = useState(30);
    const [showPlayerProfileModal, setShowPlayerProfileModal] = useState<boolean>(false);
    const [showMapModal, setShowMapModal] = useState<boolean>(false);

    const soundEngineRef = useRef<SoundEngine | null>(null);
    const doorSystemRef = useRef<DoorSystem | null>(null);
    const hallwayRef = useRef<DungeonHallway | null>(null);
    const playerControllerRef = useRef<PlayerController | null>(null);

    const currentSpecialCardRef = useRef<string | null>(null);
    const lastRenderedCenterCardKeyRef = useRef<string>('');
    const cardClaimedInRoomRef = useRef<boolean>(false);
    const roomCardMapRef = useRef<{ [coordKey: string]: any }>({});
    const lastChosenDirRef = useRef<'up' | 'right' | 'down' | 'left' | null>(null);
    const modalOpenedAtRef = useRef<number>(0);

    const onClaimSpecialCardRef = useRef(onClaimSpecialCard);
    useEffect(() => {
        onClaimSpecialCardRef.current = onClaimSpecialCard;
    }, [onClaimSpecialCard]);

    const availableDoors = currentCell?.doors || [];

    const availableDoorsRef = useRef(availableDoors);
    availableDoorsRef.current = availableDoors;

    // Cache door costs by cell coordinate to prevent flickering on re-renders
    const stableDoorCostsRef = useRef<Record<string, number>>({});
    const cellKey = `${currentCell?.r ?? 0}_${currentCell?.c ?? 0}`;
    const prevCellKeyRef = useRef<string>(cellKey);
    if (prevCellKeyRef.current !== cellKey) {
        // Cell changed — reset cache with new costs
        const newCosts: Record<string, number> = {};
        availableDoors.forEach(d => { if (d.cost) newCosts[d.direction] = d.cost; });
        stableDoorCostsRef.current = newCosts;
        prevCellKeyRef.current = cellKey;
    } else {
        // Same cell — fill cache from doors if empty
        availableDoors.forEach(d => {
            if (d.cost && !stableDoorCostsRef.current[d.direction]) {
                stableDoorCostsRef.current[d.direction] = d.cost;
            }
        });
    }

    const phaseRef = useRef(phase);
    phaseRef.current = phase;

    // Keep a ref for lockedDoorDir & isSkip so phase handler can read it without being a dependency
    const lockedDoorDirRef = useRef<'up' | 'right' | 'down' | 'left' | null>(null);
    const lockedDoorIsSkipRef = useRef<boolean>(false);
    const selectedDoorRef = useRef<DoorData | null>(null);
    const lastChosenIsSkipRef = useRef<boolean>(false);

    // Failsafe guards to ensure Reveal phase animation & onEnterRoom timer trigger ONCE per round
    const hasTriggeredRevealRef = useRef<boolean>(false);
    const revealRoundRef = useRef<number>(-1);
    const hasPlayedEntranceAnimRef = useRef<string>('');
    const hasPlayedFadeInAnimRef = useRef<string>('');
    const lastBuiltRoomKeyRef = useRef<string>('');
    const roomCardHistoryRef = useRef<{ [cellKey: string]: string[] }>({});

    const onEnterRoomRef = useRef(onEnterRoom);
    useEffect(() => {
        onEnterRoomRef.current = onEnterRoom;
    }, [onEnterRoom]);

    const handleDoorLockToggleRef = useRef<((door: DoorData) => void) | null>(null);

    // Virtual Joystick Touch Controls for Mobile (Left side)
    const [joystickTouchId, setJoystickTouchId] = useState<number | null>(null);
    const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const joystickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const handleJoystickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const touch = e.changedTouches[0];
        if (!touch) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        joystickCenterRef.current = { x: centerX, y: centerY };
        setJoystickTouchId(touch.identifier);

        const dx = touch.clientX - centerX;
        const dy = touch.clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 35;
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);

        const joyX = Math.cos(angle) * clampedDist;
        const joyY = Math.sin(angle) * clampedDist;
        setJoystickPos({ x: joyX, y: joyY });
        updateJoystickKeyboard(joyX, joyY);
    };

    const handleJoystickTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (joystickTouchId === null) return;
        let touch: React.Touch | undefined;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystickTouchId) {
                touch = e.changedTouches[i];
                break;
            }
        }
        if (!touch) return;

        const dx = touch.clientX - joystickCenterRef.current.x;
        const dy = touch.clientY - joystickCenterRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 35;
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);

        const joyX = Math.cos(angle) * clampedDist;
        const joyY = Math.sin(angle) * clampedDist;
        setJoystickPos({ x: joyX, y: joyY });
        updateJoystickKeyboard(joyX, joyY);
    };

    const handleJoystickTouchEnd = () => {
        setJoystickTouchId(null);
        setJoystickPos({ x: 0, y: 0 });
        if (playerControllerRef.current) {
            playerControllerRef.current.setTouchMovement(false, false, false, false);
        }
    };

    const updateJoystickKeyboard = (joyX: number, joyY: number) => {
        const threshold = 6;
        const forward = joyY < -threshold;
        const backward = joyY > threshold;
        const left = joyX < -threshold;
        const right = joyX > threshold;
        if (playerControllerRef.current) {
            playerControllerRef.current.setTouchMovement(forward, backward, left, right);
        }
    };

    // Sync player pending choice — only update visual highlight, never open doors
    useEffect(() => {
        if (player?.pendingDoorChoice?.door) {
            setSelectedDoor(player.pendingDoorChoice.door);
            setLockedDoorDir(player.pendingDoorChoice.door.direction);
            selectedDoorRef.current = player.pendingDoorChoice.door;
            lockedDoorDirRef.current = player.pendingDoorChoice.door.direction;
            // Only update door highlight badge, NEVER open the door in choosing phase
            if (doorSystemRef.current && phaseRef.current !== 'reveal') {
                const dir3d = player.pendingDoorChoice.door.direction === 'up' ? 'north'
                    : player.pendingDoorChoice.door.direction === 'down' ? 'south'
                        : player.pendingDoorChoice.door.direction === 'right' ? 'east' : 'west';
                doorSystemRef.current.setDoorSelected(dir3d);
            }
        } else if (!player?.pendingDoorChoice?.door) {
            setSelectedDoor(null);
            setLockedDoorDir(null);
            lockedDoorDirRef.current = null;
            selectedDoorRef.current = null;
            if (doorSystemRef.current && phaseRef.current !== 'reveal') {
                doorSystemRef.current.setDoorSelected(null);
            }
        }
    }, [player?.pendingDoorChoice?.door?.direction]);

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;

        const soundEngine = new SoundEngine();
        soundEngineRef.current = soundEngine;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#ffffff');

        const camera = new THREE.PerspectiveCamera(60, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 50);
        scene.add(camera);

        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
        scene.add(ambientLight);

        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.35;

        const hallway = new DungeonHallway(scene);
        hallwayRef.current = hallway;

        const doorSystem = new DoorSystem(scene, soundEngine);
        doorSystemRef.current = doorSystem;

        const playerController = new PlayerController(camera, renderer.domElement, soundEngine);
        playerControllerRef.current = playerController;

        hallway.rebuildRoomForCell(currentCell, doorSystem, gridMatrix, false, player);
        doorSystem.animateDoorsFadeIn();

        playerController.onSelectKeyPress = () => {
            if (phaseRef.current === 'reveal') return;
            const nearby = doorSystemRef.current?.getNearbyDoor(playerControllerRef.current!.position);
            if (nearby) {
                const jokerDir = nearby.direction === 'north' ? 'up'
                    : nearby.direction === 'south' ? 'down'
                        : nearby.direction === 'east' ? 'right' : 'left';
                const matchDoor = availableDoorsRef.current.find(d => d.direction === jokerDir);
                if (matchDoor && handleDoorLockToggleRef.current) {
                    handleDoorLockToggleRef.current(matchDoor);
                }
            }
        };

        playerController.onExitDoorBoundary = () => {
            if (onEnterRoomRef.current) onEnterRoomRef.current();
        };

        let animationFrameId: number;
        const clock = new THREE.Clock();

        let isTransitioning = false;

        const enteredMiddleRoomRef = { current: false };

        const checkDoorThresholdPassage = () => {
            if (phaseRef.current !== 'reveal' || isTransitioning) return;
            const pos = playerController.position;
            const isSkip = isSkipUsed;

            for (const door of doorSystem.doors) {
                const dirNorm = (door.direction === 'north' || (door as any).direction === 'up') ? 'north'
                    : (door.direction === 'south' || (door as any).direction === 'down') ? 'south'
                        : (door.direction === 'east' || (door as any).direction === 'right') ? 'east'
                            : 'west';

                // Step 1: Crossing Door 1 (Threshold 9.0m - 3/4 down the corridor after entering room door)
                if (!enteredMiddleRoomRef.current && door.isOpen) {
                    let crossedDoor1 = false;
                    if (dirNorm === 'north' && pos.z <= -9.0 && Math.abs(pos.x) < 2.0) crossedDoor1 = true;
                    if (dirNorm === 'south' && pos.z >= 9.0 && Math.abs(pos.x) < 2.0) crossedDoor1 = true;
                    if (dirNorm === 'east' && pos.x >= 9.0 && Math.abs(pos.z) < 2.0) crossedDoor1 = true;
                    if (dirNorm === 'west' && pos.x <= -9.0 && Math.abs(pos.z) < 2.0) crossedDoor1 = true;

                    if (crossedDoor1) {
                        console.log(`[DOOR 3D LOG] Player crossed 3/4 corridor threshold (${dirNorm}).`);

                        if (!isSkip) {
                            // Normal 1-step door: Middle room IS the destination room!
                            isTransitioning = true;
                            hasEnteredDestinationRoomRef.current = true;
                            playerController.allowExitDoor = false;
                            doorSystem.closeAllDoors(true, false);
                            if (hallwayRef.current) hallwayRef.current.animateSecondDoorClose(true);

                            if (onEnterRoomRef.current) onEnterRoomRef.current();
                            setTimeout(() => { isTransitioning = false; }, 300);
                            break;
                        } else {
                            // Skip 2-step door: Player is in Middle Skipped Room.
                            enteredMiddleRoomRef.current = true;
                        }
                    }
                }

                // Step 2: Crossing Door 2 (Threshold 16.0m - 3/4 down the 2-step corridor)
                if (isSkip && enteredMiddleRoomRef.current) {
                    let crossedDoor2 = false;
                    if (dirNorm === 'north' && pos.z <= -16.0 && Math.abs(pos.x) < 2.0) crossedDoor2 = true;
                    if (dirNorm === 'south' && pos.z >= 16.0 && Math.abs(pos.x) < 2.0) crossedDoor2 = true;
                    if (dirNorm === 'east' && pos.x >= 16.0 && Math.abs(pos.z) < 2.0) crossedDoor2 = true;
                    if (dirNorm === 'west' && pos.x <= -16.0 && Math.abs(pos.z) < 2.0) crossedDoor2 = true;

                    if (crossedDoor2) {
                        console.log(`[DOOR 3D LOG] Player crossed Door 2 threshold (${dirNorm}) into Final Destination Room! Closing ALL doors.`);
                        isTransitioning = true;
                        hasEnteredDestinationRoomRef.current = true;
                        playerController.allowExitDoor = false;
                        doorSystem.closeAllDoors(true, false);
                        if (hallwayRef.current) hallwayRef.current.animateSecondDoorClose(true);

                        if (onEnterRoomRef.current) onEnterRoomRef.current();
                        setTimeout(() => { isTransitioning = false; }, 300);
                        break;
                    }
                }
            }
        };

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            const delta = Math.min(clock.getDelta(), 0.1);
            playerController.update(delta, false, doorSystem.doors);

            if (doorSystem.centerMesh && !cardClaimedInRoomRef.current) {
                const cardPos = doorSystem.centerMesh.position;
                const distToCard = playerController.position.distanceTo(cardPos);
                if (distToCard <= 1.2) {
                    cardClaimedInRoomRef.current = true;
                    doorSystem.triggerSparkleBurst(cardPos);
                    soundEngine.playCardUnlock();
                }
            }

            checkDoorThresholdPassage();

            // Spin center card in current room continuously
            if (doorSystem.centerMesh) {
                doorSystem.centerMesh.rotation.y += delta * 1.2;
            }

            // Spin all preview room cards continuously
            scene.traverse((obj) => {
                if (obj.name === 'previewCardSpin') {
                    obj.rotation.y += delta * 1.2;
                }
            });

            const nearby = doorSystem.getNearbyDoor(playerController.position);
            if (nearby) {
                setNearbyDoorTitle(nearby.title);
            } else {
                setNearbyDoorTitle(null);
            }

            renderer.render(scene, camera);
        };

        animate();

        const handleResize = () => {
            if (!containerRef.current) return;
            camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            renderer.dispose();
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (skipErrorModal?.show) return;

            if (e.key.toLowerCase() === 'q') {
                if (playerControllerRef.current) {
                    playerControllerRef.current.unlockPointer();
                }
                if (onOpenInventory) onOpenInventory();
            }

            if (e.key.toLowerCase() === 'm') {
                if (playerControllerRef.current) {
                    playerControllerRef.current.unlockPointer();
                }
                setShowMapModal(prev => !prev);
            }

            if (phase === 'choosing') {
                let targetDir: 'up' | 'right' | 'down' | 'left' | null = null;
                if (e.code === 'Digit1') targetDir = 'up';
                if (e.code === 'Digit2') targetDir = 'right';
                if (e.code === 'Digit3') targetDir = 'down';
                if (e.code === 'Digit4') targetDir = 'left';

                if (targetDir) {
                    const door = availableDoors.find(d => d.direction === targetDir);
                    if (door) {
                        e.preventDefault();
                        handleDoorLockToggle(door);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onOpenInventory, phase, availableDoors, skipErrorModal?.show]);

    const handleDoorLockToggle = (door: DoorData) => {
        if (phase === 'reveal') return;

        // Check if target cell in direction is a wall or out of bounds
        const dDirStr = String(door.direction);
        const jokerDirCheck = (dDirStr === 'north' || dDirStr === 'up') ? 'up'
            : (dDirStr === 'south' || dDirStr === 'down') ? 'down'
                : (dDirStr === 'west' || dDirStr === 'left') ? 'left'
                    : 'right';

        let targetR = Number(currentCell?.r ?? 0);
        let targetC = Number(currentCell?.c ?? 0);
        if (jokerDirCheck === 'up') targetR -= 1;
        if (jokerDirCheck === 'down') targetR += 1;
        if (jokerDirCheck === 'left') targetC -= 1;
        if (jokerDirCheck === 'right') targetC += 1;

        const target1Cell = (targetR >= 0 && targetR < 7 && targetC >= 0 && targetC < 7) ? gridMatrix[targetR]?.[targetC] : null;
        if (!target1Cell || target1Cell.type === 'wall' || target1Cell.isBlockedCell) {
            console.log(`[DOOR 3D LOG] Door ${door.direction} leads to a blocked wall cell (${targetR}, ${targetC})! Locking disabled.`);
            soundEngineRef.current?.playErrorBuzz();
            return;
        }

        if (lockedDoorDirRef.current === door.direction) {
            setSelectedDoor(null);
            setLockedDoorDir(null);
            lockedDoorDirRef.current = null;
            selectedDoorRef.current = null;
            if (doorSystemRef.current) {
                doorSystemRef.current.setDoorSelected(null);
            }
            onSelectDoor(null as any, 0, false);
        } else {
            // Check if door direction is blocked by Red Card attack!
            const dDirStr = String(door.direction);
            const jokerDirCheck = (dDirStr === 'north' || dDirStr === 'up') ? 'up'
                : (dDirStr === 'south' || dDirStr === 'down') ? 'down'
                    : (dDirStr === 'west' || dDirStr === 'left') ? 'left'
                        : 'right';

            if ((player?.blockedDoorsByRed || []).includes(jokerDirCheck as any)) {
                console.log(`[DOOR 3D LOG] Door ${door.direction} is blocked by Red Card attack! Opening unblock popup modal.`);
                soundEngineRef.current?.playErrorBuzz();
                modalOpenedAtRef.current = Date.now();
                if (playerControllerRef.current) {
                    playerControllerRef.current.unlockPointer();
                }
                setRedBlockWarningModal({
                    show: true,
                    door,
                    jokerDir: jokerDirCheck as any
                });
                return;
            }

            // Skip Card Validation & Target Calculation BEFORE locking
            const isSkip = !!(player?.hasUsedSkipCard || player?.pendingDoorChoice?.isSkip);
            const step = isSkip ? 2 : 1;
            let destR = Number(currentCell?.r ?? 0);
            let destC = Number(currentCell?.c ?? 0);
            if (jokerDirCheck === 'up') destR -= step;
            if (jokerDirCheck === 'down') destR += step;
            if (jokerDirCheck === 'left') destC -= step;
            if (jokerDirCheck === 'right') destC += step;

            const destCell = gridMatrix[destR]?.[destC];
            if (destCell && destCell.specialCards) {
                const destKey = `${destR}_${destC}`;
                const filterCards = destCell.specialCards.filter((c: string) => c && c !== 'none');
                if (filterCards.length > 0) {
                    console.log(`[DOOR 3D LOG] Locking destination room (${destR}, ${destC}) special cards snapshot:`, filterCards);
                    roomCardMapRef.current[destKey] = [...filterCards];
                }
            }

            if (isSkip) {
                let step1R = Number(player?.currentR || 0);
                let step1C = Number(player?.currentC || 0);
                let step2R = Number(player?.currentR || 0);
                let step2C = Number(player?.currentC || 0);
                const step = 2;

                const dDir = String(door.direction);
                const dirNorm = (dDir === 'north' || dDir === 'up') ? 'up'
                    : (dDir === 'south' || dDir === 'down') ? 'down'
                        : (dDir === 'west' || dDir === 'left') ? 'left'
                            : 'right';

                if (dirNorm === 'up') {
                    step1R = step1R - 1;
                    step2R = step2R - 2;
                }
                if (dirNorm === 'down') {
                    step1R = step1R + 1;
                    step2R = step2R + 2;
                }
                if (dirNorm === 'left') {
                    step1C = step1C - 1;
                    step2C = step2C - 2;
                }
                if (dirNorm === 'right') {
                    step1C = step1C + 1;
                    step2C = step2C + 2;
                }

                const step1Cell = gridMatrix[step1R]?.[step1C];
                const step2Cell = gridMatrix[step2R]?.[step2C];

                const isStep1Blocked = !step1Cell || step1Cell.type === 'wall' || step1Cell.type === 'empty' || step1Cell.isBlockedCell;
                const isStep2Blocked = !step2Cell || step2Cell.type === 'wall' || step2Cell.type === 'empty' || step2Cell.isBlockedCell;

                if (isStep1Blocked || isStep2Blocked) {
                    modalOpenedAtRef.current = Date.now();
                    if (playerControllerRef.current) {
                        playerControllerRef.current.unlockPointer();
                    }
                    setSkipErrorModal({
                        show: true,
                        title: 'SKIP DESTINATION BLOCKED',
                        message: `The 2-step destination ${door.direction.toUpperCase()} (${step2C}, ${step2R}) is a closed wall or out of bounds.`,
                        pendingDoor: door
                    });
                    return; // Abort skip door locking until user selects option
                }
            }

            setSelectedDoor(door);
            setLockedDoorDir(door.direction);
            lockedDoorDirRef.current = door.direction;
            lockedDoorIsSkipRef.current = isSkip;
            selectedDoorRef.current = door;
            lastChosenDirRef.current = door.direction;
            lastChosenIsSkipRef.current = isSkip;
            if (doorSystemRef.current) {
                const dir3d = door.direction === 'up' ? 'north'
                    : door.direction === 'down' ? 'south'
                        : door.direction === 'right' ? 'east' : 'west';
                doorSystemRef.current.setDoorSelected(dir3d, isSkip);
            }

            // Green Card & Multiplier Application
            const costMultiplier = player?.hasUsedGreenCard ? 1 : Math.max(1, player?.nextRoundCostMultiplier || 1);
            const finalCost = (player?.hasUsedGreenCard || isSkip) ? 0 : (door.cost || 10) * costMultiplier;

            onSelectDoor(door, finalCost, isSkip);
            soundEngineRef.current?.playLockClick();
        }
    };

    handleDoorLockToggleRef.current = handleDoorLockToggle;

    const prevRoomCoordRef = useRef<{ r: number; c: number } | null>(null);
    const prevRoundRef = useRef<number>(gameState?.current_round || 1);
    const actualEntryDirRef = useRef<string | null>(null);
    const hasEnteredDestinationRoomRef = useRef<boolean>(false);

    const isSkipUsed = !!(
        player?.hasUsedSkipCard ||
        player?.pendingDoorChoice?.isSkip ||
        player?.lastDoorChoice?.isSkip ||
        (player as any)?.boughtDoorChoice?.isSkip ||
        lockedDoorIsSkipRef.current ||
        lastChosenIsSkipRef.current
    );
    const lastBuiltIsSkipRef = useRef<boolean>(false);
    const hasPlayedRevealOpenAnimRef = useRef<string | null>(null);

    useEffect(() => {
        if (hallwayRef.current && doorSystemRef.current) {
            const currentRound = gameState?.current_round || 1;
            const isRoundChanged = prevRoundRef.current !== currentRound;
            const previousBoughtDir = lastChosenDirRef.current || player?.lastDoorChoice?.door?.direction;
            const isNewRoom = !prevRoomCoordRef.current || prevRoomCoordRef.current.r !== currentCell.r || prevRoomCoordRef.current.c !== currentCell.c;
            const roomBuildKey = `${currentRound}_${currentCell.r}_${currentCell.c}`;

            cardClaimedInRoomRef.current = false;

            const parsedMap = parseMapMatrix(gameState?.map_matrix || gridMatrix);
            const activeOldMap = parsedMap.old_map && parsedMap.old_map.length === 7 ? parsedMap.old_map : gridMatrix;
            // old_map is the frozen round-start snapshot. Use it for BOTH room geometry AND center card display so:
            //   • Choosing Phase: shows what cards were there at round start (correct reference for players)
            //   • Reveal Phase: card stays visible even after a player claims it (new_map clears it, old_map doesn't)
            // Claim logic reads LIVE from DB, so only the first claimant actually receives the card — display is separate.
            const displayCell = activeOldMap[currentCell.r]?.[currentCell.c] || currentCell;

            if (isNewRoom || isRoundChanged || lastBuiltRoomKeyRef.current !== roomBuildKey || lastBuiltIsSkipRef.current !== isSkipUsed) {
                lastBuiltRoomKeyRef.current = roomBuildKey;
                lastBuiltIsSkipRef.current = isSkipUsed;
                lastRenderedCenterCardKeyRef.current = '';
                console.log(`[DOOR 3D LOG] Building 3D room geometry for Room (${currentCell.r}, ${currentCell.c}) (isSkip: ${isSkipUsed})`);
                // Room geometry (walls, doors) built from old_map structure; card display updated separately from new_map
                hallwayRef.current.rebuildRoomForCell(displayCell, doorSystemRef.current, activeOldMap, isSkipUsed, player, phase === 'reveal');
            }

            const activeLockDir = lockedDoorDir
                || lockedDoorDirRef.current
                || player?.pendingDoorChoice?.door?.direction
                || player?.lastDoorChoice?.door?.direction
                || lastChosenDirRef.current;
            if (doorSystemRef.current) {
                doorSystemRef.current.setDoorSelected(activeLockDir || null, isSkipUsed);
            }

            prevRoomCoordRef.current = { r: currentCell.r, c: currentCell.c };
            if (isNewRoom || isRoundChanged) {
                lastChosenDirRef.current = null;
                lockedDoorDirRef.current = null;
                selectedDoorRef.current = null;
                setSelectedDoor(null);
                setLockedDoorDir(null);
                hasEnteredDestinationRoomRef.current = false;
                if (playerControllerRef.current) {
                    playerControllerRef.current.resetToCenter();
                }
            }

            const reverseDir: Record<string, string> = { 'up': 'down', 'down': 'up', 'right': 'left', 'left': 'right', 'north': 'south', 'south': 'north', 'east': 'west', 'west': 'east' };
            const entryDir = actualEntryDirRef.current || (previousBoughtDir ? reverseDir[previousBoughtDir] : null);

            if (isRoundChanged || phase === 'choosing' || !phase) {
                hasEnteredDestinationRoomRef.current = false;
            }

            if (isRoundChanged) {
                prevRoundRef.current = currentRound;
                // Clear stale room card history so the new round displays correct card types from the fresh map.
                // Without this, round-1 card types (e.g. "red") would still show in rooms that now have different cards.
                roomCardHistoryRef.current = {};
                lastRenderedCenterCardKeyRef.current = '';
            }

            const animKey = `${currentRound}_${currentCell.r}_${currentCell.c}`;
            if ((phase === 'choosing' || !phase) && entryDir && doorSystemRef.current && hasPlayedEntranceAnimRef.current !== animKey) {
                hasPlayedEntranceAnimRef.current = animKey;
                console.log(`[DOOR 3D LOG] Entrance transition: Opening door (${entryDir}) and animating 3.5s smooth close...`);
                doorSystemRef.current.openBoughtDoor(entryDir, true);
                doorSystemRef.current.animateDoorsFadeIn(true);

                setTimeout(() => {
                    console.log(`[DOOR 3D LOG] Triggering 3.5s smooth close animation for entrance door (${entryDir})`);
                    doorSystemRef.current?.closeAllDoors(true, false);
                    if (hallwayRef.current) {
                        hallwayRef.current.animateSecondDoorClose(true);
                    }
                    actualEntryDirRef.current = null;
                }, 150);
            } else if (doorSystemRef.current && (phase === 'choosing' || !phase) && !activeLockDir) {
                doorSystemRef.current.closeAllDoors(true, false);
                if (hallwayRef.current) {
                    hallwayRef.current.animateSecondDoorClose(true);
                }
                if (hasPlayedFadeInAnimRef.current !== animKey) {
                    hasPlayedFadeInAnimRef.current = animKey;
                    doorSystemRef.current.animateDoorsFadeIn(false);
                }
            }

            if (phase === 'reveal' && doorSystemRef.current) {
                if (isNewRoom && entryDir) {
                    console.log(`[DOOR 3D LOG] Reveal Phase Room Entry: Candidate entered destination room (${entryDir}). Closing and locking all doors.`);
                    hasEnteredDestinationRoomRef.current = true;
                    if (playerControllerRef.current) playerControllerRef.current.allowExitDoor = false;
                    doorSystemRef.current.closeAllDoors(true, false);
                    if (hallwayRef.current) {
                        hallwayRef.current.animateSecondDoorClose(true);
                    }
                    actualEntryDirRef.current = null;
                } else if (!hasEnteredDestinationRoomRef.current) {
                    if (playerControllerRef.current) playerControllerRef.current.allowExitDoor = true;

                    const boughtChoice = (player as any)?.boughtDoorChoice || player?.lastDoorChoice || player?.pendingDoorChoice;
                    const boughtDoor = boughtChoice?.door;
                    const boughtDir = boughtDoor?.direction || (player as any)?.doorChoice?.direction || (player as any)?.pendingDoorChoice?.door?.direction || lastChosenDirRef.current || lockedDoorDirRef.current || selectedDoorRef.current?.direction;
                    const isChoiceSkip = !!(boughtChoice?.isSkip || isSkipUsed || lastChosenIsSkipRef.current || lockedDoorIsSkipRef.current);

                    if (isChoiceSkip && !lastBuiltIsSkipRef.current && hallwayRef.current) {
                        lastBuiltIsSkipRef.current = true;
                        hallwayRef.current.rebuildRoomForCell(currentCell, doorSystemRef.current, gridMatrix, true, player, true);
                    }

                    const revealOpenKey = `${currentRound}_${currentCell.r}_${currentCell.c}_revealOpen`;
                    if (hasPlayedRevealOpenAnimRef.current !== revealOpenKey) {
                        hasPlayedRevealOpenAnimRef.current = revealOpenKey;

                        const hasLockedDoorThisRound = !!(boughtChoice || lockedDoorDirRef.current || lastChosenDirRef.current);
                        if (boughtDir && hasLockedDoorThisRound) {
                            console.log(`[DOOR 3D LOG] Reveal Phase: Opening bought door (${boughtDir}) (isSkip: ${isChoiceSkip})!`);
                            doorSystemRef.current.openBoughtDoor(boughtDir, false, isChoiceSkip);
                            if (isChoiceSkip && hallwayRef.current) {
                                console.log(`[DOOR 3D LOG] Skip card active: Animating second door open at end of 2-step corridor!`);
                                hallwayRef.current.animateSecondDoorOpen(false);
                            }
                            if (playerControllerRef.current) {
                                playerControllerRef.current.setFacingDirection(boughtDir);
                            }
                        } else {
                            console.log(`[DOOR 3D LOG] Player did not lock or buy any door in Round ${currentRound}. Keeping all doors closed.`);
                            doorSystemRef.current.closeAllDoors(true, false);
                            if (hallwayRef.current) {
                                hallwayRef.current.animateSecondDoorClose(true);
                            }
                        }
                    }
                    if (hasPlayedFadeInAnimRef.current !== animKey) {
                        hasPlayedFadeInAnimRef.current = animKey;
                        doorSystemRef.current.animateDoorsFadeIn(true);
                    }
                } else {
                    console.log(`[DOOR 3D LOG] Player in destination room: Locking doors until next round.`);
                    if (playerControllerRef.current) playerControllerRef.current.allowExitDoor = false;
                    doorSystemRef.current.closeAllDoors(true, false);
                    if (hallwayRef.current) {
                        hallwayRef.current.animateSecondDoorClose(true);
                    }
                    if (hasPlayedFadeInAnimRef.current !== animKey) {
                        hasPlayedFadeInAnimRef.current = animKey;
                        doorSystemRef.current.animateDoorsFadeIn(false);
                    }
                }
            }

            // Float Win Card STRICTLY ONLY inside the respective player's assigned target exit room
            const assignedExit = player?.targetExitIndex || player?.entryIndex;
            const isMyTargetExitRoom = displayCell.type === 'exit' && (
                typeof displayCell.exitIndex === 'number'
                    ? displayCell.exitIndex === assignedExit
                    : true
            );

            // Read card data from old_map, falling back to roomCardHistoryRef and gridMatrix if old_map was cleared post-claim:
            // This ensures during Choosing Phase (and when selecting doors), the center card display persists the card from the previous Reveal Phase.
            const roomKey = `${currentCell.r}_${currentCell.c}`;
            const liveCards = (displayCell.specialCards || []).filter((c: string) => c && c !== 'none');
            const gridCellCards = (gridMatrix[currentCell.r]?.[currentCell.c]?.specialCards || []).filter((c: string) => c && c !== 'none');
            const rawGridCards = (parsedMap.grid?.[currentCell.r]?.[currentCell.c]?.specialCards || []).filter((c: string) => c && c !== 'none');

            if (liveCards.length > 0) {
                roomCardHistoryRef.current[roomKey] = liveCards;
            } else if (gridCellCards.length > 0 && !roomCardHistoryRef.current[roomKey]) {
                roomCardHistoryRef.current[roomKey] = gridCellCards;
            } else if (rawGridCards.length > 0 && !roomCardHistoryRef.current[roomKey]) {
                roomCardHistoryRef.current[roomKey] = rawGridCards;
            }

            const activeCards = liveCards.length > 0
                ? liveCards
                : (roomCardHistoryRef.current[roomKey] || gridCellCards || rawGridCards || []);

            let cellCards: any = activeCards.length > 0 ? activeCards : null;

            if (isMyTargetExitRoom) {
                cellCards = 'win';
            } else if (displayCell.type === 'exit') {
                cellCards = null;
            }

            currentSpecialCardRef.current = cellCards;
            const cardRenderKey = `${currentCell.r}_${currentCell.c}_${JSON.stringify(cellCards)}`;
            if (doorSystemRef.current) {
                if (cellCards && cellCards !== 'none') {
                    if (lastRenderedCenterCardKeyRef.current !== cardRenderKey || !doorSystemRef.current.centerMesh) {
                        lastRenderedCenterCardKeyRef.current = cardRenderKey;
                        doorSystemRef.current.createCenterSpecialCard(cellCards);
                    }
                } else {
                    lastRenderedCenterCardKeyRef.current = cardRenderKey;
                    doorSystemRef.current.createCenterSpecialCard(null);
                }
            }

            // Hide center card briefly during door bounce/fade-in animation (~1s) when entering a new room
            // to prevent peeking card color through door gaps. After animation (or when standing in room), always show the card.
            if (doorSystemRef.current && doorSystemRef.current.centerMesh) {
                if (isNewRoom) {
                    doorSystemRef.current.centerMesh.visible = false;
                    const meshToShow = doorSystemRef.current.centerMesh;
                    setTimeout(() => {
                        if (meshToShow) meshToShow.visible = true;
                    }, 900);
                } else {
                    doorSystemRef.current.centerMesh.visible = true;
                }
            }
        }
        // Watch old_map (not new_map) for the current cell's cards. old_map is the frozen round-start
        // snapshot: it never clears mid-round after a claim, so the card stays visible throughout Reveal
        // and correctly reflects round-start state during Choosing Phase.
    }, [currentCell.r, currentCell.c, phase, isSkipUsed, JSON.stringify(parseMapMatrix(gameState?.map_matrix).old_map?.[currentCell.r]?.[currentCell.c]?.specialCards || [])]);


    // Door selection highlight (STRICTLY ONLY for current round's pending choice or locked door)
    useEffect(() => {
        const activeDir = lockedDoorDir
            || lockedDoorDirRef.current
            || player?.pendingDoorChoice?.door?.direction
            || player?.lastDoorChoice?.door?.direction
            || lastChosenDirRef.current;

        if (doorSystemRef.current) {
            doorSystemRef.current.setDoorSelected(activeDir || null, isSkipUsed);
        }
    }, [lockedDoorDir, player?.pendingDoorChoice?.door?.direction, player?.lastDoorChoice?.door?.direction, isSkipUsed, phase, gameState?.current_round]);

    useEffect(() => {
        if (skipErrorModal?.show) {
            if (playerControllerRef.current) {
                playerControllerRef.current.unlockPointer();
            }

            const handleWarningKeyDown = (e: KeyboardEvent) => {
                if (Date.now() - modalOpenedAtRef.current < 250) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                if (e.code === 'KeyA' || e.key === 'a' || e.key === 'A') {
                    if (skipErrorModal.pendingDoor) {
                        e.preventDefault();
                        e.stopPropagation();
                        const door = skipErrorModal.pendingDoor;
                        setSkipErrorModal(null);
                        if (onRefundSkipCard) onRefundSkipCard();

                        const costMultiplier = player?.hasUsedGreenCard ? 1 : Math.max(1, player?.nextRoundCostMultiplier || 1);
                        const finalCost = (player?.hasUsedGreenCard || isSkipUsed) ? 0 : (door.cost || 10) * costMultiplier;

                        setSelectedDoor(door);
                        setLockedDoorDir(door.direction);
                        lockedDoorDirRef.current = door.direction;
                        selectedDoorRef.current = door;
                        if (doorSystemRef.current) {
                            doorSystemRef.current.setDoorSelected(door.direction, false);
                        }
                        onSelectDoor(door, finalCost, false);
                        soundEngineRef.current?.playLockClick();
                    }
                } else if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter' || e.code === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setSkipErrorModal(null);
                }
            };

            window.addEventListener('keydown', handleWarningKeyDown);
            return () => window.removeEventListener('keydown', handleWarningKeyDown);
        }
    }, [skipErrorModal?.show, skipErrorModal?.pendingDoor]);

    const greenCardsOwned = (player?.inventory || []).filter(c => c === 'green').length;

    useEffect(() => {
        if (redBlockWarningModal?.show) {
            if (playerControllerRef.current) {
                playerControllerRef.current.unlockPointer();
            }

            const handleRedWarningKeyDown = (e: KeyboardEvent) => {
                if (Date.now() - modalOpenedAtRef.current < 250) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                if (e.code === 'KeyA' || e.key === 'a' || e.key === 'A') {
                    if (greenCardsOwned > 0 && redBlockWarningModal.jokerDir) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onUnblockDoorWithGreenCard) {
                            onUnblockDoorWithGreenCard(redBlockWarningModal.jokerDir);
                        }
                        soundEngineRef.current?.playCardUnlock();
                        setRedBlockWarningModal(null);
                    }
                } else if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter' || e.code === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setRedBlockWarningModal(null);
                }
            };

            window.addEventListener('keydown', handleRedWarningKeyDown);
            return () => window.removeEventListener('keydown', handleRedWarningKeyDown);
        }
    }, [redBlockWarningModal?.show, redBlockWarningModal?.jokerDir, greenCardsOwned, onUnblockDoorWithGreenCard]);

    return (
        <div ref={containerRef} className="fixed inset-0 z-50 w-screen h-screen bg-white overflow-hidden select-none font-mono text-slate-900">
            <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing block" />

            {/* TOP METALLIC WHITE HUB INSIDE 3D WORLD (ULTRA-SLIM IN MOBILE LANDSCAPE) */}
            <div className="absolute top-1.5 left-1.5 right-1.5 sm:top-4 sm:left-4 sm:right-4 z-40 flex flex-row items-center justify-between gap-1 sm:gap-4 p-1.5 sm:p-3.5 bg-white/95 border border-slate-300 rounded-lg sm:rounded-2xl backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] text-slate-900 font-mono overflow-x-auto whitespace-nowrap">
                {/* Left Section: Title & Logo */}
                <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
                    <div className="p-1 sm:p-1.5 bg-slate-100 border border-slate-300 rounded-md sm:rounded-xl shadow-sm flex items-center justify-center shrink-0">
                        <img src="/suit_assets/Joker Game.png" alt="Joker Game Logo" className="w-4 h-4 sm:w-7 sm:h-7 object-contain" />
                    </div>
                    <div>
                        <h1 className="font-cinzel text-[10px] sm:text-xl font-black text-slate-950 tracking-wider uppercase">
                            JOKER <span className="hidden md:inline text-slate-500 font-extrabold">:: LOGIC LABYRINTH</span>
                        </h1>
                        <div className="hidden lg:flex items-center gap-2 mt-0.5">
                            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em] flex items-center gap-1">
                                SUBJECT: <span className="font-black text-slate-900">{player?.username || user?.username || 'AGENT'}</span> // ENTRY R{player?.entryIndex || 1} ➔ EXIT G{player?.targetExitIndex || 1}
                            </p>
                            <span className={`px-2 py-0.2 border rounded-full text-[9px] font-black uppercase tracking-widest font-cinzel shadow-sm ${currentCell?.type === 'exit'
                                ? 'bg-emerald-600 border-emerald-400 text-white animate-pulse'
                                : currentCell?.type === 'entry'
                                    ? 'bg-red-600 border-red-400 text-white'
                                    : 'bg-slate-100 border-slate-300 text-slate-900 shadow-inner'
                                }`}>
                                {currentCell?.type === 'entry' ? `ENTRY R${currentCell.entryIndex || player?.entryIndex || 1}` : currentCell?.type === 'exit' ? `EXIT G${currentCell.exitIndex || player?.targetExitIndex || 1}` : 'ROOM'} ({(currentCell?.r ?? player?.currentR ?? 0) + 1}, {(currentCell?.c ?? player?.currentC ?? 0) + 1})
                            </span>
                        </div>
                    </div>
                </div>

                {/* Center Section: Navigation Hint */}
                <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 border border-slate-300 rounded-xl text-[10px] text-slate-700 font-bold">
                    <span className="text-cyan-700 font-black">WASD / ARROWS</span>
                    <span>MOVE</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-amber-600 font-black">E / SPACEBAR</span>
                    <span>LOCK DOOR</span>
                </div>

                {/* Right Section: Compact Icon Buttons & Metrics */}
                <div className="flex items-center gap-1 sm:gap-4 shrink-0">
                    <button
                        onClick={() => setShowPlayerProfileModal(true)}
                        className="p-1.5 sm:px-3.5 sm:py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center gap-1 shrink-0"
                        title="Open Profile Card"
                    >
                        <User size={14} className="text-slate-700" />
                        <span className="hidden sm:inline">{player?.username || user?.username || 'PROFILE'}</span>
                    </button>

                    <button
                        onClick={() => setShowMapModal(true)}
                        className="p-1.5 sm:px-3.5 sm:py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-400 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-1 shrink-0"
                        title="Open Labyrinth Map"
                    >
                        <MapIcon size={14} className="text-slate-950" />
                        <span className="hidden sm:inline">MAP</span>
                    </button>

                    {onOpenInventory && (
                        <button
                            onClick={onOpenInventory}
                            className="p-1.5 sm:px-3.5 sm:py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center gap-1 shrink-0"
                        >
                            <Briefcase size={14} className="text-slate-700" />
                            <span className="hidden sm:inline">INVENTORY</span>
                            <span className="px-1 py-0.2 bg-emerald-600 text-white text-[9px] rounded font-black">
                                {player?.inventory?.length || 0}
                            </span>
                        </button>
                    )}

                    {/* Compact Metrics Pills */}
                    <div className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-slate-100 border border-slate-300 rounded-lg text-center shrink-0">
                        <span className="text-[7px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-wider block leading-none">R</span>
                        <span className="text-xs sm:text-base font-black font-cinzel text-slate-950 leading-tight">{gameState?.current_round || 1}/14</span>
                    </div>

                    <div className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-slate-100 border border-slate-300 rounded-lg text-center shrink-0">
                        <span className="text-[7px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-wider block leading-none">TIME</span>
                        <span className={`text-xs sm:text-base font-black font-mono leading-tight ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-950'}`}>
                            {timeLeft}s
                        </span>
                    </div>

                    <div className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-slate-100 border border-slate-300 rounded-lg text-center shrink-0">
                        <span className="text-[7px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-wider block leading-none">CR</span>
                        <span className="text-xs sm:text-base font-black font-mono text-emerald-600 leading-tight">{player?.score !== undefined && player?.score !== null ? player.score : 1000}</span>
                    </div>

                    {onClose && (
                        <button onClick={onClose} className="p-1 sm:p-2 text-slate-500 hover:text-slate-950 transition-colors cursor-pointer shrink-0" title="Exit Game">
                            <LogOut size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* 10-SECOND URGENT WARNING TIMER COUNTDOWN BANNER (CHOOSING PHASE) */}
            <AnimatePresence>
                {phase === 'choosing' && timeLeft <= 10 && timeLeft > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.85, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.85, y: -20 }}
                        className="absolute top-32 sm:top-36 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-red-950/95 border-2 border-red-500 rounded-full text-xs font-black text-white shadow-[0_0_40px_rgba(239,68,68,0.8)] backdrop-blur-md flex items-center gap-3 font-mono tracking-widest uppercase animate-pulse"
                    >
                        <Timer size={20} className="text-red-400 animate-spin" />
                        <span className="text-red-100">
                            ⚠️ WARNING: CHOOSING PHASE CLOSING IN <span className="text-red-400 font-black text-sm drop-shadow-[0_0_8px_rgba(239,68,68,1)]">{timeLeft}S</span>
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* NEARBY DOOR NOTIFICATION OVERLAY */}
            <AnimatePresence>
                {nearbyDoorTitle && !lockedDoorDir && !selectedDoor && phase === 'choosing' && timeLeft > 10 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-28 sm:top-36 left-1/2 -translate-x-1/2 z-40 px-3.5 py-2 sm:px-5 sm:py-2.5 bg-amber-950/90 border border-amber-400 rounded-full text-xs font-bold text-amber-300 shadow-2xl backdrop-blur-md flex items-center gap-2"
                    >
                        <Lock size={15} className="animate-pulse shrink-0" />
                        <span className="hidden sm:inline">PRESS [E] OR [SPACE] TO LOCK {nearbyDoorTitle.toUpperCase()}</span>
                        <span className="inline sm:hidden text-[10px] font-black text-amber-200 uppercase tracking-tight">USE BOTTOM BUTTONS TO SELECT {nearbyDoorTitle.toUpperCase()} DOOR</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* BOTTOM WHITE BUTTONS HUB OVERLAY (COMPACT FIT, NO SCROLLBAR) */}
            {(phase === 'choosing' || phase === 'reveal') && (
                <div className="absolute bottom-1.5 sm:bottom-6 left-1/2 -translate-x-1/2 w-fit max-w-[98%] sm:max-w-max z-40 bg-white/95 border border-slate-300 rounded-xl sm:rounded-2xl p-1 sm:p-2.5 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] text-slate-900 font-mono flex flex-row items-center justify-center gap-1 sm:gap-2 no-scrollbar overflow-hidden whitespace-nowrap">
                    <div className="flex flex-row flex-nowrap items-center justify-center gap-1 sm:gap-3 w-full no-scrollbar overflow-hidden py-0.5 sm:py-1">
                        {(['up', 'right', 'down', 'left'] as const).map((dir) => {
                            const door = availableDoors.find(d => d.direction === dir);

                            let t1R = Number(currentCell?.r ?? 0);
                            let t1C = Number(currentCell?.c ?? 0);
                            if (dir === 'up') t1R -= 1;
                            if (dir === 'down') t1R += 1;
                            if (dir === 'left') t1C -= 1;
                            if (dir === 'right') t1C += 1;
                            const target1Cell = (t1R >= 0 && t1R < 7 && t1C >= 0 && t1C < 7) ? gridMatrix[t1R]?.[t1C] : null;
                            const is1StepWallBlocked = !target1Cell || target1Cell.type === 'wall' || target1Cell.isBlockedCell;

                            if (!door || is1StepWallBlocked) {
                                return (
                                    <div key={dir} className="px-1.5 py-1 sm:px-2.5 sm:py-1.5 bg-slate-100 border border-slate-300 rounded-md sm:rounded-lg text-[7.5px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-tight flex items-center gap-0.5 shrink-0 select-none">
                                        <span>{dir.toUpperCase()}</span>
                                        <span>BLOCKED</span>
                                    </div>
                                );
                            }

                            // If player used a Skip card, check if 2-step destination is blocked
                            const isSkipUsed = !!(player?.hasUsedSkipCard || player?.pendingDoorChoice?.isSkip);
                            let isSkipTargetBlocked = false;
                            if (isSkipUsed) {
                                let step1R = Number(player?.currentR || 0);
                                let step1C = Number(player?.currentC || 0);
                                let step2R = Number(player?.currentR || 0);
                                let step2C = Number(player?.currentC || 0);
                                if (dir === 'up') { step1R -= 1; step2R -= 2; }
                                if (dir === 'down') { step1R += 1; step2R += 2; }
                                if (dir === 'left') { step1C -= 1; step2C -= 2; }
                                if (dir === 'right') { step1C += 1; step2C += 2; }
                                const cell1 = gridMatrix[step1R]?.[step1C];
                                const cell2 = gridMatrix[step2R]?.[step2C];
                                if (!cell1 || cell1.type === 'wall' || cell1.isBlockedCell || !cell2 || cell2.type === 'wall' || cell2.isBlockedCell) {
                                    isSkipTargetBlocked = true;
                                }
                            }

                            if (isSkipTargetBlocked) {
                                return (
                                    <button
                                        key={dir}
                                        onClick={() => handleDoorLockToggle(door)}
                                        className="px-1.5 py-1 sm:px-2.5 sm:py-1.5 bg-red-50 border border-red-300 hover:bg-red-100 active:scale-95 rounded-md sm:rounded-lg text-[7.5px] sm:text-[10px] text-red-600 font-extrabold uppercase tracking-tight flex items-center gap-0.5 cursor-pointer transition-all shadow-sm shrink-0 select-none"
                                    >
                                        <span>{dir.toUpperCase()}</span>
                                        <span className="font-black text-red-600">BLOCKED</span>
                                    </button>
                                );
                            }

                            const costMultiplier = player?.hasUsedGreenCard ? 1 : Math.max(1, player?.nextRoundCostMultiplier || 1);
                            const stableCost = stableDoorCostsRef.current[dir] || door.cost || 10;
                            const displayCost = (player?.hasUsedGreenCard || isSkipUsed) ? 0 : stableCost * costMultiplier;

                            const normalizeDir = (d?: string | null) => {
                                if (!d) return '';
                                const lower = String(d).toLowerCase();
                                if (lower === 'north' || lower === 'up') return 'up';
                                if (lower === 'south' || lower === 'down') return 'down';
                                if (lower === 'west' || lower === 'left') return 'left';
                                if (lower === 'east' || lower === 'right') return 'right';
                                return lower;
                            };

                            const rawActiveDir = lockedDoorDir || lockedDoorDirRef.current || player?.pendingDoorChoice?.door?.direction || (player as any)?.boughtDoorChoice?.door?.direction || (player as any)?.lastDoorChoice?.door?.direction || selectedDoorRef.current?.direction || lastChosenDirRef.current;
                            const activeLockedDir = normalizeDir(rawActiveDir);
                            const isLockedThis = activeLockedDir === normalizeDir(dir);

                            return (
                                <button
                                    key={dir}
                                    onClick={() => handleDoorLockToggle(door)}
                                    className={`px-1 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg border flex items-center gap-0.5 sm:gap-1 text-[7.5px] sm:text-[10px] font-black font-mono transition-all cursor-pointer shadow-sm shrink-0 select-none ${isLockedThis
                                        ? isSkipUsed
                                            ? 'bg-blue-600 border-blue-300 text-white ring-1 ring-blue-500/90 shadow-[0_0_15px_rgba(59,130,246,0.9)] animate-pulse scale-105'
                                            : (costMultiplier > 1 && !player?.hasUsedGreenCard)
                                                ? 'bg-amber-400 border-red-600 text-slate-950 ring-1 ring-red-500/90 shadow-[0_0_15px_rgba(239,68,68,0.9)] animate-pulse scale-105'
                                                : 'bg-amber-400 border-amber-300 text-slate-950 ring-1 ring-amber-400/90 shadow-[0_0_15px_rgba(245,158,11,0.9)] animate-pulse scale-105'
                                        : (costMultiplier > 1 && !player?.hasUsedGreenCard)
                                            ? 'bg-red-950/60 hover:bg-red-900/80 border-red-500/80 text-red-100 shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                                            : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900'
                                        }`}
                                >
                                    <span className="uppercase">{dir}:</span>
                                    <span className={isLockedThis ? (isSkipUsed ? 'text-white font-black flex items-center gap-0.5' : 'text-slate-950 font-black flex items-center gap-0.5') : (costMultiplier > 1 && !player?.hasUsedGreenCard ? 'text-red-400 font-black flex items-center gap-0.5' : 'text-emerald-700 font-black')}>
                                        {displayCost} CR {
                                            (costMultiplier > 1 && !player?.hasUsedGreenCard) ? (
                                                <span className={isLockedThis ? "text-red-950 text-[8px] font-black bg-red-500/30 border border-red-950/40 px-0.5 py-0.2 rounded" : "text-red-400 text-[8px] font-extrabold bg-red-950/80 border border-red-500/50 px-0.5 py-0.2 rounded"}>
                                                    ({costMultiplier}X)
                                                </span>
                                            ) : null
                                        }
                                    </span>
                                    {isLockedThis ? (
                                        <Lock size={11} className={isSkipUsed ? "text-white animate-pulse ml-0.5" : "text-slate-950 animate-pulse ml-0.5"} />
                                    ) : (
                                        <Unlock size={11} className={costMultiplier > 1 && !player?.hasUsedGreenCard ? "text-red-400 ml-0.5" : "text-slate-500 ml-0.5"} />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Right side info badge (Only shown if locked or on desktop) */}
                    {lockedDoorDir && (
                        <div className="hidden sm:flex items-center gap-3 shrink-0">
                            <span className="text-xs text-slate-800 font-extrabold uppercase tracking-wider">
                                <span className={isSkipUsed ? "text-blue-600 flex items-center gap-1.5 font-black drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "text-amber-700 flex items-center gap-1.5 font-black"}>
                                    <Lock size={14} /> LOCKED: {lockedDoorDir.toUpperCase()} VECTOR {isSkipUsed ? '(SKIP CARD 2-STEP)' : (currentCell?.doors.find(d => d.direction === lockedDoorDir)?.cardType === 'special' ? '(SECRET CARD)' : '')}
                                </span>
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* MOBILE TOUCH CONTROLS (LEFT: JOYSTICK, RIGHT: JUMP & SIT ACTION BUTTONS LIKE BGMI/PUBG) */}
            <div className="sm:hidden pointer-events-none fixed inset-0 z-50 flex items-end justify-between p-4 pb-16">
                {/* LEFT SIDE: Upgraded Virtual Joystick */}
                <div
                    onTouchStart={handleJoystickTouchStart}
                    onTouchMove={handleJoystickTouchMove}
                    onTouchEnd={handleJoystickTouchEnd}
                    className="pointer-events-auto w-24 h-24 rounded-full border-2 border-cyan-400/80 bg-[#060814]/90 backdrop-blur-xl relative flex items-center justify-center shadow-[0_0_35px_rgba(6,182,212,0.6)] touch-none select-none active:border-cyan-300 transition-all"
                >
                    {/* Radial Ambient Heat Glow Ring */}
                    <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.3)_0%,transparent_70%)] pointer-events-none" />
                    
                    {/* Inner Notches Dial Ring */}
                    <div className="absolute inset-1 rounded-full border border-cyan-500/30 pointer-events-none flex items-center justify-center">
                        <span className="absolute top-0.5 text-[8px] font-black text-cyan-400/70">▲</span>
                        <span className="absolute bottom-0.5 text-[8px] font-black text-cyan-400/70">▼</span>
                        <span className="absolute left-1 text-[8px] font-black text-cyan-400/70">◄</span>
                        <span className="absolute right-1 text-[8px] font-black text-cyan-400/70">►</span>
                    </div>

                    {/* Joystick Move Knob */}
                    <div
                        style={{ transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)` }}
                        className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-200 via-cyan-400 to-cyan-600 border-2 border-white shadow-[0_0_18px_rgba(6,182,212,0.9)] pointer-events-none flex items-center justify-center transition-transform duration-75"
                    >
                        <div className="w-3 h-3 rounded-full bg-white shadow-inner" />
                    </div>
                </div>

                {/* RIGHT SIDE: Action Jump & Sit Buttons (White Theme with Console Logging) */}
                <div className="pointer-events-auto flex items-center gap-2 sm:gap-3">
                    <button
                        onTouchStart={() => {
                            console.log('[TOUCH_ACTION] SIT TOUCHED', playerControllerRef.current);
                            if (playerControllerRef.current) playerControllerRef.current.toggleSit();
                        }}
                        onClick={() => {
                            console.log('[TOUCH_ACTION] SIT CLICKED', playerControllerRef.current);
                            if (playerControllerRef.current) playerControllerRef.current.toggleSit();
                        }}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/95 text-slate-950 border-2 border-amber-500 font-mono font-black shadow-[0_4px_15px_rgba(245,158,11,0.4)] active:scale-90 active:bg-amber-100 flex flex-col items-center justify-center pointer-events-auto backdrop-blur-md cursor-pointer select-none"
                        title="Sit / Crouch"
                    >
                        <span className="text-[9px] sm:text-[10px] leading-none text-amber-600 font-black">▼</span>
                        <span className="text-[8px] font-black text-slate-950 tracking-tighter">SIT</span>
                    </button>

                    <button
                        onTouchStart={() => {
                            console.log('[TOUCH_ACTION] JUMP TOUCHED', playerControllerRef.current);
                            if (playerControllerRef.current) playerControllerRef.current.jump();
                        }}
                        onClick={() => {
                            console.log('[TOUCH_ACTION] JUMP CLICKED', playerControllerRef.current);
                            if (playerControllerRef.current) playerControllerRef.current.jump();
                        }}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/95 text-slate-950 border-2 border-cyan-600 font-mono font-black shadow-[0_4px_15px_rgba(6,182,212,0.4)] active:scale-90 active:bg-cyan-100 flex flex-col items-center justify-center pointer-events-auto backdrop-blur-md cursor-pointer select-none"
                        title="Jump"
                    >
                        <span className="text-[9px] sm:text-[10px] leading-none text-cyan-600 font-black">▲</span>
                        <span className="text-[8px] font-black text-slate-950 tracking-tighter">JUMP</span>
                    </button>
                </div>
            </div>

            {/* PHASE 3 (REVEAL) IN-WORLD HUD (POSITIONED BELOW TOP HEADER BAR) */}
            {phase === 'reveal' && (
                <div className="absolute top-16 sm:top-14 left-1/2 -translate-x-1/2 z-40 max-w-[260px] sm:max-w-md w-full px-2 text-center pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/95 border border-emerald-600 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.25)] text-slate-900 space-y-0.5"
                    >
                        <h4 className="font-cinzel text-[9px] sm:text-xs font-black text-emerald-700 uppercase tracking-widest flex items-center justify-center gap-1">
                            <Zap size={12} className="animate-pulse" />
                            REVEAL PHASE // BOUGHT DOOR OPENED
                        </h4>
                        <p className="text-[7.5px] sm:text-[9px] text-slate-700 font-extrabold uppercase tracking-wider">
                            WALK AROUND FREELY // ADVANCING AT END OF PHASE
                        </p>
                    </motion.div>
                </div>
            )}

            {/* UPGRADED DIALOGUE MODAL CARD FOR SKIP ERROR & WARNINGS */}
            {skipErrorModal?.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="max-w-lg w-full p-6 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] text-slate-100 font-mono text-center relative flex flex-col items-center">
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl mb-3 text-red-400">
                            <AlertTriangle size={32} className="animate-pulse" />
                        </div>
                        <h3 className="text-base font-black font-cinzel tracking-widest text-red-400 uppercase mb-2">
                            {skipErrorModal.title}
                        </h3>
                        <p className="text-xs text-slate-300 font-bold leading-relaxed mb-6">
                            {skipErrorModal.message}
                        </p>

                        {skipErrorModal.pendingDoor ? (
                            <div className="w-full space-y-3">
                                <button
                                    onClick={() => {
                                        const door = skipErrorModal.pendingDoor!;
                                        setSkipErrorModal(null);
                                        if (onRefundSkipCard) onRefundSkipCard();

                                        const costMultiplier = player?.hasUsedGreenCard ? 1 : Math.max(1, player?.nextRoundCostMultiplier || 1);
                                        const finalCost = (player?.hasUsedGreenCard || isSkipUsed) ? 0 : (door.cost || 10) * costMultiplier;

                                        setSelectedDoor(door);
                                        setLockedDoorDir(door.direction);
                                        lockedDoorDirRef.current = door.direction;
                                        selectedDoorRef.current = door;
                                        if (doorSystemRef.current) {
                                            doorSystemRef.current.setDoorSelected(door.direction);
                                        }
                                        onSelectDoor(door, finalCost, false);
                                        soundEngineRef.current?.playLockClick();
                                    }}
                                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
                                >
                                    <span>[PRESS A] PROCEED AS 1-STEP DOOR (REFUND SKIP CARD)</span>
                                </button>

                                <button
                                    onClick={() => setSkipErrorModal(null)}
                                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer border border-slate-700 flex items-center justify-center gap-2"
                                >
                                    <span>[SPACE / ESC] CANCEL & CHOOSE ANOTHER DOOR</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setSkipErrorModal(null)}
                                className="w-full py-3 bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/40 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
                            >
                                <span>CONFIRM [PRESS SPACEBAR / ENTER]</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* RED CARD BLOCKED DOOR WARNING MODAL */}
            {redBlockWarningModal?.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200 font-mono">
                    <div className="max-w-lg w-full p-6 bg-slate-900 border-2 border-red-500 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.5)] text-slate-100 font-mono text-center relative flex flex-col items-center">
                        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-2xl mb-3 text-red-400">
                            <ShieldAlert size={36} className="animate-pulse" />
                        </div>
                        <h3 className="text-lg font-black font-cinzel tracking-widest text-red-400 uppercase mb-1">
                            DOOR BLOCKED BY RED CARD ATTACK
                        </h3>
                        <p className="text-xs text-slate-300 font-bold leading-relaxed mb-4">
                            The <span className="text-red-400 font-black">{redBlockWarningModal.jokerDir.toUpperCase()}</span> vector door was blocked by <span className="text-amber-300 font-black">{player?.blockedByPlayerName || "an opponent"}</span>'s Red Card attack!
                        </p>

                        <div className="w-full p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl mb-5 flex items-center justify-between text-xs">
                            <span className="text-emerald-300 font-bold uppercase tracking-wider">GREEN CARDS OWNED:</span>
                            <span className="text-emerald-400 font-black text-sm">{greenCardsOwned} CARDS</span>
                        </div>

                        <div className="w-full space-y-3">
                            <button
                                disabled={greenCardsOwned === 0}
                                onClick={() => {
                                    if (greenCardsOwned > 0 && redBlockWarningModal.jokerDir) {
                                        if (onUnblockDoorWithGreenCard) {
                                            onUnblockDoorWithGreenCard(redBlockWarningModal.jokerDir);
                                        }
                                        soundEngineRef.current?.playCardUnlock();
                                        setRedBlockWarningModal(null);
                                    }
                                }}
                                className={`w-full py-3 border rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md ${greenCardsOwned > 0
                                    ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white cursor-pointer hover:scale-[1.02]'
                                    : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                                    }`}
                            >
                                <span className="px-1.5 py-0.5 bg-black/40 border border-white/20 text-[10px] rounded">PRESS [A]</span>
                                USE 1 GREEN CARD TO UNBLOCK DOOR
                            </button>

                            <button
                                onClick={() => setRedBlockWarningModal(null)}
                                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer transition-all flex items-center justify-center gap-2"
                            >
                                <span className="px-1.5 py-0.5 bg-black/40 border border-white/20 text-[10px] rounded">PRESS [SPACE]</span>
                                IGNORE & CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PLAYER PROFILE CARD MODAL */}
            {showPlayerProfileModal && (
                <PlayerCardModal
                    user={user || player}
                    onClose={() => setShowPlayerProfileModal(false)}
                    currentGameScore={player?.score}
                />
            )}

            {/* CONSTANT LABYRINTH MAP MODAL */}
            {showMapModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-2xl w-full flex flex-col items-center gap-4 relative shadow-2xl">
                        <button
                            onClick={() => setShowMapModal(false)}
                            className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                            title="Close Map"
                        >
                            <X size={20} />
                        </button>
                        <div className="flex items-center gap-2">
                            <MapIcon className="text-amber-400" size={24} />
                            <h3 className="font-cinzel text-xl font-black text-white tracking-widest uppercase">LABYRINTH MAP</h3>
                        </div>
                        <div className="w-full flex items-center justify-center p-3 bg-slate-950/60 rounded-xl border border-slate-800 overflow-auto max-h-[80vh]">
                            <JokerMapGrid
                                gridMatrix={gridMatrix}
                                players={allPlayers}
                                currentPlayerId={player?.id}
                                isAdminView={false}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

