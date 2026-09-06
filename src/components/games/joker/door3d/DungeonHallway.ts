import * as THREE from 'three';
import gsap from 'gsap';
import { TestDoorSystem as DoorSystem } from './TestDoorSystem';
import type { MapCell } from '../jokerTypes';
import { DOOR_3D_CONFIG } from './door3dConfig';

export interface EnvironmentSurfaceSettings {
  useTexture?: boolean;
  imageUrl?: string;
  color?: string;
  repeatX?: number;
  repeatY?: number;
  offsetX?: number;
  offsetY?: number;
  rotation?: number; // degrees
  wrapMode?: 'clamp' | 'repeat' | 'mirror';
}

export const THEME_DATA_MAP: Record<string, { imageUrl: string; floorColor: string; rotation: number }> = {
  'Red': { imageUrl: '/Color/Red.jpg', floorColor: '#460735', rotation: 90 },
  'Blue': { imageUrl: '/Color/Blue.jpg', floorColor: '#241830', rotation: 90 },
  'green': { imageUrl: '/Color/green.jpg', floorColor: '#0C1F00', rotation: 0 },
  'Yellow': { imageUrl: '/Color/Yellow 2.jpg', floorColor: '#5F5D21', rotation: 0 },
  'Yellow 2': { imageUrl: '/Color/Yellow 2.jpg', floorColor: '#5F5D21', rotation: 0 },
  'White': { imageUrl: '/Color/White.jpg', floorColor: '#BFBFBF', rotation: 90 },
};

export function resolveCardRoomTheme(cell: MapCell | null | undefined, newMapGrid?: MapCell[][]): string {
  let cards: string[] = [];
  if (cell) {
    const r = cell.r;
    const c = cell.c;
    const targetCell = (newMapGrid && r !== undefined && c !== undefined && newMapGrid[r]?.[c]) 
      ? newMapGrid[r][c] 
      : cell;
    const rawCards = targetCell.specialCards || (targetCell as any).cardType || cell.specialCards || (cell as any).cardType || [];
    cards = (Array.isArray(rawCards) ? rawCards : [rawCards]).filter((c: any) => c && c !== 'none');
  }

  if (cards.length === 0) {
    return 'White';
  }

  const chosenCard = cards.length === 1 ? cards[0] : cards[Math.floor(Math.random() * cards.length)];
  const cardStr = String(chosenCard).toLowerCase().trim();

  if (cardStr.includes('red')) {
    return 'Red';
  }
  if (cardStr.includes('freeze')) {
    return 'Blue';
  }
  if (cardStr.includes('green')) {
    return 'green';
  }
  if (cardStr.includes('skip') || cardStr.includes('trump')) {
    return 'Yellow';
  }

  return 'White';
}

export class DungeonHallway {
  private scene: THREE.Scene;
  public roomGroup: THREE.Group;
  private player: any = null;
  private roomCardMap: { [key: string]: string[] } = {};

  private wallMaterial: THREE.MeshBasicMaterial;
  private floorMaterial: THREE.MeshBasicMaterial;
  private ceilingMaterial: THREE.MeshBasicMaterial;
  private smoothWhiteMat: THREE.MeshBasicMaterial;
  private doorOpeningBorderMat: THREE.MeshBasicMaterial;
  private cornerLineMaterial: THREE.LineBasicMaterial;
  private cornerBeamMat: THREE.MeshBasicMaterial;

  private floorTexture: THREE.Texture | null = null;
  private ceilingTexture: THREE.Texture | null = null;
  private textureLoader = new THREE.TextureLoader();

  public currentCorridorWidth: number = 4.15;
  public currentCorridorHeight: number = 4.60;
  public currentCornerEdgeCut: number = 0.55;
  public currentWallScaleNorth: number = 1.0;
  public currentWallScaleSides: number = 1.0;

  private lastCell?: MapCell;
  private lastDoorSystem?: DoorSystem;
  private lastGridMatrix?: MapCell[][];
  private lastIsSkip: boolean = false;
  private lastIsRevealPhase: boolean = false;

