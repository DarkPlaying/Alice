import * as THREE from 'three';
import gsap from 'gsap';

export interface DoorData3D {
  id: number;
  direction: 'north' | 'south' | 'east' | 'west';
  targetRoom: { x: number; y: number } | THREE.Vector3 | null;
  title: string;
  description: string;
  position: THREE.Vector3;
  pivotGroup: THREE.Group;
  doorMesh: THREE.Mesh;
  doorLocationGroup: THREE.Group;
  ledMat: THREE.MeshStandardMaterial;
  glowFrameMat: THREE.MeshBasicMaterial;
  dirCardMat: THREE.MeshBasicMaterial;
  dirCardMesh: THREE.Mesh;
  isOpen: boolean;
  theme: 'crystal' | 'celestial' | 'gold' | 'nature';
  cost?: number;
  isSelected?: boolean;
}

export interface DoorData extends DoorData3D { }

export class DoorSystem {
  public doors: DoorData3D[] = [];
  private soundEngine: any;
  private scene: THREE.Scene;

  private handleMaterial: THREE.MeshStandardMaterial;
  public centerMesh: THREE.Group | null = null;

  constructor(scene: THREE.Scene, soundEngine: any) {
    this.scene = scene;
    this.soundEngine = soundEngine;

    this.handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.9,
      roughness: 0.1
    });
  }

  public clearDoors() {
    this.doors.forEach((door) => {
      this.scene.remove(door.doorLocationGroup);
    });
    this.doors = [];
    if (this.centerMesh) {
      this.scene.remove(this.centerMesh);
      this.centerMesh = null;
    }
  }

  public getThemeColor(direction: 'north' | 'south' | 'east' | 'west') {
    switch (direction) {
      case 'north':
        return { led: 0x38bdf8, frame: 0x0284c7 };
      case 'south':
        return { led: 0xf43f5e, frame: 0xe11d48 };
      case 'east':
        return { led: 0x10b981, frame: 0x059669 };
      case 'west':
        return { led: 0xa855f7, frame: 0x7c3aed };
    }
  }

  public getCardImageByValue(cost: number = 10, doorId: number = 1): string {
    const validValue = Math.min(Math.max(cost, 10), 14);
    const suits = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
    const suit = suits[(doorId * 7 + validValue) % suits.length];

    let rankStr = '10';
    if (validValue === 10) rankStr = '10';
    if (validValue === 11) rankStr = 'J';
    if (validValue === 12) rankStr = 'Q';
    if (validValue === 13) rankStr = 'K';
    if (validValue === 14) rankStr = 'A';

    return `/borderland_cards/${suit}_${rankStr}.png`;
  }

  private createDirectionCardTexture(
    direction: 'north' | 'south' | 'east' | 'west',
    isSelected: boolean = false,
    isSkip: boolean = false
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 180;
    const ctx = canvas.getContext('2d')!;

    // Sleek Dark Metallic Background Box for high contrast against light walls
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 512, 180);

    let label = 'UP';
    if (direction === 'north') label = 'UP';
    if (direction === 'south') label = 'DOWN';
    if (direction === 'east') label = 'RIGHT';
    if (direction === 'west') label = 'LEFT';

    ctx.font = '900 68px "Cinzel", "Outfit", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const glowColor = isSkip ? '#3b82f6' : '#f59e0b';
    const textColor = isSkip ? '#60a5fa' : '#fbbf24';

    if (isSelected) {
      // Selected state: Glowing border outline + glowing text (Yellow or Electric Blue!)
      ctx.lineWidth = 6;
      ctx.strokeStyle = glowColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 18;
      ctx.strokeRect(16, 16, 480, 148);

      ctx.fillStyle = textColor;
      ctx.fillText(label, 256, 90);
    } else {
      // Unselected state: Subtle slate border + crisp white text
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(16, 16, 480, 148);

      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(label, 256, 90);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  public createDoor(
    id: number,
    direction: 'north' | 'south' | 'east' | 'west',
    arg3: any,
    arg4: any,
    arg5: any,
    arg6?: any,
    arg7?: any,
    arg8?: any,
    arg9?: any,
    arg10?: any
  ): DoorData3D {
    let position: THREE.Vector3;
    let rotationY: number;
    let theme: 'crystal' | 'celestial' | 'gold' | 'nature' = 'crystal';
    let title = `Door ${direction.toUpperCase()}`;
    let description = 'Walk through';
    let targetRoom: any = null;
    let cost = 10;

    if (arg3 instanceof THREE.Vector3) {
      position = arg3;
      rotationY = arg4 || 0;
      theme = arg5 || 'crystal';
      title = arg6 || title;
      description = arg7 || description;
      targetRoom = arg8 || null;
      cost = arg9 || 10;
    } else {
      targetRoom = arg3;
      title = arg4 || title;
      description = arg5 || description;
      position = arg6 || new THREE.Vector3(0, 0, 0);
      rotationY = arg7 || 0;
      theme = arg8 || 'crystal';
      cost = arg9 || 10;
    }

    let specialType: 'red' | 'green' | 'skip' | 'freeze' | 'none' | undefined = arg10 || (arg8 && typeof arg8 === 'string' && ['red', 'green', 'skip', 'freeze'].includes(arg8) ? arg8 : undefined);

    const doorLocationGroup = new THREE.Group();
    doorLocationGroup.position.copy(position);
    doorLocationGroup.rotation.y = rotationY;

    const themeColors = this.getThemeColor(direction);

    const doorWidth = 2.46;
    const doorHeight = 4.2;
    const doorDepth = 0.12;

    const cardTopW = 1.5;
    const cardTopH = 0.55;

    const dirCardTex = this.createDirectionCardTexture(direction, false);
    const dirCardMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: dirCardTex,
      transparent: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    const dirCardGeo = new THREE.PlaneGeometry(cardTopW, cardTopH);
    const dirCardMesh = new THREE.Mesh(dirCardGeo, dirCardMat);
    dirCardMesh.position.set(0, doorHeight + cardTopH / 2 + 0.3, 0.12);
    doorLocationGroup.add(dirCardMesh);

    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(-doorWidth / 2, 0, 0);
    pivotGroup.rotation.y = 0;

    const ledMat = new THREE.MeshStandardMaterial({
      color: themeColors.led,
      emissive: themeColors.led,
      emissiveIntensity: 1.5,
      roughness: 0.1
    });

    const glowFrameGeo = new THREE.BoxGeometry(doorWidth + 0.45, doorHeight + 0.45, 0.2);
    const glowFrameMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });
    const glowFrameMesh = new THREE.Mesh(glowFrameGeo, glowFrameMat);
    glowFrameMesh.position.set(doorWidth / 2, doorHeight / 2, -0.02);
    pivotGroup.add(glowFrameMesh);

    // Tiny slim 3D border framing all 4 sides of the door panel (Must NOT remove/obscure door card image!)
    const bThick = 0.025;
    const borderMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8, // Light slate slim architectural door outline border
      side: THREE.DoubleSide
    });

    const borderTop = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + bThick * 2, bThick, doorDepth + 0.01), borderMat);
    borderTop.position.set(doorWidth / 2, doorHeight + bThick / 2, 0);

    const borderBot = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + bThick * 2, bThick, doorDepth + 0.01), borderMat);
    borderBot.position.set(doorWidth / 2, -bThick / 2, 0);

    const borderLeft = new THREE.Mesh(new THREE.BoxGeometry(bThick, doorHeight, doorDepth + 0.01), borderMat);
    borderLeft.position.set(-bThick / 2, doorHeight / 2, 0);

    const borderRight = new THREE.Mesh(new THREE.BoxGeometry(bThick, doorHeight, doorDepth + 0.01), borderMat);
    borderRight.position.set(doorWidth + bThick / 2, doorHeight / 2, 0);

    pivotGroup.add(borderTop, borderBot, borderLeft, borderRight);

    let cardImgUrl = this.getCardImageByValue(cost, id);
    if (specialType === 'red') cardImgUrl = '/specialcard_joker/red.png';
    else if (specialType === 'green') cardImgUrl = '/specialcard_joker/green.png';
    else if (specialType === 'skip') cardImgUrl = '/specialcard_joker/skip.png';
    else if (specialType === 'freeze') cardImgUrl = '/specialcard_joker/freeze.png';

    const textureLoader = new THREE.TextureLoader();
    const doorTexture = textureLoader.load(
      cardImgUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
      },
      undefined,
      () => {
        doorMat.map = textureLoader.load('/borderland_cards/Spades_10.png');
        doorMat.needsUpdate = true;
      }
    );

    const doorMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: doorTexture,
      side: THREE.FrontSide
    });

    const frontCardGeo = new THREE.PlaneGeometry(doorWidth, doorHeight);
    const frontCardMesh = new THREE.Mesh(frontCardGeo, doorMat);
    frontCardMesh.position.set(doorWidth / 2, doorHeight / 2, doorDepth / 2 + 0.002);

    const backCardGeo = new THREE.PlaneGeometry(doorWidth, doorHeight);
    const backCardMesh = new THREE.Mesh(backCardGeo, doorMat);
    backCardMesh.rotation.y = Math.PI;
    backCardMesh.position.set(doorWidth / 2, doorHeight / 2, -doorDepth / 2 - 0.002);

    const doorMesh = frontCardMesh;

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
    pivotGroup.add(frontCardMesh);
    pivotGroup.add(backCardMesh);
    doorLocationGroup.add(pivotGroup);

    this.scene.add(doorLocationGroup);

    const doorData: DoorData3D = {
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
      glowFrameMat,
      dirCardMat,
      dirCardMesh,
      isOpen: false,
      theme,
      cost,
      isSelected: false
    };

    this.doors.push(doorData);
    return doorData;
  }

  public createReturnDoorway(
    direction: 'north' | 'east' | 'south' | 'west',
    position: THREE.Vector3,
    rotationY: number,
    label: string
  ) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotationY;

    const cardTopW = 1.6;
    const cardTopH = 0.55;
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, 384, 128);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, 376, 120);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 34px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label ? `RETURN ${label}` : 'RETURN', 192, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(cardTopW, cardTopH);
    const badgeMesh = new THREE.Mesh(geo, mat);
    badgeMesh.position.set(0, 4.2 + cardTopH / 2 + 0.3, 0.12);
    group.add(badgeMesh);

    this.scene.add(group);
  }

  public setDoorSelected(dirName: 'up' | 'down' | 'left' | 'right' | 'north' | 'south' | 'east' | 'west' | null, isSkip: boolean = false) {
    let targetDir = dirName;
    if (targetDir === 'up') targetDir = 'north';
    if (targetDir === 'down') targetDir = 'south';
    if (targetDir === 'right') targetDir = 'east';
    if (targetDir === 'left') targetDir = 'west';

    this.doors.forEach((door) => {
      if (door.dirCardMesh) {
        gsap.killTweensOf(door.dirCardMesh.scale);
      }

      const isThisSelected = !!(targetDir && door.direction === targetDir);
      door.isSelected = isThisSelected;

      if (door.dirCardMat) {
        const newTex = this.createDirectionCardTexture(door.direction, isThisSelected, isSkip);
        door.dirCardMat.map = newTex;
        door.dirCardMat.needsUpdate = true;
      }

      if (door.dirCardMesh) {
        if (isThisSelected) {
          gsap.to(door.dirCardMesh.scale, {
            x: 1.28,
            y: 1.28,
            duration: 0.3,
            ease: 'back.out(1.7)'
          });
        } else {
          door.dirCardMesh.scale.set(1.0, 1.0, 1.0);
        }
      }
    });
  }

  public animateDoorsFadeIn(excludeOpenedDoor: boolean = false) {
    this.doors.forEach((door, idx) => {
      if (excludeOpenedDoor && door.isOpen) {
        door.doorLocationGroup.scale.set(1.0, 1.0, 1.0);
        door.doorLocationGroup.position.y = door.position.y;
        return;
      }

      door.doorLocationGroup.scale.set(0.01, 0.01, 0.01);
      door.doorLocationGroup.position.y = door.position.y - 0.6;

      gsap.to(door.doorLocationGroup.scale, {
        x: 1.0,
        y: 1.0,
        z: 1.0,
        duration: 0.8,
        delay: idx * 0.1,
        ease: 'back.out(1.5)'
      });

      gsap.to(door.doorLocationGroup.position, {
        y: door.position.y,
        duration: 0.8,
        delay: idx * 0.1,
        ease: 'power2.out'
      });
    });
  }

  public getNearbyDoor(playerPos: THREE.Vector3): DoorData3D | null {
    for (const door of this.doors) {
      const dist = playerPos.distanceTo(door.position);
      if (dist <= 4.0) {
        return door;
      }
    }
    return null;
  }

  public openDoor(door: DoorData3D, onComplete?: () => void) {
    if (door.isOpen) return;

    door.isOpen = true;

    gsap.to(door.pivotGroup.rotation, {
      y: -Math.PI * 0.65,
      duration: 1.4,
      ease: 'power2.out',
      onComplete: () => {
        if (onComplete) onComplete();
      }
    });
  }

  public openBoughtDoor(boughtDirName?: string | null, instant: boolean = false, isSkip: boolean = false) {
    let targetDir = boughtDirName;
    if (targetDir === 'up') targetDir = 'north';
    if (targetDir === 'down') targetDir = 'south';
    if (targetDir === 'right') targetDir = 'east';
    if (targetDir === 'left') targetDir = 'west';

    console.log(`[DOOR 3D LOG] openBoughtDoor called: targetDir=${targetDir}, instant=${instant}, isSkip=${isSkip}`);

    this.doors.forEach((door) => {
      door.pivotGroup.visible = true;
      door.doorMesh.visible = true;

      if (targetDir && door.direction === targetDir) {
        door.isOpen = true;
        const openAngle = isSkip ? -Math.PI * 0.85 : -Math.PI * 0.65;
        const openDuration = isSkip ? 1.8 : 1.4;

        if (instant) {
          gsap.killTweensOf(door.pivotGroup.rotation);
          door.pivotGroup.rotation.y = openAngle;
        } else if (Math.abs(door.pivotGroup.rotation.y - openAngle) > 0.05) {
          console.log(`[DOOR 3D LOG] OPENING DOOR ${door.direction.toUpperCase()} (isSkip=${isSkip}) to angle ${openAngle.toFixed(2)} rad in ${openDuration}s.`);
          gsap.killTweensOf(door.pivotGroup.rotation);
          gsap.to(door.pivotGroup.rotation, {
            y: openAngle,
            duration: openDuration,
            ease: 'power2.out'
          });
        }
      } else {
        door.isOpen = false;
        if (instant) {
          gsap.killTweensOf(door.pivotGroup.rotation);
          door.pivotGroup.rotation.y = 0;
        } else if (Math.abs(door.pivotGroup.rotation.y) > 0.05) {
          gsap.killTweensOf(door.pivotGroup.rotation);
          gsap.to(door.pivotGroup.rotation, {
            y: 0,
            duration: 0.8,
            ease: 'power2.inOut'
          });
        }
      }
    });
  }

  public openAllDoors() {
    this.doors.forEach((door) => {
      door.isOpen = true;
      door.pivotGroup.visible = true;
      door.doorMesh.visible = true;

      gsap.to(door.pivotGroup.rotation, {
        y: -Math.PI * 0.65,
        duration: 1.4,
        ease: 'power2.out'
      });
    });
  }

  public closeAllDoors(slow: boolean = false, keepOpened: boolean = false) {
    this.doors.forEach((door) => {
      if (keepOpened && door.isOpen) {
        return;
      }
      door.isOpen = false;
      door.pivotGroup.visible = true;
      door.doorMesh.visible = true;

      const duration = slow ? 3.5 : 0.8;

      if (Math.abs(door.pivotGroup.rotation.y) > 0.05) {
        gsap.killTweensOf(door.pivotGroup.rotation);
        gsap.to(door.pivotGroup.rotation, {
          y: 0,
          duration: duration,
          ease: 'power2.inOut'
        });
      }
    });
  }

  public closeDoor1(dirName?: string | null) {
    this.closeAllDoors(false);
  }

  public closeDoor2() {
    this.closeAllDoors(false);
  }

  public spawnCenterItem(cost: number = 10, isPenalty: boolean = false, cardTypeOrDir?: any) {
    this.createCenterSpecialCard('standard', cost);
  }

  public updateCenterItem(cost: number = 10, isPenalty: boolean = false, cardTypeOrDir?: any) {
    this.createCenterSpecialCard('standard', cost);
  }

  private textureCache: Map<string, THREE.Texture> = new Map();

  private getCachedTexture(url: string, loader: THREE.TextureLoader): THREE.Texture {
    if (this.textureCache.has(url)) {
      return this.textureCache.get(url)!;
    }
    const tex = loader.load(url, (t) => {
      t.needsUpdate = true;
      t.colorSpace = THREE.SRGBColorSpace;
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textureCache.set(url, tex);
    return tex;
  }

  // Selected Room Floating Card (Renders Special/None Card inside the selected room behind open door)
  public createCenterSpecialCard(cardInput: any = 'none', cost: number = 10, doorDir?: string, doorId?: number): THREE.Group {
    if (this.centerMesh) {
      this.scene.remove(this.centerMesh);
      this.centerMesh = null;
    }

    let targetX = 0;
    let targetZ = 0;
    if (doorDir === 'north' || doorDir === 'up') targetZ = -16.4;
    else if (doorDir === 'south' || doorDir === 'down') targetZ = 16.4;
    else if (doorDir === 'east' || doorDir === 'right') { targetX = 16.4; targetZ = 0; }
    else if (doorDir === 'west' || doorDir === 'left') { targetX = -16.4; targetZ = 0; }

    const group = new THREE.Group();
    group.position.set(targetX, 2.5, targetZ);

    let cardTypes: string[] = [];
    if (Array.isArray(cardInput)) {
      cardTypes = cardInput.filter(c => c);
    } else if (typeof cardInput === 'string') {
      cardTypes = [cardInput];
    }

    if (cardTypes.length === 0) cardTypes = ['none'];

    const totalCards = cardTypes.length;
    let cardWidth = 2.2;
    let cardHeight = 3.3;
    const offsets: number[] = [];

    if (totalCards === 1) {
      offsets.push(0);
      cardWidth = 2.2;
      cardHeight = 3.3;
    } else if (totalCards === 2) {
      offsets.push(-1.05, 1.05);
      cardWidth = 1.45;
      cardHeight = 2.18;
    } else if (totalCards === 3) {
      offsets.push(-1.3, 0, 1.3);
      cardWidth = 1.15;
      cardHeight = 1.72;
    } else {
      cardWidth = 1.0;
      cardHeight = 1.5;
      const step = 2.6 / (totalCards - 1);
      for (let i = 0; i < totalCards; i++) {
        offsets.push(-1.3 + i * step);
      }
    }

    const textureLoader = new THREE.TextureLoader();

    cardTypes.forEach((cType, idx) => {
      const cardSubGroup = new THREE.Group();

      if (doorDir === 'east' || doorDir === 'right' || doorDir === 'west' || doorDir === 'left') {
        cardSubGroup.position.set(0, 0, offsets[idx]);
      } else {
        cardSubGroup.position.set(offsets[idx], 0, 0);
      }

      let cardImgUrl = '/specialcard_joker/none.png';
      if (cType === 'red') cardImgUrl = '/specialcard_joker/red.png';
      if (cType === 'green') cardImgUrl = '/specialcard_joker/green.png';
      if (cType === 'skip') cardImgUrl = '/specialcard_joker/skip.png';
      if (cType === 'freeze') cardImgUrl = '/specialcard_joker/freeze.png';
      if (cType === 'trump' || cType === 'trumph') cardImgUrl = '/specialcard_joker/trumph.png';
      if (cType === 'win') cardImgUrl = '/specialcard_joker/Win Card.png';
      if (cType === 'standard') cardImgUrl = this.getCardImageByValue(cost, doorId || 1);

      const loadedTexture = this.getCachedTexture(cardImgUrl, textureLoader);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map: loadedTexture,
        side: THREE.DoubleSide,
        transparent: true
      });

      const geo = new THREE.PlaneGeometry(cardWidth, cardHeight);
      const mesh = new THREE.Mesh(geo, material);
      cardSubGroup.add(mesh);

      let glowColor = 0xf59e0b;
      if (cType === 'red') glowColor = 0xef4444;
      if (cType === 'green') glowColor = 0x10b981;
      if (cType === 'skip') glowColor = 0x3b82f6;
      if (cType === 'freeze') glowColor = 0x06b6d4;
      if (cType === 'trump' || cType === 'trumph') glowColor = 0xeab308;
      if (cType === 'win') glowColor = 0x10b981;

      const light = new THREE.PointLight(glowColor, 2.5, 5.0);
      light.position.set(0, 0, 0.3);
      cardSubGroup.add(light);

      group.add(cardSubGroup);
    });

    const baseY = 2.5;
    gsap.to(group.position, {
      y: baseY + 0.2,
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });

    group.rotation.y = -0.15;
    gsap.to(group.rotation, {
      y: 0.15,
      duration: 3.0,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });

    this.scene.add(group);
    this.centerMesh = group;
    return group;
  }

  public triggerSparkleBurst(position: THREE.Vector3) {
    const particleCount = 12;
    const group = new THREE.Group();
    group.position.copy(position);

    for (let i = 0; i < particleCount; i++) {
      const pGeo = new THREE.SphereGeometry(0.015, 6, 6);
      const colors = [0xf59e0b, 0xef4444, 0x10b981, 0x38bdf8, 0xffffff];
      const pMat = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        transparent: true,
        opacity: 0.8
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(0, 0, 0);
      group.add(pMesh);

      const targetX = (Math.random() - 0.5) * 0.8;
      const targetY = (Math.random() - 0.5) * 0.8;
      const targetZ = (Math.random() - 0.5) * 0.8;

      gsap.to(pMesh.position, {
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: 0.4,
        ease: 'power2.out'
      });

      gsap.to(pMat, {
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in',
        onComplete: () => {
          group.remove(pMesh);
        }
      });
    }

    this.scene.add(group);
    setTimeout(() => {
      this.scene.remove(group);
    }, 500);
  }

  public removeCenterSpecialCard() {
    if (this.centerMesh) {
      this.scene.remove(this.centerMesh);
      this.centerMesh = null;
    }
  }
}
