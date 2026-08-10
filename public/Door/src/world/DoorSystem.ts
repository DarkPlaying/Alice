import * as THREE from 'three';
import gsap from 'gsap';
import { TextureGenerator } from '../textures/TextureGenerator';
import { SoundEngine } from '../audio/SoundEngine';
import { TextureConfig } from '../config/TextureConfig';

export interface DoorData {
  id: number;
  direction: 'north' | 'south' | 'east' | 'west';
  targetRoom: { x: number; y: number } | null;
  title: string;
  description: string;
  position: THREE.Vector3;
  pivotGroup: THREE.Group;
  doorMesh: THREE.Mesh;
  doorLocationGroup: THREE.Group;
  ledMat: THREE.MeshStandardMaterial;
  isOpen: boolean;
  theme: 'crystal' | 'celestial' | 'gold' | 'nature';
}

export class DoorSystem {
  public doors: DoorData[] = [];
  private soundEngine: SoundEngine;
  private scene: THREE.Scene;

  // Cached materials for 0-lag creation
  private doorMaterial: THREE.MeshStandardMaterial;
  private frameMaterial: THREE.MeshStandardMaterial;
  private handleMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, soundEngine: SoundEngine) {
    this.scene = scene;
    this.soundEngine = soundEngine;

    // Roughness 1.0 & Metalness 0.0 eliminates glossy glare reflection on door image artwork
    this.doorMaterial = new THREE.MeshStandardMaterial({
      roughness: 1.0,
      metalness: 0.0
    });

    this.frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.0,
      roughness: 1.0
    });

    this.handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.0,
      roughness: 1.0
    });

    this.updateDoorMaterialFromConfig();
  }

  private parseColor(colorStr: string): THREE.Color {
    if (!colorStr) return new THREE.Color(0x0f172a);
    let cleanStr = colorStr.trim();
    if (cleanStr.startsWith('#') && cleanStr.length === 9) {
      cleanStr = cleanStr.substring(0, 7);
    }
    try {
      return new THREE.Color(cleanStr);
    } catch {
      return new THREE.Color(0x0f172a);
    }
  }

  /**
   * Updates door material from TextureConfig dynamically.
   */
  public updateDoorMaterialFromConfig() {
    const textureLoader = new THREE.TextureLoader();

    if (TextureConfig.USE_DOOR_IMAGE && TextureConfig.DOOR_IMAGE) {
      const doorMap = textureLoader.load(
        TextureConfig.DOOR_IMAGE,
        (tex) => {
          tex.needsUpdate = true;
          this.doorMaterial.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn(`[DoorSystem] Failed to load door image "${TextureConfig.DOOR_IMAGE}":`, err);
          const { map: doorMap } = TextureGenerator.createModernDoorTexture();
          this.doorMaterial.map = doorMap;
          this.doorMaterial.color = this.parseColor(TextureConfig.DOOR_COLOR);
          this.doorMaterial.needsUpdate = true;
        }
      );
      doorMap.wrapS = THREE.ClampToEdgeWrapping;
      doorMap.wrapT = THREE.ClampToEdgeWrapping;
      doorMap.repeat.set(1, 1);
      this.doorMaterial.map = doorMap;
      this.doorMaterial.normalMap = null;
      this.doorMaterial.roughnessMap = null;
      this.doorMaterial.color = new THREE.Color(0xffffff);
    } else {
      const { map: doorMap } = TextureGenerator.createModernDoorTexture();
      this.doorMaterial.map = doorMap;
      this.doorMaterial.color = this.parseColor(TextureConfig.DOOR_COLOR);
    }
    this.doorMaterial.needsUpdate = true;
  }

  public clearDoors() {
    this.doors.forEach((d) => {
      if (d.doorLocationGroup && d.doorLocationGroup.parent) {
        d.doorLocationGroup.parent.remove(d.doorLocationGroup);
      }
    });
    this.doors = [];
  }

  public isAnyDoorOpen(): boolean {
    return this.doors.some((d) => d.isOpen);
  }

  public createDoor(
    id: number,
    direction: 'north' | 'south' | 'east' | 'west',
    targetRoom: { x: number; y: number } | null,
    title: string,
    description: string,
    position: THREE.Vector3,
    rotationY: number,
    theme: 'crystal' | 'celestial' | 'gold' | 'nature'
  ): DoorData {
    this.updateDoorMaterialFromConfig();

    // Door Dimensions driven by DOOR_PIXEL_WIDTH and DOOR_PIXEL_HEIGHT
    const doorAspect = (TextureConfig.DOOR_PIXEL_HEIGHT || 2516) / (TextureConfig.DOOR_PIXEL_WIDTH || 1696);
    const doorWidth = 2.8;
    const doorHeight = doorWidth * doorAspect;
    const doorDepth = 0.12;

    const doorLocationGroup = new THREE.Group();
    doorLocationGroup.position.copy(position);
    doorLocationGroup.rotation.y = rotationY;

    const ledMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0
    });

    // Dark Frame (Only added if SHOW_DOOR_FRAME is true)
    if (TextureConfig.SHOW_DOOR_FRAME !== false) {
      const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, doorHeight + 0.2, 0.25), this.frameMaterial);
      frameLeft.position.set(-doorWidth / 2 - 0.09, doorHeight / 2, 0);

      const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.18, doorHeight + 0.2, 0.25), this.frameMaterial);
      frameRight.position.set(doorWidth / 2 + 0.09, doorHeight / 2, 0);

      const frameTop = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.36, 0.18, 0.25), this.frameMaterial);
      frameTop.position.set(0, doorHeight + 0.09, 0);

      const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.2, 0.03, 0.06), ledMat);
      ledStrip.position.set(0, doorHeight + 0.18, 0.1);

      doorLocationGroup.add(frameLeft, frameRight, frameTop, ledStrip);
    }

    // Hinge Pivot Group
    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(-doorWidth / 2, 0, 0);

    // Door Mesh driven by pixel width & height
    const doorGeo = new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth);
    const doorMesh = new THREE.Mesh(doorGeo, this.doorMaterial);
    doorMesh.position.set(doorWidth / 2, doorHeight / 2, 0);

    // --- DOOR PANEL BORDER LINES ---
    if (TextureConfig.ENABLE_BORDER_LINES) {
      const doorBorderMat = new THREE.MeshBasicMaterial({
        color: this.parseColor(TextureConfig.BORDER_LINE_COLOR || '#475569'),
        transparent: true,
        opacity: TextureConfig.BORDER_LINE_OPACITY ?? 0.5
      });
      const bThick = 0.03;
      const dHW = doorWidth / 2;
      const dHH = doorHeight / 2;
      const dHD = doorDepth / 2 + 0.005;

      // Front Face Border Outline
      const lineTop = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, bThick, bThick), doorBorderMat);
      lineTop.position.set(0, dHH - bThick / 2, dHD);

      const lineBot = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, bThick, bThick), doorBorderMat);
      lineBot.position.set(0, -dHH + bThick / 2, dHD);

      const lineLeft = new THREE.Mesh(new THREE.BoxGeometry(bThick, doorHeight, bThick), doorBorderMat);
      lineLeft.position.set(-dHW + bThick / 2, 0, dHD);

      const lineRight = new THREE.Mesh(new THREE.BoxGeometry(bThick, doorHeight, bThick), doorBorderMat);
      lineRight.position.set(dHW - bThick / 2, 0, dHD);

      doorMesh.add(lineTop, lineBot, lineLeft, lineRight);
    }

    // Sleek Pure White LED Handle
    const handleGroup = new THREE.Group();
    const handleBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, Math.min(0.6, doorHeight * 0.4), 0.04), this.handleMaterial);
    handleBar.position.set(0, 0, 0.04);

    const handleLED = new THREE.Mesh(new THREE.BoxGeometry(0.015, Math.min(0.52, doorHeight * 0.35), 0.045), ledMat);
    handleLED.position.set(0, 0, 0.042);

    const stemGeo = new THREE.BoxGeometry(0.03, 0.03, 0.04);
    const topStem = new THREE.Mesh(stemGeo, this.handleMaterial);
    topStem.position.set(0, 0.22, 0.02);

    const bottomStem = new THREE.Mesh(stemGeo, this.handleMaterial);
    bottomStem.position.set(0, -0.22, 0.02);

    handleGroup.add(handleBar, handleLED, topStem, bottomStem);
    handleGroup.position.set(doorWidth * 0.42, -doorHeight * 0.1, 0.06);

    doorMesh.add(handleGroup);
    pivotGroup.add(doorMesh);
    doorLocationGroup.add(pivotGroup);

    this.scene.add(doorLocationGroup);

    const doorData: DoorData = {
      id,
      direction,
      targetRoom,
      title,
      description,
      position,
      pivotGroup,
      doorMesh,
      doorLocationGroup,
      ledMat,
      isOpen: false,
      theme
    };

    this.doors.push(doorData);
    return doorData;
  }

  public animateDoorsFadeIn() {
    this.doors.forEach((door) => {
      door.doorLocationGroup.scale.set(1.0, 1.0, 1.0);
      door.ledMat.emissiveIntensity = 1.0;
    });
  }

  public getNearbyDoor(playerPos: THREE.Vector3): DoorData | null {
    for (const door of this.doors) {
      const dist = playerPos.distanceTo(door.position);
      if (dist <= 3.4) {
        return door;
      }
    }
    return null;
  }

  public openDoor(door: DoorData, onComplete?: () => void) {
    if (this.isAnyDoorOpen() && !door.isOpen) {
      return; // Do not open another door if one door is already open
    }
    if (door.isOpen) return;

    door.isOpen = true;
    this.soundEngine.playDoorCreak();

    gsap.to(door.pivotGroup.rotation, {
      y: -Math.PI * 0.6,
      duration: 1.4,
      ease: 'power2.inOut',
      onComplete: () => {
        if (onComplete) onComplete();
      }
    });
  }

  public closeDoor(door: DoorData, onComplete?: () => void) {
    door.isOpen = false;

    gsap.to(door.pivotGroup.rotation, {
      y: 0,
      duration: 3.5,
      ease: 'power2.out',
      onComplete: () => {
        this.soundEngine.playDoorClose();
        if (onComplete) onComplete();
      }
    });
  }
}