  private cityWallTexture: THREE.Texture | null = null;
  public currentTheme: string = 'green';
  private textureCache: Map<string, THREE.Texture> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);

    this.cornerBeamMat = new THREE.MeshBasicMaterial({
      color: 0x333333, // Light black corner beams
      side: THREE.DoubleSide
    });

    this.cornerLineMaterial = new THREE.LineBasicMaterial({
      color: 0x333333, // Light black room outline lines
      linewidth: 3,
      depthTest: true,
      depthWrite: false
    });

    this.smoothWhiteMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2
    });

    this.doorOpeningBorderMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a, // Dark metallic architectural doorway frame border
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2
    });

    const defaultWallUrl = '/Color/green.jpg';
    const cityWallTexture = this.getThemeTexture(defaultWallUrl, 1.0, 1.0);
    this.cityWallTexture = cityWallTexture;

    this.wallMaterial = new THREE.MeshBasicMaterial({
      map: cityWallTexture,
      color: 0xffffff,
      side: THREE.DoubleSide
    });

    const floorTexture = this.getThemeTexture(defaultWallUrl, 1.0, 1.1);
    this.floorTexture = floorTexture;

    this.floorMaterial = new THREE.MeshBasicMaterial({
      map: floorTexture,
      color: 0xffffff,
      side: THREE.DoubleSide
    });

    const ceilingTexture = this.getThemeTexture(defaultWallUrl, 1.0, 1.0);
    this.ceilingTexture = ceilingTexture;

    this.ceilingMaterial = new THREE.MeshBasicMaterial({
      map: ceilingTexture,
      color: 0xffffff,
      side: THREE.DoubleSide
    });
  }

  public getThemeTexture(url: string, repeatX = 1.0, repeatY = 1.0): THREE.Texture {
    const key = `${url}__${repeatX}_${repeatY}`;
    const cached = this.textureCache.get(key);
    if (cached) {
      return cached;
    }
    const tex = this.textureLoader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    this.textureCache.set(key, tex);
    return tex;
  }

  public applyRoomTheme(theme: string, customImageUrl?: string) {
    this.currentTheme = theme;

    let imageUrl = customImageUrl;
    if (!imageUrl) {
      if (theme === 'Plain White' || theme === 'white_room') {
        imageUrl = '';
      } else {
        const themeMap: Record<string, string> = {
          'Blue': '/Color/Blue.jpg',
          'green': '/Color/green.jpg',
          'green_card': '/Color/green.jpg',
          'Red': '/Color/Red.jpg',
          'White': '/Color/White.jpg',
          'Yellow': '/Color/Yellow 2.jpg',
          'Yellow 2': '/Color/Yellow 2.jpg',
        };
        imageUrl = themeMap[theme] || `/Color/${theme}.jpg`;
      }
    }

    if (!imageUrl || theme === 'Plain White' || theme === 'white_room') {
      this.wallMaterial.map = null;
      this.wallMaterial.color.set(0xffffff);
      this.floorMaterial.map = null;
      this.floorMaterial.color.set(0xffffff);
      this.ceilingMaterial.map = null;
      this.ceilingMaterial.color.set(0xffffff);
    } else {
      const wallTex = this.getThemeTexture(imageUrl, 1.0, 1.0);
      this.cityWallTexture = wallTex;
      this.wallMaterial.map = wallTex;
      this.wallMaterial.color.set(0xffffff);

      if (theme === 'Blue') {
        wallTex.center.set(0.5, 0.5);
        wallTex.rotation = (90 * Math.PI) / 180;
        wallTex.needsUpdate = true;

        // Image 2: Floor & ceiling solid color #241830
        this.floorMaterial.map = null;
        this.floorMaterial.color.set('#241830');

        this.ceilingMaterial.map = null;
        this.ceilingMaterial.color.set('#241830');
      } else if (theme === 'green' || theme === 'green_card') {
        wallTex.center.set(0.5, 0.5);
        wallTex.rotation = 0;
        wallTex.needsUpdate = true;

        // Image 3: Floor & ceiling solid color #0C1F00
        this.floorMaterial.map = null;
        this.floorMaterial.color.set('#0C1F00');

        this.ceilingMaterial.map = null;
        this.ceilingMaterial.color.set('#0C1F00');
      } else if (theme === 'Red') {
        wallTex.center.set(0.5, 0.5);
        wallTex.rotation = (90 * Math.PI) / 180;
        wallTex.needsUpdate = true;

        // Red: Floor & ceiling solid color #460735
        this.floorMaterial.map = null;
        this.floorMaterial.color.set('#460735');

        this.ceilingMaterial.map = null;
        this.ceilingMaterial.color.set('#460735');
      } else if (theme === 'White') {
        wallTex.center.set(0.5, 0.5);
        wallTex.rotation = (90 * Math.PI) / 180;
        wallTex.needsUpdate = true;

        // White: Floor & ceiling solid color #BFBFBF
        this.floorMaterial.map = null;
        this.floorMaterial.color.set('#BFBFBF');

        this.ceilingMaterial.map = null;
        this.ceilingMaterial.color.set('#BFBFBF');
      } else if (theme === 'Yellow' || theme === 'Yellow 2') {
        wallTex.center.set(0.5, 0.5);
        wallTex.rotation = 0;
        wallTex.needsUpdate = true;

        // Yellow (formerly Yellow 2): Floor & ceiling solid color #5F5D21
        this.floorMaterial.map = null;
        this.floorMaterial.color.set('#5F5D21');

        this.ceilingMaterial.map = null;
        this.ceilingMaterial.color.set('#5F5D21');
      } else {
        wallTex.center.set(0.5, 0.5);
        wallTex.rotation = 0;
        wallTex.needsUpdate = true;

        const floorTex = this.getThemeTexture(imageUrl, 1.0, 1.1);
        this.floorTexture = floorTex;
        this.floorMaterial.map = floorTex;
        this.floorMaterial.color.set(0xffffff);

        const ceilingTex = this.getThemeTexture(imageUrl, 1.0, 1.0);
        this.ceilingTexture = ceilingTex;
        this.ceilingMaterial.map = ceilingTex;
        this.ceilingMaterial.color.set(0xffffff);
      }
    }
    this.wallMaterial.needsUpdate = true;
    this.floorMaterial.needsUpdate = true;
    this.cornerLineMaterial.visible = true;
    this.cornerBeamMat.visible = true;
  }

  public updateEnvironmentColors(floorColor?: string | number, ceilingColor?: string | number) {
    if (floorColor !== undefined) {
      this.floorMaterial.color.set(floorColor as any);
    }
    if (ceilingColor !== undefined) {
      this.ceilingMaterial.color.set(ceilingColor as any);
    }
    this.cornerLineMaterial.visible = true;
    this.cornerBeamMat.visible = true;
  }

  public updateWallSettings(settings: EnvironmentSurfaceSettings) {
    if (settings.color !== undefined) {
      this.wallMaterial.color.set(settings.color as any);
    }
    if (settings.useTexture && settings.imageUrl) {
      if (!this.cityWallTexture || (this.cityWallTexture as any)._sourceUrl !== settings.imageUrl) {
        this.cityWallTexture = this.textureLoader.load(settings.imageUrl);
        (this.cityWallTexture as any)._sourceUrl = settings.imageUrl;
      }
      this.cityWallTexture.colorSpace = THREE.SRGBColorSpace;
      const wrapMode = settings.wrapMode || 'repeat';
      if (wrapMode === 'clamp') {
        this.cityWallTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.cityWallTexture.wrapT = THREE.ClampToEdgeWrapping;
      } else if (wrapMode === 'mirror') {
        this.cityWallTexture.wrapS = THREE.MirroredRepeatWrapping;
        this.cityWallTexture.wrapT = THREE.MirroredRepeatWrapping;
      } else {
        this.cityWallTexture.wrapS = THREE.RepeatWrapping;
        this.cityWallTexture.wrapT = THREE.RepeatWrapping;
      }
      this.cityWallTexture.repeat.set(settings.repeatX ?? 1, settings.repeatY ?? 1);
      this.cityWallTexture.offset.set(settings.offsetX ?? 0, settings.offsetY ?? 0);
      this.cityWallTexture.center.set(0.5, 0.5);
      this.cityWallTexture.rotation = ((settings.rotation ?? 0) * Math.PI) / 180;
      this.cityWallTexture.needsUpdate = true;
      this.wallMaterial.map = this.cityWallTexture;
    } else if (settings.useTexture === false) {
      this.wallMaterial.map = null;
    }
    this.wallMaterial.needsUpdate = true;
  }

  public updateFloorSettings(settings: EnvironmentSurfaceSettings) {
    if (settings.color !== undefined) {
      this.floorMaterial.color.set(settings.color as any);
    }
    if (settings.useTexture && settings.imageUrl) {
      if (!this.floorTexture || (this.floorTexture as any)._sourceUrl !== settings.imageUrl) {
        this.floorTexture = this.textureLoader.load(settings.imageUrl);
        (this.floorTexture as any)._sourceUrl = settings.imageUrl;
      }
      this.floorTexture.colorSpace = THREE.SRGBColorSpace;
      const wrapMode = settings.wrapMode || 'repeat';
      if (wrapMode === 'clamp') {
        this.floorTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.floorTexture.wrapT = THREE.ClampToEdgeWrapping;
      } else if (wrapMode === 'mirror') {
        this.floorTexture.wrapS = THREE.MirroredRepeatWrapping;
        this.floorTexture.wrapT = THREE.MirroredRepeatWrapping;
      } else {
        this.floorTexture.wrapS = THREE.RepeatWrapping;
        this.floorTexture.wrapT = THREE.RepeatWrapping;
      }
      this.floorTexture.repeat.set(settings.repeatX ?? 1, settings.repeatY ?? 1);
      this.floorTexture.offset.set(settings.offsetX ?? 0, settings.offsetY ?? 0);
      this.floorTexture.center.set(0.5, 0.5);
      this.floorTexture.rotation = ((settings.rotation ?? 0) * Math.PI) / 180;
      this.floorTexture.needsUpdate = true;
      this.floorMaterial.map = this.floorTexture;
    } else if (settings.useTexture === false) {
      this.floorMaterial.map = null;
    }
    this.floorMaterial.needsUpdate = true;

    const isWhite = this.currentTheme === 'White' || this.currentTheme === 'Plain White' || this.currentTheme === 'white_room' ||
                    this.floorMaterial.color.getHexString() === 'ffffff' || this.floorMaterial.color.getHexString() === 'bfbfbf';
    this.cornerLineMaterial.visible = isWhite;
    this.cornerBeamMat.visible = isWhite;
  }

  public updateCeilingSettings(settings: EnvironmentSurfaceSettings) {
    if (settings.color !== undefined) {
      this.ceilingMaterial.color.set(settings.color as any);
    }
    if (settings.useTexture && settings.imageUrl) {
      if (!this.ceilingTexture || (this.ceilingTexture as any)._sourceUrl !== settings.imageUrl) {
        this.ceilingTexture = this.textureLoader.load(settings.imageUrl);
        (this.ceilingTexture as any)._sourceUrl = settings.imageUrl;
      }
      this.ceilingTexture.colorSpace = THREE.SRGBColorSpace;
      const wrapMode = settings.wrapMode || 'repeat';
      if (wrapMode === 'clamp') {
        this.ceilingTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.ceilingTexture.wrapT = THREE.ClampToEdgeWrapping;
      } else if (wrapMode === 'mirror') {
        this.ceilingTexture.wrapS = THREE.MirroredRepeatWrapping;
        this.ceilingTexture.wrapT = THREE.MirroredRepeatWrapping;
      } else {
        this.ceilingTexture.wrapS = THREE.RepeatWrapping;
        this.ceilingTexture.wrapT = THREE.RepeatWrapping;
      }
      this.ceilingTexture.repeat.set(settings.repeatX ?? 1, settings.repeatY ?? 1);
      this.ceilingTexture.offset.set(settings.offsetX ?? 0, settings.offsetY ?? 0);
      this.ceilingTexture.center.set(0.5, 0.5);
      this.ceilingTexture.rotation = ((settings.rotation ?? 0) * Math.PI) / 180;
      this.ceilingTexture.needsUpdate = true;
      this.ceilingMaterial.map = this.ceilingTexture;
    } else if (settings.useTexture === false) {
      this.ceilingMaterial.map = null;
    }
    this.ceilingMaterial.needsUpdate = true;
  }

  public setSegmentUVs(geometry: THREE.BufferGeometry, minU: number, maxU: number, minV: number, maxV: number) {
    const uvAttribute = geometry.attributes.uv;
    if (!uvAttribute) return;
    for (let i = 0; i < uvAttribute.count; i++) {
      let u = uvAttribute.getX(i);
      let v = uvAttribute.getY(i);
      u = minU + u * (maxU - minU);
      v = minV + v * (maxV - minV);
      uvAttribute.setXY(i, u, v);
    }
    uvAttribute.needsUpdate = true;
  }

  private createBlockedWallBadgeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 140;
    const ctx = canvas.getContext('2d')!;

    // Outer dark metallic/glass sci-fi background matching direction cards
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, 512, 140);

    const grad = ctx.createLinearGradient(0, 0, 512, 140);
    grad.addColorStop(0, '#060a12');
    grad.addColorStop(0.5, '#450a0a'); // Dark crimson core
    grad.addColorStop(1, '#060a12');
    ctx.fillStyle = grad;
    ctx.fillRect(8, 8, 496, 124);

    // Glowing Crimson Neon Border
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ef4444';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 14;
    ctx.strokeRect(8, 8, 496, 124);

    // Accent lines top & bottom
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(24, 14, 464, 2);
    ctx.fillRect(24, 124, 464, 2);

    // Hazard striped corner brackets
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;
    // Top-Left bracket
    ctx.beginPath(); ctx.moveTo(16, 32); ctx.lineTo(16, 16); ctx.lineTo(32, 16); ctx.stroke();
    // Top-Right bracket
    ctx.beginPath(); ctx.moveTo(496 - 16, 16); ctx.lineTo(496, 16); ctx.lineTo(496, 32); ctx.stroke();
    // Bottom-Left bracket
    ctx.beginPath(); ctx.moveTo(16, 124 - 16); ctx.lineTo(16, 124); ctx.lineTo(32, 124); ctx.stroke();
    // Bottom-Right bracket
    ctx.beginPath(); ctx.moveTo(496 - 16, 124); ctx.lineTo(496, 124); ctx.lineTo(496, 124 - 16); ctx.stroke();

    // Blocked Status Indicator Dot
    ctx.beginPath();
    ctx.arc(42, 70, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 12;
    ctx.fill();

    // Main Text Centered
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 28px "Cinzel", "Outfit", "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 10;
    ctx.fillText('BLOCKED WALL', 256, 56);

    ctx.font = '700 12px "Outfit", "Inter", monospace';
    ctx.fillStyle = '#fda4af';
    ctx.shadowBlur = 4;
    ctx.fillText('NO EXIT // SECTOR RESTRICTED', 256, 92);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  private createCornerWedgeGeo(
    pCorner: THREE.Vector2,
    pHoriz: THREE.Vector2,
    pVert: THREE.Vector2,
    depth: number,
    roomSize: number,
    wallHeight: number,
    uScale: number,
    vScale: number
  ): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const normals: number[] = [];

    const getUV = (x: number, y: number) => {
      const u = ((x + roomSize / 2) / roomSize) * uScale;
      const v = (y / wallHeight) * vScale;
      return [u, v];
    };

    const addTri = (
      pA: { x: number; y: number; z: number },
      pB: { x: number; y: number; z: number },
      pC: { x: number; y: number; z: number }
    ) => {
      positions.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z);
      const uvA = getUV(pA.x, pA.y);
      const uvB = getUV(pB.x, pB.y);
      const uvC = getUV(pC.x, pC.y);
      uvs.push(uvA[0], uvA[1], uvB[0], uvB[1], uvC[0], uvC[1]);

      const vAB = new THREE.Vector3(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z);
      const vAC = new THREE.Vector3(pC.x - pA.x, pC.y - pA.y, pC.z - pA.z);
      const norm = new THREE.Vector3().crossVectors(vAB, vAC).normalize();
      normals.push(norm.x, norm.y, norm.z, norm.x, norm.y, norm.z, norm.x, norm.y, norm.z);
    };

    const c = pCorner;
    const h = pHoriz;
    const v = pVert;

    // Front Face (z = 0)
    addTri({ x: c.x, y: c.y, z: 0 }, { x: v.x, y: v.y, z: 0 }, { x: h.x, y: h.y, z: 0 });

    // Back Face (z = -depth)
    addTri({ x: c.x, y: c.y, z: -depth }, { x: h.x, y: h.y, z: -depth }, { x: v.x, y: v.y, z: -depth });

    // Diagonal Chamfer Cut Face
    addTri({ x: h.x, y: h.y, z: 0 }, { x: v.x, y: v.y, z: 0 }, { x: v.x, y: v.y, z: -depth });
    addTri({ x: h.x, y: h.y, z: 0 }, { x: v.x, y: v.y, z: -depth }, { x: h.x, y: h.y, z: -depth });

    // Horizontal Face
    addTri({ x: c.x, y: c.y, z: 0 }, { x: h.x, y: h.y, z: 0 }, { x: h.x, y: h.y, z: -depth });
    addTri({ x: c.x, y: c.y, z: 0 }, { x: h.x, y: h.y, z: -depth }, { x: c.x, y: c.y, z: -depth });

    // Vertical Face
    addTri({ x: c.x, y: c.y, z: 0 }, { x: v.x, y: v.y, z: -depth }, { x: v.x, y: v.y, z: 0 });
    addTri({ x: c.x, y: c.y, z: 0 }, { x: c.x, y: c.y, z: -depth }, { x: v.x, y: v.y, z: -depth });

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geo;
  }

  public updateCorridorAndWallSettings(settings: {
    corridorWidth?: number;
    corridorHeight?: number;
    cornerEdgeCut?: number;
    wallScaleNorth?: number;
    wallScaleSides?: number;
  }) {
    if (settings.corridorWidth !== undefined) this.currentCorridorWidth = settings.corridorWidth;
    if (settings.corridorHeight !== undefined) this.currentCorridorHeight = settings.corridorHeight;
    if (settings.cornerEdgeCut !== undefined) this.currentCornerEdgeCut = settings.cornerEdgeCut;
    if (settings.wallScaleNorth !== undefined) this.currentWallScaleNorth = settings.wallScaleNorth;
    if (settings.wallScaleSides !== undefined) this.currentWallScaleSides = settings.wallScaleSides;

    if (this.lastCell && this.lastDoorSystem && this.lastGridMatrix) {
      this.rebuildRoomForCell(this.lastCell, this.lastDoorSystem, this.lastGridMatrix, this.lastIsSkip, this.player, this.lastIsRevealPhase);
    }
  }

  public rebuildRoomForCell(cell: MapCell, doorSystem: DoorSystem, gridMatrix: MapCell[][], isSkip: boolean = false, player?: any, isRevealPhase: boolean = false) {
    this.player = player;
    this.lastCell = cell;
    this.lastDoorSystem = doorSystem;
    this.lastGridMatrix = gridMatrix;
    this.lastIsSkip = isSkip;
    this.lastIsRevealPhase = isRevealPhase;

    while (this.roomGroup.children.length > 0) {
      const child = this.roomGroup.children[0];
      this.roomGroup.remove(child);
    }

    doorSystem.clearDoors();

    const roomSize = DOOR_3D_CONFIG.ROOM_SIZE;
    const height = DOOR_3D_CONFIG.ROOM_HEIGHT;
    const doorWidth = this.currentCorridorWidth;
    const doorHeight = this.currentCorridorHeight;
    const wallThickness = DOOR_3D_CONFIG.WALL_THICKNESS;
    const doorOffsetPos = roomSize / 2; // Exact wall position for 0 gap!

    (doorSystem as any).setDoorDimensions?.(doorWidth, doorHeight);

    const floorGeo = new THREE.PlaneGeometry(roomSize, roomSize);
    const floor = new THREE.Mesh(floorGeo, this.floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    this.roomGroup.add(floor);

    const ceilingGeo = new THREE.PlaneGeometry(roomSize, roomSize);
    const ceiling = new THREE.Mesh(ceilingGeo, this.ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = height;
    this.roomGroup.add(ceiling);

    // Clean 3D vector lines & physical architectural corner beams matching destination room
    const beamThick = 0.025; // 2.5cm crisp architectural border
    const halfR = roomSize / 2 - 0.01;
    const cornerBeamGroup = new THREE.Group();

    // 1. Vector Lines
    const cornerPoints: THREE.Vector3[] = [
      // 4 Floor Lines
      new THREE.Vector3(-halfR, 0.01, -halfR), new THREE.Vector3(halfR, 0.01, -halfR),
      new THREE.Vector3(halfR, 0.01, -halfR), new THREE.Vector3(halfR, 0.01, halfR),
      new THREE.Vector3(halfR, 0.01, halfR), new THREE.Vector3(-halfR, 0.01, halfR),
      new THREE.Vector3(-halfR, 0.01, halfR), new THREE.Vector3(-halfR, 0.01, -halfR),

      // 4 Ceiling Lines
      new THREE.Vector3(-halfR, height - 0.01, -halfR), new THREE.Vector3(halfR, height - 0.01, -halfR),
      new THREE.Vector3(halfR, height - 0.01, -halfR), new THREE.Vector3(halfR, height - 0.01, halfR),
      new THREE.Vector3(halfR, height - 0.01, halfR), new THREE.Vector3(-halfR, height - 0.01, halfR),
      new THREE.Vector3(-halfR, height - 0.01, halfR), new THREE.Vector3(-halfR, height - 0.01, -halfR),

      // 4 Vertical Corner Pillars
      new THREE.Vector3(-halfR, 0.01, -halfR), new THREE.Vector3(-halfR, height - 0.01, -halfR),
      new THREE.Vector3(halfR, 0.01, -halfR), new THREE.Vector3(halfR, height - 0.01, -halfR),
      new THREE.Vector3(-halfR, 0.01, halfR), new THREE.Vector3(-halfR, height - 0.01, halfR),
      new THREE.Vector3(halfR, 0.01, halfR), new THREE.Vector3(halfR, height - 0.01, halfR),
    ];

    const cornerLineGeo = new THREE.BufferGeometry().setFromPoints(cornerPoints);
    const cornerLines = new THREE.LineSegments(cornerLineGeo, this.cornerLineMaterial);
    cornerBeamGroup.add(cornerLines);

    // 2. Physical 3D Black Corner Beams (Guarantees crisp, solid architectural lines in current room)
    const northFloorBeam = new THREE.Mesh(new THREE.BoxGeometry(roomSize, beamThick, beamThick), this.cornerBeamMat);
    northFloorBeam.position.set(0, beamThick / 2, -halfR + beamThick / 2);

    const southFloorBeam = new THREE.Mesh(new THREE.BoxGeometry(roomSize, beamThick, beamThick), this.cornerBeamMat);
    southFloorBeam.position.set(0, beamThick / 2, halfR - beamThick / 2);

    const eastFloorBeam = new THREE.Mesh(new THREE.BoxGeometry(beamThick, beamThick, roomSize), this.cornerBeamMat);
    eastFloorBeam.position.set(halfR - beamThick / 2, beamThick / 2, 0);

    const westFloorBeam = new THREE.Mesh(new THREE.BoxGeometry(beamThick, beamThick, roomSize), this.cornerBeamMat);
    westFloorBeam.position.set(-halfR + beamThick / 2, beamThick / 2, 0);

    const northCeilBeam = new THREE.Mesh(new THREE.BoxGeometry(roomSize, beamThick, beamThick), this.cornerBeamMat);
    northCeilBeam.position.set(0, height - beamThick / 2, -halfR + beamThick / 2);

    const southCeilBeam = new THREE.Mesh(new THREE.BoxGeometry(roomSize, beamThick, beamThick), this.cornerBeamMat);
    southCeilBeam.position.set(0, height - beamThick / 2, halfR - beamThick / 2);

    const eastCeilBeam = new THREE.Mesh(new THREE.BoxGeometry(beamThick, beamThick, roomSize), this.cornerBeamMat);
    eastCeilBeam.position.set(halfR - beamThick / 2, height - beamThick / 2, 0);

    const westCeilBeam = new THREE.Mesh(new THREE.BoxGeometry(beamThick, beamThick, roomSize), this.cornerBeamMat);
    westCeilBeam.position.set(-halfR + beamThick / 2, height - beamThick / 2, 0);

    const nwPillar = new THREE.Mesh(new THREE.BoxGeometry(beamThick, height, beamThick), this.cornerBeamMat);
    nwPillar.position.set(-halfR + beamThick / 2, height / 2, -halfR + beamThick / 2);

    const nePillar = new THREE.Mesh(new THREE.BoxGeometry(beamThick, height, beamThick), this.cornerBeamMat);
    nePillar.position.set(halfR - beamThick / 2, height / 2, -halfR + beamThick / 2);

    const swPillar = new THREE.Mesh(new THREE.BoxGeometry(beamThick, height, beamThick), this.cornerBeamMat);
    swPillar.position.set(-halfR + beamThick / 2, height / 2, halfR - beamThick / 2);

    const sePillar = new THREE.Mesh(new THREE.BoxGeometry(beamThick, height, beamThick), this.cornerBeamMat);
    sePillar.position.set(halfR - beamThick / 2, height / 2, halfR - beamThick / 2);

    cornerBeamGroup.add(
      northFloorBeam, southFloorBeam, eastFloorBeam, westFloorBeam,
      northCeilBeam, southCeilBeam, eastCeilBeam, westCeilBeam,
      nwPillar, nePillar, swPillar, sePillar
    );

    this.roomGroup.add(cornerBeamGroup);

    const buildWallWithFullRoomView = (
      position: THREE.Vector3,
      rotationY: number,
      hasDoor: boolean,
      isSkipPassage: boolean = false,
      destCell?: MapCell | null,
      doorCost: number = 10,
      doorId: number = 1,
      specialType?: string,
      directionName: 'north' | 'east' | 'south' | 'west' = 'north'
    ) => {
      const wallGroup = new THREE.Group();
      wallGroup.position.copy(position);
      wallGroup.rotation.y = rotationY;

      // Dynamic wallpaper scale per direction
      const isNorth = directionName === 'north';
      const uScale = isNorth ? this.currentWallScaleNorth : this.currentWallScaleSides;
      const vScale = isNorth ? this.currentWallScaleNorth : this.currentWallScaleSides;

      const corridorW = this.currentCorridorWidth;
      const corridorH = this.currentCorridorHeight;
      // Overlap wall blocks behind outer door frame (18-35cm) to guarantee 0 gaps from all angles
      const wallOverlap = hasDoor ? Math.max(0.18, corridorW * 0.08) : 0;
      const cutoutW = Math.max(1.0, corridorW - wallOverlap * 2);
      const cutoutH = Math.max(1.5, corridorH - wallOverlap);
      const sideWidth = (roomSize - cutoutW) / 2;
      const topHeight = height - cutoutH;

      if (!hasDoor) {
        const wallGeo = new THREE.PlaneGeometry(roomSize, height);
        this.setSegmentUVs(wallGeo, 0, uScale, 0, vScale);
        const wallMesh = new THREE.Mesh(wallGeo, this.wallMaterial);
        wallMesh.position.set(0, height / 2, 0);
        wallGroup.add(wallMesh);

        // 3D "BLOCKED WALL" sign badge on solid non-door walls
        const badgeTex = this.createBlockedWallBadgeTexture();
        const badgeMat = new THREE.MeshBasicMaterial({
          map: badgeTex,
          transparent: true,
          side: THREE.DoubleSide
        });
        const badgeMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.65), badgeMat);
        badgeMesh.position.set(0, height / 2, 0.04);
        wallGroup.add(badgeMesh);
      } else {
        // Solid 3D Wall Blocks for Left, Right, and Top sections with 100% natural, undistorted UV aspect ratio
        const leftGeo = new THREE.BoxGeometry(sideWidth, height, wallThickness);
        this.setSegmentUVs(leftGeo, 0, (sideWidth / roomSize) * uScale, 0, vScale);
        const leftBlock = new THREE.Mesh(leftGeo, this.wallMaterial);
        leftBlock.position.set(-(cutoutW / 2 + sideWidth / 2), height / 2, -wallThickness / 2);

        const rightGeo = new THREE.BoxGeometry(sideWidth, height, wallThickness);
        this.setSegmentUVs(rightGeo, uScale - (sideWidth / roomSize) * uScale, uScale, 0, vScale);
        const rightBlock = new THREE.Mesh(rightGeo, this.wallMaterial);
        rightBlock.position.set(cutoutW / 2 + sideWidth / 2, height / 2, -wallThickness / 2);

        const topGeo = new THREE.BoxGeometry(cutoutW, topHeight, wallThickness);
        this.setSegmentUVs(
          topGeo,
          (sideWidth / roomSize) * uScale,
          uScale - (sideWidth / roomSize) * uScale,
          (cutoutH / height) * vScale,
          vScale
        );
        const topBlock = new THREE.Mesh(topGeo, this.wallMaterial);
        topBlock.position.set(0, height - topHeight / 2, -wallThickness / 2);

        wallGroup.add(leftBlock, rightBlock, topBlock);

        const chamfer = Math.min(this.currentCornerEdgeCut, cutoutW * 0.45, cutoutH * 0.45);
        if (chamfer > 0.01) {
          // 4 Chamfered Corner Edge Cut wedges for sci-fi octagonal door opening
          const tlGeo = this.createCornerWedgeGeo(
            new THREE.Vector2(-cutoutW / 2, cutoutH),
            new THREE.Vector2(-cutoutW / 2 + chamfer, cutoutH),
            new THREE.Vector2(-cutoutW / 2, cutoutH - chamfer),
            wallThickness, roomSize, height, uScale, vScale
          );
          const tlMesh = new THREE.Mesh(tlGeo, this.wallMaterial);

          const trGeo = this.createCornerWedgeGeo(
            new THREE.Vector2(cutoutW / 2, cutoutH),
            new THREE.Vector2(cutoutW / 2 - chamfer, cutoutH),
            new THREE.Vector2(cutoutW / 2, cutoutH - chamfer),
            wallThickness, roomSize, height, uScale, vScale
          );
          const trMesh = new THREE.Mesh(trGeo, this.wallMaterial);

          const blGeo = this.createCornerWedgeGeo(
            new THREE.Vector2(-cutoutW / 2, 0),
            new THREE.Vector2(-cutoutW / 2 + chamfer, 0),
            new THREE.Vector2(-cutoutW / 2, chamfer),
            wallThickness, roomSize, height, uScale, vScale
          );
          const blMesh = new THREE.Mesh(blGeo, this.wallMaterial);

          const brGeo = this.createCornerWedgeGeo(
            new THREE.Vector2(cutoutW / 2, 0),
            new THREE.Vector2(cutoutW / 2 - chamfer, 0),
            new THREE.Vector2(cutoutW / 2, chamfer),
            wallThickness, roomSize, height, uScale, vScale
          );
          const brMesh = new THREE.Mesh(brGeo, this.wallMaterial);

          wallGroup.add(tlMesh, trMesh, blMesh, brMesh);
        }
      }

      if (hasDoor) {
        // Complete adjoining room preview space behind open door (Extends 2 rooms for skip!)
        const previewGroup = new THREE.Group();
        const offsetZ = wallThickness;
        const depthMultiplier = isSkipPassage ? 2 : 1;
        const previewDepth = roomSize * depthMultiplier;
        const pCenterZ = -previewDepth / 2 - offsetZ;

        // Resolve destination room theme according to its cards
        const destThemeId = resolveCardRoomTheme(destCell);
        const destThemeConfig = THEME_DATA_MAP[destThemeId] || THEME_DATA_MAP['White'];
        const destWallTex = this.getThemeTexture(destThemeConfig.imageUrl, 1.0, 1.0);
        if (destThemeConfig.rotation !== 0) {
          destWallTex.center.set(0.5, 0.5);
          destWallTex.rotation = (destThemeConfig.rotation * Math.PI) / 180;
          destWallTex.needsUpdate = true;
        }
        const destWallMat = new THREE.MeshBasicMaterial({ map: destWallTex, color: 0xffffff, side: THREE.DoubleSide });
        const destFloorMat = new THREE.MeshBasicMaterial({ color: destThemeConfig.floorColor, side: THREE.DoubleSide });
        const destCeilingMat = new THREE.MeshBasicMaterial({ color: destThemeConfig.floorColor, side: THREE.DoubleSide });

        const prevFloor = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, previewDepth), destFloorMat);
        prevFloor.rotation.x = -Math.PI / 2;
        prevFloor.position.set(0, 0, pCenterZ);

        const prevCeilingGeo = new THREE.PlaneGeometry(roomSize, previewDepth);
        const prevCeiling = new THREE.Mesh(prevCeilingGeo, destCeilingMat);
        prevCeiling.rotation.x = Math.PI / 2;
        prevCeiling.position.y = height;
        prevCeiling.position.set(0, height, pCenterZ);

        const prevBackWallGeo = new THREE.PlaneGeometry(roomSize, height);
        this.setSegmentUVs(prevBackWallGeo, 0, 1, 0, 1);
        const prevBackWall = new THREE.Mesh(prevBackWallGeo, destWallMat);
        prevBackWall.position.set(0, height / 2, -previewDepth - offsetZ);

        const prevLeftWallGeo = new THREE.PlaneGeometry(previewDepth, height);
        this.setSegmentUVs(prevLeftWallGeo, 0, depthMultiplier, 0, 1);
        const prevLeftWall = new THREE.Mesh(prevLeftWallGeo, destWallMat);
        prevLeftWall.rotation.y = Math.PI / 2;
        prevLeftWall.position.set(-roomSize / 2, height / 2, pCenterZ);

        const prevRightWallGeo = new THREE.PlaneGeometry(previewDepth, height);
        this.setSegmentUVs(prevRightWallGeo, 0, depthMultiplier, 0, 1);
        const prevRightWall = new THREE.Mesh(prevRightWallGeo, destWallMat);
        prevRightWall.rotation.y = -Math.PI / 2;
        prevRightWall.position.set(roomSize / 2, height / 2, pCenterZ);

        // Front divider wall facing back into the preview room so looking backward shows a clean wall
        const prevFrontLeftGeo = new THREE.PlaneGeometry(sideWidth, height);
        this.setSegmentUVs(prevFrontLeftGeo, 0, sideWidth / roomSize, 0, 1);
        const prevFrontLeft = new THREE.Mesh(prevFrontLeftGeo, destWallMat);
        prevFrontLeft.rotation.y = Math.PI;
        prevFrontLeft.position.set(-(cutoutW / 2 + sideWidth / 2), height / 2, -offsetZ);

        const prevFrontRightGeo = new THREE.PlaneGeometry(sideWidth, height);
        this.setSegmentUVs(prevFrontRightGeo, 1 - sideWidth / roomSize, 1, 0, 1);
        const prevFrontRight = new THREE.Mesh(prevFrontRightGeo, destWallMat);
        prevFrontRight.rotation.y = Math.PI;
        prevFrontRight.position.set(cutoutW / 2 + sideWidth / 2, height / 2, -offsetZ);

        const prevFrontTopGeo = new THREE.PlaneGeometry(cutoutW, topHeight);
        this.setSegmentUVs(prevFrontTopGeo, sideWidth / roomSize, 1 - sideWidth / roomSize, cutoutH / height, 1);
        const prevFrontTop = new THREE.Mesh(prevFrontTopGeo, destWallMat);
        prevFrontTop.rotation.y = Math.PI;
        prevFrontTop.position.set(0, cutoutH + topHeight / 2, -offsetZ);


        // Clean 3D vector lines & architectural corner beams for adjoining preview and destination room
        const beamThick = 0.025; // 2.5cm crisp architectural border
        const inward = 0.035; // 3.5cm inward from outer boundaries to guarantee zero z-fighting

        const pHalfR = roomSize / 2 - inward;
        const z0 = -offsetZ;
        const z1 = -roomSize - offsetZ;
        const z2 = isSkipPassage ? -roomSize * 2 - offsetZ : z1;

        const prevLinePoints: THREE.Vector3[] = [];
        const prevBeamsGroup = new THREE.Group();

        const addRoomBeamsAndLines = (startZ: number, endZ: number) => {
          const pNear = startZ - inward;
          const pFar = endZ + inward;
          const pFloor = inward;
          const pCeil = height - inward;
          const depth = Math.abs(pNear - pFar);
          const centerZ = (pNear + pFar) / 2;

          // 1. Vector Lines
          // 4 Floor perimeter lines
          prevLinePoints.push(
            new THREE.Vector3(-pHalfR, pFloor, pNear), new THREE.Vector3(pHalfR, pFloor, pNear),
            new THREE.Vector3(pHalfR, pFloor, pNear), new THREE.Vector3(pHalfR, pFloor, pFar),
            new THREE.Vector3(pHalfR, pFloor, pFar), new THREE.Vector3(-pHalfR, pFloor, pFar),
            new THREE.Vector3(-pHalfR, pFloor, pFar), new THREE.Vector3(-pHalfR, pFloor, pNear)
          );

          // 4 Ceiling perimeter lines
          prevLinePoints.push(
            new THREE.Vector3(-pHalfR, pCeil, pNear), new THREE.Vector3(pHalfR, pCeil, pNear),
            new THREE.Vector3(pHalfR, pCeil, pNear), new THREE.Vector3(pHalfR, pCeil, pFar),
            new THREE.Vector3(pHalfR, pCeil, pFar), new THREE.Vector3(-pHalfR, pCeil, pFar),
            new THREE.Vector3(-pHalfR, pCeil, pFar), new THREE.Vector3(-pHalfR, pCeil, pNear)
          );

          // 4 Vertical Corner Pillars
          prevLinePoints.push(
            new THREE.Vector3(-pHalfR, pFloor, pNear), new THREE.Vector3(-pHalfR, pCeil, pNear),
            new THREE.Vector3(pHalfR, pFloor, pNear), new THREE.Vector3(pHalfR, pCeil, pNear),
            new THREE.Vector3(-pHalfR, pFloor, pFar), new THREE.Vector3(-pHalfR, pCeil, pFar),
            new THREE.Vector3(pHalfR, pFloor, pFar), new THREE.Vector3(pHalfR, pCeil, pFar)
          );

          // 2. Physical 3D Black Corner Beams (Guarantees crisp visibility at any distance in WebGL)
          // Back Wall Beams (Floor, Ceiling, Left & Right Vertical Pillars)
          const backFloorBeam = new THREE.Mesh(new THREE.BoxGeometry(roomSize, beamThick, beamThick), this.cornerBeamMat);
          backFloorBeam.position.set(0, beamThick / 2, pFar);

          const backCeilBeam = new THREE.Mesh(new THREE.BoxGeometry(roomSize, beamThick, beamThick), this.cornerBeamMat);
          backCeilBeam.position.set(0, height - beamThick / 2, pFar);

          const backLeftPillar = new THREE.Mesh(new THREE.BoxGeometry(beamThick, height, beamThick), this.cornerBeamMat);
          backLeftPillar.position.set(-roomSize / 2 + beamThick / 2, height / 2, pFar);

          const backRightPillar = new THREE.Mesh(new THREE.BoxGeometry(beamThick, height, beamThick), this.cornerBeamMat);
          backRightPillar.position.set(roomSize / 2 - beamThick / 2, height / 2, pFar);

          // Side Wall Beams (Left Floor, Right Floor, Left Ceiling, Right Ceiling)
          const leftFloorBeam = new THREE.Mesh(new THREE.BoxGeometry(beamThick, beamThick, depth), this.cornerBeamMat);
          leftFloorBeam.position.set(-roomSize / 2 + beamThick / 2, beamThick / 2, centerZ);

          const rightFloorBeam = new THREE.Mesh(new THREE.BoxGeometry(beamThick, beamThick, depth), this.cornerBeamMat);
          rightFloorBeam.position.set(roomSize / 2 - beamThick / 2, beamThick / 2, centerZ);

          const leftCeilBeam = new THREE.Mesh(new THREE.BoxGeometry(beamThick, beamThick, depth), this.cornerBeamMat);
          leftCeilBeam.position.set(-roomSize / 2 + beamThick / 2, height - beamThick / 2, centerZ);

          const rightCeilBeam = new THREE.Mesh(new THREE.BoxGeometry(beamThick, beamThick, depth), this.cornerBeamMat);
          rightCeilBeam.position.set(roomSize / 2 - beamThick / 2, height - beamThick / 2, centerZ);

          // Front Vertical Pillars
          const frontLeftPillar = new THREE.Mesh(new THREE.BoxGeometry(beamThick, height, beamThick), this.cornerBeamMat);
          frontLeftPillar.position.set(-roomSize / 2 + beamThick / 2, height / 2, pNear);

          const frontRightPillar = new THREE.Mesh(new THREE.BoxGeometry(beamThick, height, beamThick), this.cornerBeamMat);
          frontRightPillar.position.set(roomSize / 2 - beamThick / 2, height / 2, pNear);

          prevBeamsGroup.add(
            backFloorBeam, backCeilBeam, backLeftPillar, backRightPillar,
            leftFloorBeam, rightFloorBeam, leftCeilBeam, rightCeilBeam,
            frontLeftPillar, frontRightPillar
          );
        };

        addRoomBeamsAndLines(z0, z1);
        if (isSkipPassage) {
          addRoomBeamsAndLines(z1, z2);
        }

        prevBeamsGroup.visible = true;

        const prevLineGeo = new THREE.BufferGeometry().setFromPoints(prevLinePoints);
        const prevLineMesh = new THREE.LineSegments(prevLineGeo, this.cornerLineMaterial);
        prevLineMesh.visible = true;

        previewGroup.add(
          prevFloor, prevCeiling, prevBackWall, prevLeftWall, prevRightWall,
          prevFrontLeft, prevFrontRight, prevFrontTop,
          prevBeamsGroup,
          prevLineMesh
        );

        // Floating special/standard card at center of FINAL destination preview room ONLY (never in middle skipped room)
        if (destCell) {
          const textureLoader = new THREE.TextureLoader();
          const previewCardWidth = 1.4;
          const previewCardHeight = 2.1;
          const cardCenterZ = isSkipPassage ? (-roomSize * 1.5 - offsetZ) : (-roomSize / 2 - offsetZ);

          const destKey = `${destCell.r}_${destCell.c}`;
          let cardTypes: string[] = ((destCell.specialCards || []) as string[]).filter((c: string) => c && c !== 'none');

          const assignedExit = this.player?.targetExitIndex || this.player?.entryIndex;
          if (destCell.type === 'exit') {
            if (typeof destCell.exitIndex === 'number' && destCell.exitIndex === assignedExit) {
              cardTypes = ['win'];
            } else {
              cardTypes = [];
            }
          }
          cardTypes = cardTypes.filter(c => c && c !== 'none');

          if (cardTypes.length > 0) {
            // Show special card types with spacing
            const totalCards = cardTypes.length;
            let previewCardWidth = 1.3;
            let previewCardHeight = 1.95;
            let spacing: number[] = [0];

            if (totalCards === 1) {
              spacing = [0];
              previewCardWidth = 1.3;
              previewCardHeight = 1.95;
            } else if (totalCards === 2) {
              spacing = [-0.85, 0.85];
              previewCardWidth = 1.05;
              previewCardHeight = 1.575;
            } else if (totalCards === 3) {
              spacing = [-1.15, 0, 1.15];
              previewCardWidth = 0.88;
              previewCardHeight = 1.32;
            }

            cardTypes.forEach((cType, ci) => {
              let imgUrl = '/specialcard_joker/none.png';
              if (cType === 'red') imgUrl = '/specialcard_joker/red.png';
              else if (cType === 'green') imgUrl = '/specialcard_joker/green.png';
              else if (cType === 'skip') imgUrl = '/specialcard_joker/skip.png';
              else if (cType === 'freeze') imgUrl = '/specialcard_joker/freeze.png';
              else if (cType === 'trump' || cType === 'trumph') imgUrl = '/specialcard_joker/trumph.png';
              else if (cType === 'win') imgUrl = '/specialcard_joker/Win Card.png';
              else if (cType === 'none') imgUrl = '/specialcard_joker/none.png';
              else return;

              const cardTex = textureLoader.load(imgUrl, (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.needsUpdate = true;
              });
              const cardMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                map: cardTex,
                side: THREE.DoubleSide,
                transparent: true
              });
              const cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(previewCardWidth, previewCardHeight), cardMat);

              // Wrap in a spinning group so render loop rotates it infinitely
              const spinGroup = new THREE.Group();
              spinGroup.name = 'previewCardSpin';
              spinGroup.position.set(spacing[ci] || 0, 2.2, cardCenterZ);
              spinGroup.add(cardMesh);

              previewGroup.add(spinGroup);
            });
          }
        }

        // If skipping 2 rooms, add 2nd door frame & 2nd open door at middle divider (-roomSize - offsetZ)
        if (isSkipPassage) {
          const midZ = -roomSize - offsetZ;
          const midLeftGeo = new THREE.PlaneGeometry(sideWidth, height);
          this.setSegmentUVs(midLeftGeo, 0, sideWidth / roomSize, 0, 1);
          const midLeft = new THREE.Mesh(midLeftGeo, this.wallMaterial);
          midLeft.position.set(-(doorWidth / 2 + sideWidth / 2), height / 2, midZ);

          const midRightGeo = new THREE.PlaneGeometry(sideWidth, height);
          this.setSegmentUVs(midRightGeo, 1 - sideWidth / roomSize, 1, 0, 1);
          const midRight = new THREE.Mesh(midRightGeo, this.wallMaterial);
          midRight.position.set(doorWidth / 2 + sideWidth / 2, height / 2, midZ);

          const midTopGeo = new THREE.PlaneGeometry(doorWidth, topHeight);
          this.setSegmentUVs(midTopGeo, sideWidth / roomSize, 1 - sideWidth / roomSize, doorHeight / height, 1);
          const midTop = new THREE.Mesh(midTopGeo, this.wallMaterial);
          midTop.position.set(0, doorHeight + topHeight / 2, midZ);

          // 2nd Door Frame Border Front Face
          const midFrameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, doorHeight + 0.08, 0.02), this.doorOpeningBorderMat);
          midFrameLeft.position.set(-doorWidth / 2 - 0.04, (doorHeight + 0.08) / 2, midZ + 0.01);

          const midFrameRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, doorHeight + 0.08, 0.02), this.doorOpeningBorderMat);
          midFrameRight.position.set(doorWidth / 2 + 0.04, (doorHeight + 0.08) / 2, midZ + 0.01);

          const midFrameTop = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.16, 0.08, 0.02), this.doorOpeningBorderMat);
          midFrameTop.position.set(0, doorHeight + 0.04, midZ + 0.01);

          // 2nd Door Frame Border Back Face
          const midFrameBackLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, doorHeight + 0.08, 0.02), this.doorOpeningBorderMat);
          midFrameBackLeft.position.set(-doorWidth / 2 - 0.04, (doorHeight + 0.08) / 2, midZ - wallThickness - 0.01);

          const midFrameBackRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, doorHeight + 0.08, 0.02), this.doorOpeningBorderMat);
          midFrameBackRight.position.set(doorWidth / 2 + 0.04, (doorHeight + 0.08) / 2, midZ - wallThickness - 0.01);

          const midFrameBackTop = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.16, 0.08, 0.02), this.doorOpeningBorderMat);
          midFrameBackTop.position.set(0, doorHeight + 0.04, midZ - wallThickness - 0.01);

          // 2nd Door Inner Passage Reveal Lining
          const midPassageInnerLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, doorHeight, wallThickness), this.smoothWhiteMat);
          midPassageInnerLeft.position.set(-doorWidth / 2, doorHeight / 2, midZ - wallThickness / 2);

          const midPassageInnerRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, doorHeight, wallThickness), this.smoothWhiteMat);
          midPassageInnerRight.position.set(doorWidth / 2, doorHeight / 2, midZ - wallThickness / 2);

          // 2nd Door Leaf Mesh (Swings open smoothly in sync with Door 1, with standard Door Value Card Texture)
          const secondDoorImgUrl = doorSystem.getCardImageByValue(doorCost, doorId);

          const textureLoader = new THREE.TextureLoader();
          const secondDoorTex = textureLoader.load(secondDoorImgUrl, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.needsUpdate = true;
          });
          const secondDoorFrontMat = new THREE.MeshBasicMaterial({ map: secondDoorTex, side: THREE.DoubleSide });
          const secondDoorBorderMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

          const secondDoorGroup = new THREE.Group();
          secondDoorGroup.name = 'secondDoorGroup';
          secondDoorGroup.position.set(-doorWidth / 2, 0, midZ);

          const secondBorderMesh = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth + 0.06, doorHeight + 0.06, 0.02),
            secondDoorBorderMat
          );
          secondBorderMesh.position.set(doorWidth / 2, (doorHeight + 0.06) / 2, 0);

          const secondFaceMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(doorWidth, doorHeight),
            secondDoorFrontMat
          );
          secondFaceMesh.position.set(doorWidth / 2, doorHeight / 2, 0.015);

          const secondBackFaceMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(doorWidth, doorHeight),
            secondDoorFrontMat
          );
          secondBackFaceMesh.rotation.y = Math.PI;
          secondBackFaceMesh.position.set(doorWidth / 2, doorHeight / 2, -0.015);

          secondDoorGroup.add(secondBorderMesh, secondFaceMesh, secondBackFaceMesh);
          secondDoorGroup.rotation.y = 0;

          previewGroup.add(
            midLeft, midRight, midTop,
            midFrameLeft, midFrameRight, midFrameTop,
            midFrameBackLeft, midFrameBackRight, midFrameBackTop,
            midPassageInnerLeft, midPassageInnerRight,
            secondDoorGroup
          );
        }

        wallGroup.add(previewGroup);
      }

      this.roomGroup.add(wallGroup);
    };

    const doors = cell.doors || [];
    const northDoorData = doors.find((d: any) => d.direction === 'up');
    const eastDoorData = doors.find((d: any) => d.direction === 'right');
    const southDoorData = doors.find((d: any) => d.direction === 'down');
    const westDoorData = doors.find((d: any) => d.direction === 'left');

    const r = cell.r;
    const c = cell.c;

    const hasNorth = !!northDoorData;
    const hasEast = !!eastDoorData;
    const hasSouth = !!southDoorData;
    const hasWest = !!westDoorData;

    const northCell1 = gridMatrix && r > 0 ? gridMatrix[r - 1]?.[c] : null;
    const northCell2 = gridMatrix && r > 1 ? gridMatrix[r - 2]?.[c] : null;
    const northCell = (isSkip && hasNorth) ? northCell2 : northCell1;

    const eastCell1 = gridMatrix && c < 6 ? gridMatrix[r]?.[c + 1] : null;
    const eastCell2 = gridMatrix && c < 5 ? gridMatrix[r]?.[c + 2] : null;
    const eastCell = (isSkip && hasEast) ? eastCell2 : eastCell1;

    const southCell1 = gridMatrix && r < 6 ? gridMatrix[r + 1]?.[c] : null;
    const southCell2 = gridMatrix && r < 5 ? gridMatrix[r + 2]?.[c] : null;
    const southCell = (isSkip && hasSouth) ? southCell2 : southCell1;

    const westCell1 = gridMatrix && c > 0 ? gridMatrix[r]?.[c - 1] : null;
    const westCell2 = gridMatrix && c > 1 ? gridMatrix[r]?.[c - 2] : null;
    const westCell = (isSkip && hasWest) ? westCell2 : westCell1;

    const hasNorthPassage = !!northDoorData || (cell.type !== 'entry' && !!northCell && northCell.type !== 'wall');
    const hasEastPassage = !!eastDoorData || (cell.type !== 'entry' && !!eastCell && eastCell.type !== 'wall');
    const hasSouthPassage = !!southDoorData || (cell.type !== 'entry' && !!southCell && southCell.type !== 'wall');
    const hasWestPassage = !!westDoorData || (cell.type !== 'entry' && !!westCell && westCell.type !== 'wall');

    const getCellLabel = (target: MapCell | null | undefined): string => {
      if (!target) return '';
      if (target.type === 'entry') return `R${target.entryIndex || 1}`;
      if (target.type === 'exit') return `G${target.exitIndex || 1}`;
      return `(${target.c},${target.r})`;
    };

    // North Wall (Z = -roomSize/2)
    buildWallWithFullRoomView(new THREE.Vector3(0, 0, -roomSize / 2), 0, hasNorth || hasNorthPassage, isSkip && hasNorth, northCell, northDoorData?.cost || 10, 1, northDoorData?.specialType, 'north');
    if (hasNorth || hasNorthPassage) {
      doorSystem.createDoor(
        1, 'north', northCell ? { x: northCell.c, y: northCell.r } : null,
        `North Door`,
        `Walk through to enter room.`,
        new THREE.Vector3(0, 0, -doorOffsetPos), 0, 'crystal',
        northDoorData?.cost || 10,
        northDoorData?.specialType
      );
    }

    // East Wall (X = +roomSize/2)
    buildWallWithFullRoomView(new THREE.Vector3(roomSize / 2, 0, 0), -Math.PI / 2, hasEast || hasEastPassage, isSkip && hasEast, eastCell, eastDoorData?.cost || 10, 2, eastDoorData?.specialType, 'east');
    if (hasEast || hasEastPassage) {
      doorSystem.createDoor(
        2, 'east', eastCell ? { x: eastCell.c, y: eastCell.r } : null,
        `East Door`,
        `Walk through to enter room.`,
        new THREE.Vector3(doorOffsetPos, 0, 0), -Math.PI / 2, 'celestial',
        eastDoorData?.cost || 10,
        eastDoorData?.specialType
      );
    }

    // South Wall (Z = +roomSize/2)
    buildWallWithFullRoomView(new THREE.Vector3(0, 0, roomSize / 2), Math.PI, hasSouth || hasSouthPassage, isSkip && hasSouth, southCell, southDoorData?.cost || 10, 3, southDoorData?.specialType, 'south');
    if (hasSouth || hasSouthPassage) {
      doorSystem.createDoor(
        3, 'south', southCell ? { x: southCell.c, y: southCell.r } : null,
        `South Door`,
        `Walk through to enter room.`,
        new THREE.Vector3(0, 0, doorOffsetPos), Math.PI, 'gold',
        southDoorData?.cost || 10,
        southDoorData?.specialType
      );
    }

    // West Wall (X = -roomSize/2)
    buildWallWithFullRoomView(new THREE.Vector3(-roomSize / 2, 0, 0), Math.PI / 2, hasWest || hasWestPassage, isSkip && hasWest, westCell, westDoorData?.cost || 10, 4, westDoorData?.specialType, 'west');
    if (hasWest || hasWestPassage) {
      doorSystem.createDoor(
        4, 'west', westCell ? { x: westCell.c, y: westCell.r } : null,
        `West Door`,
        `Walk through to enter room.`,
        new THREE.Vector3(-doorOffsetPos, 0, 0), Math.PI / 2, 'nature',
        westDoorData?.cost || 10,
        westDoorData?.specialType
      );
    }
  }

  public animateSecondDoorOpen(instant: boolean = false) {
    this.roomGroup.traverse((child) => {
      if (child.name === 'secondDoorGroup') {
        gsap.killTweensOf(child.rotation);
        if (instant) {
          child.rotation.y = -Math.PI * 0.85;
        } else {
          gsap.to(child.rotation, {
            y: -Math.PI * 0.85,
            duration: 1.8,
            ease: 'power2.out'
          });
        }
      }
    });
  }

  public animateSecondDoorClose(instant: boolean = false) {
    this.roomGroup.traverse((child) => {
      if (child.name === 'secondDoorGroup') {
        gsap.killTweensOf(child.rotation);
        if (instant) {
          child.rotation.y = 0;
        } else {
          gsap.to(child.rotation, {
            y: 0,
            duration: 0.8,
            ease: 'power2.inOut'
          });
        }
      }
    });
  }
}
