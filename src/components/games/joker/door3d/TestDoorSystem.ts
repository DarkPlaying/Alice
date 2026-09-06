import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DOOR_3D_CONFIG } from './door3dConfig';

export interface TestDoorData3D {
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
  scannerGroup?: THREE.Group;
  scannerBeam?: THREE.Mesh | THREE.Group;
  scannerBeamGroup?: THREE.Group;
  scannerBeamMats?: THREE.MeshBasicMaterial[];
  scannerReticleMesh?: THREE.Mesh;
  scannerLedMat?: THREE.MeshBasicMaterial;
  scannerRingMat?: THREE.MeshBasicMaterial;
  scannerStatusMesh?: THREE.Mesh;
  scannerStatusMat?: THREE.MeshBasicMaterial;
  terminalWrapper?: THREE.Group;
  spaceshipDoorMesh?: THREE.Group;
  glassMat?: THREE.MeshPhysicalMaterial;
  glassMats?: THREE.MeshPhysicalMaterial[];
  slidingDoorParts?: THREE.Object3D[];
  frameAccentMats?: THREE.MeshStandardMaterial[];
  doorBodyMats?: THREE.MeshStandardMaterial[];
  texturedAccentMats?: { material: THREE.MeshStandardMaterial; blueTex: THREE.Texture; redTex: THREE.Texture; themedTex?: THREE.Texture | null }[];
  spaceshipLeftPanel?: THREE.Object3D;
  spaceshipRightPanel?: THREE.Object3D;
  spaceshipLeftInitX?: number;
  spaceshipRightInitX?: number;
  clipL?: THREE.Plane;
  clipR?: THREE.Plane;
  animationMixer?: THREE.AnimationMixer;
  doorAction?: THREE.AnimationAction;
  isOpen: boolean;
  theme: 'crystal' | 'celestial' | 'gold' | 'nature';
  cost?: number;
  isSelected?: boolean;
}

export class TestDoorSystem {
  public static cachedScannerGLTF: any = null;
  public static cachedDoorGLTF: any = null;
  public static preloadPromise: Promise<void> | null = null;

  public static preloadAssets(): Promise<void> {
    if (TestDoorSystem.preloadPromise) return TestDoorSystem.preloadPromise;
    const loader = new GLTFLoader();
    TestDoorSystem.preloadPromise = Promise.all([
      new Promise<void>((resolve) => {
        if (TestDoorSystem.cachedScannerGLTF) { resolve(); return; }
        loader.load('/3d_testing_props/free_props_for_a_sci_fi_environment.glb', (gltf) => {
          TestDoorSystem.cachedScannerGLTF = gltf;
          resolve();
        }, undefined, () => resolve());
      }),
      new Promise<void>((resolve) => {
        if (TestDoorSystem.cachedDoorGLTF) { resolve(); return; }
        loader.load('/3d_testing_props/super_low-poly_anime_spaceship_door.glb', (gltf) => {
          TestDoorSystem.cachedDoorGLTF = gltf;
          resolve();
        }, undefined, () => resolve());
      })
    ]).then(() => {});
    return TestDoorSystem.preloadPromise;
  }

  public doors: TestDoorData3D[] = [];
  public glassMaterials: THREE.MeshStandardMaterial[] = [];
  public currentGlassSettings = {
    color: '#000766',
    opacity: 1.0,
    transmission: 0.0,
    roughness: 0.1,
    metalness: 0.2,
    clearcoat: 0.0
  };
  private scene: THREE.Scene;
  private soundEngine: any;
  private handleMaterial: THREE.MeshStandardMaterial;
  public centerMesh: THREE.Group | null = null;
  public currentDoorWidth = 4.15;
  public currentDoorHeight = 4.60;
  public currentScannerSettings = {
    posX: 0.70,
    posY: 2.70,
    posZ: 0.14,
    scale: 1.60
  };

  constructor(scene: THREE.Scene, soundEngine: any) {
    this.scene = scene;
    this.soundEngine = soundEngine;

    this.handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.9,
      roughness: 0.1
    });
  }

  public setDoorDimensions(width: number, height: number) {
    this.currentDoorWidth = width;
    this.currentDoorHeight = height;

    this.doors.forEach((door) => {
      if (door.spaceshipDoorMesh) {
        const origSizeX = door.spaceshipDoorMesh.userData?.sizeX || 1.61;
        const origSizeY = door.spaceshipDoorMesh.userData?.sizeY || 1.59;
        const scX = width / origSizeX;
        const scY = height / origSizeY;
        door.spaceshipDoorMesh.scale.set(scX, scY, scY);
      }
      if (door.dirCardMesh) {
        door.dirCardMesh.position.y = height + 0.88;
      }
      if (door.scannerGroup) {
        door.scannerGroup.position.set(
          width / 2 + this.currentScannerSettings.posX,
          this.currentScannerSettings.posY,
          this.currentScannerSettings.posZ
        );
      }
      if (door.clipL && door.clipR) {
        const clipDist = (width / 2) * 1.0;
        door.doorLocationGroup.updateMatrixWorld(true);
        door.clipL.set(new THREE.Vector3(1, 0, 0), clipDist).applyMatrix4(door.doorLocationGroup.matrixWorld);
        door.clipR.set(new THREE.Vector3(-1, 0, 0), clipDist).applyMatrix4(door.doorLocationGroup.matrixWorld);
      }
    });
  }

  public updateDoorGlass(options: {
    color?: string;
    opacity?: number;
    transmission?: number;
    roughness?: number;
    metalness?: number;
    clearcoat?: number;
  }) {
    if (options.color !== undefined) this.currentGlassSettings.color = options.color;
    if (options.opacity !== undefined) this.currentGlassSettings.opacity = options.opacity;
    if (options.roughness !== undefined) this.currentGlassSettings.roughness = options.roughness;
    if (options.metalness !== undefined) this.currentGlassSettings.metalness = options.metalness;

    const isWhiteRoom = this.isLightOrWhiteRoom(this.currentFloorColor);

    this.doors.forEach((door) => {
      if (!door.isSelected) {
        const glassList = (door.glassMats && door.glassMats.length > 0) ? door.glassMats : (door.glassMat ? [door.glassMat] : []);
        glassList.forEach((mat) => {
          if (isWhiteRoom) {
            mat.color.setHex(0x0a0a0c); // Sleek black glass only for white rooms
          } else if (options.color !== undefined) {
            mat.color.set(options.color);
          }
          if (options.opacity !== undefined) {
            mat.opacity = options.opacity;
            mat.transparent = options.opacity < 1.0;
          }
          if (options.roughness !== undefined) mat.roughness = options.roughness;
          if (options.metalness !== undefined) mat.metalness = options.metalness;
          mat.needsUpdate = true;
        });
      }
    });

    this.glassMaterials.forEach((mat) => {
      if (isWhiteRoom) {
        mat.color.setHex(0x0a0a0c);
      } else if (options.color !== undefined) {
        mat.color.set(options.color);
      }
      if (options.opacity !== undefined) {
        mat.opacity = options.opacity;
        mat.transparent = options.opacity < 1.0;
      }
      if (options.roughness !== undefined) mat.roughness = options.roughness;
      if (options.metalness !== undefined) mat.metalness = options.metalness;
      mat.needsUpdate = true;
    });
  }

  public clearDoors() {
    this.doors.forEach((door) => {
      this.scene.remove(door.doorLocationGroup);
    });
    this.doors = [];
    this.glassMaterials = [];
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
    let rankStr = '10';
    if (validValue === 11) rankStr = 'J';
    if (validValue === 12) rankStr = 'Q';
    if (validValue === 13) rankStr = 'K';
    if (validValue === 14) rankStr = 'A';

    const suits = ['hearts', 'spades', 'clubs', 'diamonds'];
    const suit = suits[(doorId - 1) % suits.length];

    return `/borderland_cards/${suit}_${rankStr}.png`;
  }

  public currentFloorColor: string = '#BFBFBF';

  public isLightOrWhiteRoom(floorColor: string): boolean {
    if (!floorColor) return false;
    const clean = floorColor.toLowerCase().trim();
    if (clean === '#ffffff' || clean === '#bfbfbf' || clean === 'white' || clean === '#f8fafc' || clean === '#f1f5f9' || clean === '#e2e8f0') {
      return true;
    }
    try {
      const c = new THREE.Color(clean);
      const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
      return lum >= 0.45;
    } catch {
      return false;
    }
  }

  public getContrastColor(hexColor: string): { text: string; isLight: boolean } {
    try {
      const isLight = this.isLightOrWhiteRoom(hexColor);
      return {
        text: isLight ? '#0f172a' : '#ffffff',
        isLight
      };
    } catch {
      return { text: '#ffffff', isLight: false };
    }
  }

  public createScannerStatusTexture(
    statusText: string = 'SCANNER: READY',
    statusType: 'ready' | 'scanning' | 'granted' | 'open' | 'selected' = 'ready',
    floorColor?: string,
    isSelected: boolean = false
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 140;
    const ctx = canvas.getContext('2d')!;

    const activeColor = floorColor || this.currentFloorColor || '#000766';
    const contrast = this.getContrastColor(activeColor);
    const threeColor = new THREE.Color(activeColor);

    // Outer dark metallic sci-fi badge background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, 512, 140);

    let borderColor = '#06b6d4';
    let textColor = '#38bdf8';
    let glowColor = '#00ffff';
    let bgGradColor = '#082f49';

    if (isSelected || statusType === 'selected') {
      borderColor = '#bd0000';
      textColor = '#ffffff';
      glowColor = '#bd0000';
      bgGradColor = '#bd0000';
    } else if (statusType === 'ready') {
      if (contrast.isLight) {
        // Light floor room (e.g. plain white / white room)
        borderColor = '#475569';
        textColor = '#0f172a';
        glowColor = '#94a3b8';
        bgGradColor = '#e2e8f0';
      } else {
        // Dark floor room (e.g. red, blue, green)
        const borderC = new THREE.Color(threeColor).offsetHSL(0, 0.1, 0.2).getStyle();
        borderColor = borderC;
        textColor = '#ffffff';
        glowColor = activeColor;
        bgGradColor = new THREE.Color(threeColor).multiplyScalar(0.4).getStyle();
      }
    } else if (statusType === 'scanning') {
      borderColor = '#38bdf8';
      textColor = '#e0f2fe';
      glowColor = '#00ffff';
      bgGradColor = '#0c4a6e';
    } else if (statusType === 'granted') {
      borderColor = '#10b981';
      textColor = '#6ee7b7';
      glowColor = '#10b981';
      bgGradColor = '#064e3b';
    } else if (statusType === 'open') {
      borderColor = '#22c55e';
      textColor = '#86efac';
      glowColor = '#22c55e';
      bgGradColor = '#14532d';
    }

    const grad = ctx.createLinearGradient(0, 0, 512, 140);
    if (isSelected || statusType === 'selected') {
      grad.addColorStop(0, '#590000');
      grad.addColorStop(0.25, '#8a0000');
      grad.addColorStop(0.5, '#bd0000');
      grad.addColorStop(0.75, '#8a0000');
      grad.addColorStop(1, '#590000');
    } else {
      grad.addColorStop(0, '#060a12');
      grad.addColorStop(0.5, bgGradColor);
      grad.addColorStop(1, '#060a12');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(8, 8, 496, 124);

    // Glowing Neon Border
    ctx.lineWidth = 4;
    ctx.strokeStyle = borderColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = (isSelected || statusType === 'selected') ? 16 : 14;
    ctx.strokeRect(8, 8, 496, 124);

    // Accent lines top & bottom
    ctx.fillStyle = borderColor;
    ctx.fillRect(24, 14, 464, 2);
    ctx.fillRect(24, 124, 464, 2);

    // Status Indicator Dot
    ctx.beginPath();
    ctx.arc(42, 70, 9, 0, Math.PI * 2);
    ctx.fillStyle = glowColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = (isSelected || statusType === 'selected') ? 14 : 12;
    ctx.fill();

    // Auto-fit Font Size to prevent overlapping badge edges
    let fontSize = 28;
    ctx.font = `900 ${fontSize}px "Cinzel", "Outfit", "Inter", sans-serif`;
    while (ctx.measureText(statusText).width > 440 && fontSize > 16) {
      fontSize -= 2;
      ctx.font = `900 ${fontSize}px "Cinzel", "Outfit", "Inter", sans-serif`;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = (isSelected || statusType === 'selected') ? 12 : 8;
    ctx.fillText(statusText, 256, 70);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  public createBeamGlowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 256, 512);

    // Smooth volumetric linear gradient falloff along the beam (bright emitter at top -> soft fadeout at depth)
    const linGrad = ctx.createLinearGradient(0, 0, 0, 512);
    linGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    linGrad.addColorStop(0.12, 'rgba(0, 255, 255, 0.85)');
    linGrad.addColorStop(0.55, 'rgba(6, 182, 212, 0.45)');
    linGrad.addColorStop(0.85, 'rgba(2, 132, 199, 0.15)');
    linGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = linGrad;
    ctx.fillRect(0, 0, 256, 512);

    // Subtle sci-fi laser scanline stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.20)';
    for (let y = 8; y < 500; y += 14) {
      ctx.fillRect(0, y, 256, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  public createHolographicLaserTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 512, 512);

    // Soft radial glow (prevents hard clipping edges)
    const radGrad = ctx.createRadialGradient(256, 256, 30, 256, 256, 250);
    radGrad.addColorStop(0, 'rgba(0, 255, 255, 0.95)');
    radGrad.addColorStop(0.35, 'rgba(6, 182, 212, 0.60)');
    radGrad.addColorStop(0.70, 'rgba(14, 165, 233, 0.25)');
    radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, 512, 512);

    // Cyber Holographic Grid Lines
    ctx.strokeStyle = 'rgba(165, 243, 252, 0.45)';
    ctx.lineWidth = 1.5;
    for (let i = 48; i <= 464; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 48); ctx.lineTo(i, 464); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(48, i); ctx.lineTo(464, i); ctx.stroke();
    }

    // Concentric Biometric Target Reticle Rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.90)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(256, 256, 125, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(6, 182, 212, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(256, 256, 185, 0, Math.PI * 2);
    ctx.stroke();

    // Center Crosshairs & Corner Brackets
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(256, 205); ctx.lineTo(256, 238);
    ctx.moveTo(256, 274); ctx.lineTo(256, 307);
    ctx.moveTo(205, 256); ctx.lineTo(238, 256);
    ctx.moveTo(274, 256); ctx.lineTo(307, 256);
    ctx.stroke();

    // Corner targeting brackets
    const bSize = 35;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#38bdf8';
    // Top-Left
    ctx.beginPath(); ctx.moveTo(110, 110 + bSize); ctx.lineTo(110, 110); ctx.lineTo(110 + bSize, 110); ctx.stroke();
    // Top-Right
    ctx.beginPath(); ctx.moveTo(402 - bSize, 110); ctx.lineTo(402, 110); ctx.lineTo(402, 110 + bSize); ctx.stroke();
    // Bottom-Left
    ctx.beginPath(); ctx.moveTo(110, 402 - bSize); ctx.lineTo(110, 402); ctx.lineTo(110 + bSize, 402); ctx.stroke();
    // Bottom-Right
    ctx.beginPath(); ctx.moveTo(402 - bSize, 402); ctx.lineTo(402, 402); ctx.lineTo(402, 402 - bSize); ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  public createRedVariantTexture(sourceTexture: THREE.Texture): THREE.CanvasTexture | null {
    const img = sourceTexture.image;
    if (!img) return null;

    // If HTMLImageElement is still loading, attach a load listener to regenerate & assign red texture
    if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement && !img.complete) {
      img.addEventListener('load', () => {
        const redTex = this.createRedVariantTexture(sourceTexture);
        if (redTex) {
          this.doors.forEach((door) => {
            if (door.texturedAccentMats) {
              door.texturedAccentMats.forEach((item) => {
                if (item.blueTex === sourceTexture) {
                  item.redTex = redTex;
                  if (door.isSelected) {
                    item.material.map = redTex;
                    item.material.needsUpdate = true;
                  }
                }
              });
            }
          });
        }
      }, { once: true });
    }

    try {
      const w = (img as any).videoWidth || (img as any).naturalWidth || (img as any).width || 512;
      const h = (img as any).videoHeight || (img as any).naturalHeight || (img as any).height || 512;
      if (w <= 0 || h <= 0) return null;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Replace ONLY true saturated sapphire blue accent lines with crimson metallic red (#bd0000)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Specific sapphire/cyan accent condition: High blue, low red, saturated blue hue
        // Strictly rejects white panels, shadow gradients, crevices, and ambient occlusion
        const isBlueAccent = (b > 65) && (b > r + 35) && (b > g * 1.05) && (r < 130);

        if (isBlueAccent) {
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const factor = Math.min(1.4, b / 160);
          data[i] = Math.min(245, Math.round(185 * factor + lum * 0.3));     // Rich crimson Red
          data[i + 1] = Math.round(lum * 0.05);                              // Low Green
          data[i + 2] = Math.round(lum * 0.05);                              // Low Blue
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const redTex = new THREE.CanvasTexture(canvas);
      redTex.flipY = sourceTexture.flipY;
      redTex.colorSpace = sourceTexture.colorSpace;
      redTex.generateMipmaps = false;
      redTex.minFilter = THREE.LinearFilter;
      redTex.magFilter = THREE.LinearFilter;
      redTex.wrapS = sourceTexture.wrapS;
      redTex.wrapT = sourceTexture.wrapT;
      redTex.repeat.copy(sourceTexture.repeat);
      redTex.offset.copy(sourceTexture.offset);
      redTex.needsUpdate = true;
      return redTex;
    } catch (e) {
      console.warn('Could not create red variant texture:', e);
      return null;
    }
  }

  public createThemedVariantTexture(sourceTexture: THREE.Texture, floorColor?: string): THREE.CanvasTexture | null {
    const img = sourceTexture.image;
    if (!img) return null;

    const activeColor = floorColor || this.currentFloorColor || '#000766';
    const contrast = this.getContrastColor(activeColor);
    const targetC = new THREE.Color(activeColor);

    // If HTMLImageElement is still loading, attach a load listener
    if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement && !img.complete) {
      img.addEventListener('load', () => {
        const themedTex = this.createThemedVariantTexture(sourceTexture, activeColor);
        if (themedTex) {
          this.doors.forEach((door) => {
            if (door.texturedAccentMats) {
              door.texturedAccentMats.forEach((item) => {
                if (item.blueTex === sourceTexture) {
                  item.themedTex = themedTex;
                  if (!door.isSelected) {
                    item.material.map = themedTex;
                    item.material.needsUpdate = true;
                  }
                }
              });
            }
          });
        }
      }, { once: true });
    }

    try {
      const w = (img as any).videoWidth || (img as any).naturalWidth || (img as any).width || 512;
      const h = (img as any).videoHeight || (img as any).naturalHeight || (img as any).height || 512;
      if (w <= 0 || h <= 0) return null;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Replace sapphire/cyan blue accent lines with target floor color
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Specific sapphire/cyan accent condition: High blue, low red, saturated blue hue
        const isBlueAccent = (b > 65) && (b > r + 35) && (b > g * 1.05) && (r < 130);

        if (isBlueAccent) {
          const factor = Math.min(1.4, b / 160);
          if (contrast.isLight) {
            // Light floors: give bright, crisp platinum/silver accent line matching light floor
            data[i] = Math.min(245, Math.round(210 * factor));
            data[i + 1] = Math.min(245, Math.round(215 * factor));
            data[i + 2] = Math.min(250, Math.round(225 * factor));
          } else {
            // Dark/vivid floors: match floor tone with vibrant metallic sheen
            const rVal = targetC.r * 255;
            const gVal = targetC.g * 255;
            const bVal = targetC.b * 255;
            data[i] = Math.min(255, Math.round(rVal * factor * 1.3));
            data[i + 1] = Math.min(255, Math.round(gVal * factor * 1.3));
            data[i + 2] = Math.min(255, Math.round(bVal * factor * 1.3));
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const themedTex = new THREE.CanvasTexture(canvas);
      themedTex.flipY = sourceTexture.flipY;
      themedTex.colorSpace = sourceTexture.colorSpace;
      themedTex.generateMipmaps = false;
      themedTex.minFilter = THREE.LinearFilter;
      themedTex.magFilter = THREE.LinearFilter;
      themedTex.wrapS = sourceTexture.wrapS;
      themedTex.wrapT = sourceTexture.wrapT;
      themedTex.repeat.copy(sourceTexture.repeat);
      themedTex.offset.copy(sourceTexture.offset);
      themedTex.needsUpdate = true;
      return themedTex;
    } catch (e) {
      console.warn('Could not create themed variant texture:', e);
      return null;
    }
  }

  public createDirectionCardTexture(
    direction: 'north' | 'south' | 'east' | 'west',
    isSelected: boolean = false,
    isSkip: boolean = false,
    floorColor?: string
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 180;
    const ctx = canvas.getContext('2d')!;

    let label = 'UP';
    if (direction === 'north') label = 'UP';
    if (direction === 'south') label = 'DOWN';
    if (direction === 'east') label = 'RIGHT';
    if (direction === 'west') label = 'LEFT';

    ctx.font = '900 68px "Cinzel", "Outfit", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isSelected) {
      // Solid deep crimson red matching EXACT door red (#bd0000)
      const grad = ctx.createLinearGradient(0, 0, 512, 180);
      grad.addColorStop(0, '#590000');
      grad.addColorStop(0.25, '#8a0000');
      grad.addColorStop(0.5, '#bd0000');
      grad.addColorStop(0.75, '#8a0000');
      grad.addColorStop(1, '#590000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 180);

      // Clean Bold Red Outer Border matching door
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#bd0000';
      ctx.shadowColor = '#bd0000';
      ctx.shadowBlur = 14;
      ctx.strokeRect(16, 16, 480, 148);

      // Inner Accent Border
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#e00000';
      ctx.shadowBlur = 6;
      ctx.strokeRect(26, 26, 460, 128);

      // Accent Red Lines Top & Bottom
      ctx.fillStyle = '#ff2233';
      ctx.shadowColor = '#bd0000';
      ctx.shadowBlur = 6;
      ctx.fillRect(40, 20, 432, 4);
      ctx.fillRect(40, 156, 432, 4);

      // Crisp White Text matching door
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 6;
      ctx.fillText(label, 256, 90);
    } else {
      const activeColor = floorColor || this.currentFloorColor || '#000766';
      const contrast = this.getContrastColor(activeColor);
      const threeColor = new THREE.Color(activeColor);

      if (contrast.isLight) {
        // Light floor room (e.g. plain white / white room): crisp black outline & text
        const grad = ctx.createLinearGradient(0, 0, 512, 180);
        grad.addColorStop(0, '#f1f5f9');
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(1, '#f1f5f9');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 180);

        // Crisp Black Border & Accent Lines for white room
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#000000';
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.strokeRect(16, 16, 480, 148);

        ctx.fillStyle = '#000000';
        ctx.fillRect(40, 22, 432, 4);
        ctx.fillRect(40, 154, 432, 4);

        // Pure black contrasting text clearly visible
        ctx.fillStyle = '#000000';
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 4;
        ctx.fillText(label, 256, 90);
      } else {
        // Dark floor room (e.g. red, blue, green, yellow)
        const darkGrad = new THREE.Color(threeColor).multiplyScalar(0.25).getStyle();
        const midGrad = new THREE.Color(threeColor).multiplyScalar(0.70).getStyle();
        const borderC = new THREE.Color(threeColor).offsetHSL(0, 0.15, 0.25).getStyle();
        const accentC = new THREE.Color(threeColor).offsetHSL(0, 0.25, 0.40).getStyle();

        const grad = ctx.createLinearGradient(0, 0, 512, 180);
        grad.addColorStop(0, darkGrad);
        grad.addColorStop(0.5, midGrad);
        grad.addColorStop(1, darkGrad);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 180);

        // Vibrant floor-themed Border
        ctx.lineWidth = 8;
        ctx.strokeStyle = borderC;
        ctx.strokeRect(16, 16, 480, 148);

        // Accent Lines Top & Bottom
        ctx.fillStyle = accentC;
        ctx.fillRect(40, 22, 432, 4);
        ctx.fillRect(40, 154, 432, 4);

        // Crisp White Text
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.fillText(label, 256, 90);
      }
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
  ): TestDoorData3D {
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

    const doorLocationGroup = new THREE.Group();
    doorLocationGroup.position.copy(position);
    doorLocationGroup.rotation.y = rotationY;

    const themeColors = this.getThemeColor(direction);

    const doorWidth = this.currentDoorWidth;
    const doorHeight = this.currentDoorHeight;
    const doorDepth = DOOR_3D_CONFIG.DOOR_DEPTH;

    const cardTopW = 2.4;
    const cardTopH = 0.72;

    const dirCardTex = this.createDirectionCardTexture(direction, false, false, this.currentFloorColor);
    const dirCardMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: dirCardTex,
      transparent: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    });

    // Place direction card comfortably ABOVE the door frame (y = doorHeight + 0.88m)
    const dirCardMesh = new THREE.Mesh(new THREE.PlaneGeometry(cardTopW, cardTopH), dirCardMat);
    dirCardMesh.position.set(0, doorHeight + 0.88, 0.08);
    doorLocationGroup.add(dirCardMesh);

    // Glowing Frame Material for direction highlighting
    const glowFrameMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.85
    });

    // Pivot Group for Door (kept for interface compatibility)
    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(-doorWidth / 2, 0, 0);

    const ledMat = new THREE.MeshStandardMaterial({
      color: themeColors.led,
      emissive: themeColors.led,
      emissiveIntensity: 1.2,
      roughness: 0.2
    });

    const doorMesh = dirCardMesh;

    // =========================================================================
    // 3D SCI-FI FACE SCANNER (FREE PROPS SCI-FI TERMINAL "DOOR CONTROLS" MODEL)
    // =========================================================================
    const scannerGroup = new THREE.Group();
    scannerGroup.position.set(
      doorWidth / 2 + this.currentScannerSettings.posX,
      this.currentScannerSettings.posY,
      this.currentScannerSettings.posZ
    );
    scannerGroup.scale.set(
      this.currentScannerSettings.scale,
      this.currentScannerSettings.scale,
      this.currentScannerSettings.scale
    );

    const scannerLedMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const scannerRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });

    // Interactive glowing biometric touch scanner pad
    const scannerPadGeo = new THREE.BoxGeometry(0.28, 0.36, 0.04);
    const scannerPadMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 1.5,
      roughness: 0.2
    });
    const scannerPad = new THREE.Mesh(scannerPadGeo, scannerPadMat);
    scannerPad.position.set(0, 0, 0.02);
    scannerGroup.add(scannerPad);

    // 3D Scanner Status Label (placed cleanly at top with comfortable spacing at y = 0.72m)
    const scannerStatusTex = this.createScannerStatusTexture('SCANNER: READY', 'ready');
    const scannerStatusMat = new THREE.MeshBasicMaterial({
      map: scannerStatusTex,
      transparent: true,
      side: THREE.DoubleSide
    });
    const scannerStatusMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.19), scannerStatusMat);
    scannerStatusMesh.position.set(0, 0.72, 0.04);
    scannerGroup.add(scannerStatusMesh);

    // =========================================================================
    // PROFESSIONAL 3D SCI-FI VOLUMETRIC SCANNER RAY SYSTEM
    // =========================================================================
    const scannerBeamGroup = new THREE.Group();
    scannerBeamGroup.position.set(0, 0.05, 0.04);
    scannerBeamGroup.visible = false;

    const beamTex = this.createBeamGlowTexture();
    const reticleTex = this.createHolographicLaserTexture();

    // 1. Aperture Lens Flare Iris (Glowing emitter point)
    const lensCoreMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const lensCore = new THREE.Mesh(new THREE.RingGeometry(0.01, 0.08, 24), lensCoreMat);
    lensCore.position.set(0, 0, 0.01);
    scannerBeamGroup.add(lensCore);

    // 2. Volumetric 3D Hollow Holographic Frustum/Cone (Soft glowing volumetric light)
    const coneGeo = new THREE.CylinderGeometry(0.06, 0.52, 1.45, 24, 1, true);
    coneGeo.rotateX(Math.PI / 2);
    coneGeo.translate(0, 0, 0.725);
    const coneMat = new THREE.MeshBasicMaterial({
      map: beamTex,
      color: 0x00ffff,
      transparent: true,
      opacity: 0.40,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const volumetricCone = new THREE.Mesh(coneGeo, coneMat);
    scannerBeamGroup.add(volumetricCone);

    // 3. Cyber Scanline Sweeper Sheet (Horizontal laser grid plane)
    const sweepSheetGeo = new THREE.PlaneGeometry(0.68, 1.45);
    const sweepSheetMat = new THREE.MeshBasicMaterial({
      map: beamTex,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.60,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const sweepSheet = new THREE.Mesh(sweepSheetGeo, sweepSheetMat);
    sweepSheet.rotation.x = -Math.PI / 2;
    sweepSheet.position.set(0, 0, 0.725);
    scannerBeamGroup.add(sweepSheet);

    // 4. Floating Holographic Target Reticle / Cyber Matrix Decal (Facing the player's face)
    const reticleMat = new THREE.MeshBasicMaterial({
      map: reticleTex,
      color: 0x00ffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const targetReticle = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.68), reticleMat);
    targetReticle.position.set(0, 0, 1.35);
    scannerBeamGroup.add(targetReticle);

    scannerGroup.add(scannerBeamGroup);

    doorLocationGroup.add(scannerGroup);

    this.scene.add(doorLocationGroup);

    // Temporary full wall / door placeholder while GLTF is loading to prevent any holes
    const placeholderGeo = new THREE.BoxGeometry(doorWidth, doorHeight, 0.2);
    const placeholderMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const placeholderMesh = new THREE.Mesh(placeholderGeo, placeholderMat);
    placeholderMesh.position.set(0, doorHeight / 2, 0);
    doorLocationGroup.add(placeholderMesh);

    const doorData: TestDoorData3D = {
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
      scannerGroup,
      scannerBeam: scannerBeamGroup,
      scannerBeamGroup,
      scannerBeamMats: [lensCoreMat, coneMat, sweepSheetMat, reticleMat],
      scannerReticleMesh: targetReticle,
      scannerLedMat,
      scannerRingMat,
      scannerStatusMesh,
      scannerStatusMat,
      isOpen: false,
      theme,
      cost,
      isSelected: false
    };

    // --- 1. LOAD SCI-FI PROPS GLB FOR TERMINAL SCANNER (Door_controls) ---
    const attachScannerKiosk = (gltf: any) => {
      let doorControlsNode: THREE.Object3D | null = null;
      gltf.scene.traverse((child: THREE.Object3D) => {
        if (child.name === 'Door_controls' || child.name.toLowerCase().includes('door_controls')) {
          doorControlsNode = child;
        }
      });

      if (doorControlsNode) {
        const terminalWrapper = new THREE.Group();
        const clonedControls = (doorControlsNode as THREE.Object3D).clone(true);

        // Center geometry using bounding box
        const bbox = new THREE.Box3().setFromObject(clonedControls);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());

        clonedControls.position.set(-center.x, -center.y, -center.z);
        terminalWrapper.add(clonedControls);

        // Scale to comfortable terminal kiosk size (~0.75m)
        const targetDim = 0.75;
        const maxDim = Math.max(size.x, size.y, size.z) || 1.0;
        const sc = targetDim / maxDim;
        terminalWrapper.scale.set(sc, sc, sc);
        // Rotate so terminal screen faces the player standing in front of the door (+Z)
        terminalWrapper.rotation.set(0, -Math.PI / 2, 0);

        terminalWrapper.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.castShadow = true;
            m.receiveShadow = true;
            // Clone materials for per-door independent glow
            if (Array.isArray(m.material)) {
              m.material = m.material.map(mat => mat.clone());
            } else if (m.material) {
              m.material = m.material.clone();
            }
          }
        });

        doorData.terminalWrapper = terminalWrapper;
        scannerPad.visible = false;
        scannerGroup.add(terminalWrapper);
      }
    };

    const gltfLoader = new GLTFLoader();

    if (TestDoorSystem.cachedScannerGLTF) {
      attachScannerKiosk(TestDoorSystem.cachedScannerGLTF);
    } else {
      gltfLoader.load(
        '/3d_testing_props/free_props_for_a_sci_fi_environment.glb',
        (gltf) => {
          TestDoorSystem.cachedScannerGLTF = gltf;
          attachScannerKiosk(gltf);
        },
        undefined,
        (err) => console.warn('Could not load free_props_for_a_sci_fi_environment.glb:', err)
      );
    }

    // --- 2. LOAD SUPER LOW-POLY ANIME SPACESHIP DOOR GLB ---
    const attachSpaceshipDoor = (gltf: any) => {
      const spaceshipModel = gltf.scene.clone(true);
      spaceshipModel.name = 'SpaceshipDoorModel';

      // Completely detach background environment planes so they don't skew the bounding box or linger
      const planesToRemove: THREE.Object3D[] = [];
      spaceshipModel.traverse((child: THREE.Object3D) => {
        const n = (child.name || '').toLowerCase();
        let matName = '';
        if ((child as THREE.Mesh).material) {
          const m = (child as THREE.Mesh).material;
          matName = Array.isArray(m) ? m.map(x => (x?.name || '').toLowerCase()).join(' ') : (m?.name || '').toLowerCase();
        }
        if (n.includes('plane') || n.includes('wall') || n.includes('floor') || matName.includes('wall') || matName.includes('floor')) {
          planesToRemove.push(child);
        }
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      planesToRemove.forEach((p) => {
        if (p.parent) p.parent.remove(p);
      });

      // Find the moving sliding door wings (Empty.002 / Empty002 = Right, Empty.003 / Empty003 = Left)
      let leftWing = spaceshipModel.getObjectByName('Empty003') || spaceshipModel.getObjectByName('Empty.003');
      let rightWing = spaceshipModel.getObjectByName('Empty002') || spaceshipModel.getObjectByName('Empty.002');
      if (!leftWing || !rightWing) {
        spaceshipModel.traverse((child: THREE.Object3D) => {
          const ln = (child.name || '').toLowerCase();
          if ((ln === 'empty003' || ln === 'empty.003') && !leftWing) leftWing = child;
          if ((ln === 'empty002' || ln === 'empty.002') && !rightWing) rightWing = child;
        });
      }
      if (leftWing) {
        doorData.spaceshipLeftPanel = leftWing;
        doorData.spaceshipLeftInitX = leftWing.position.x;
      }
      if (rightWing) {
        doorData.spaceshipRightPanel = rightWing;
        doorData.spaceshipRightInitX = rightWing.position.x;
      }

      // Set up skeletal/mesh animation mixer if animations exist
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(spaceshipModel);
        const clip = gltf.animations[0];
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        doorData.animationMixer = mixer;
        doorData.doorAction = action;
      }

      // Customizable transparent sci-fi glass with high transmission and crystal gloss
      const whiteGlassMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(this.currentGlassSettings.color),
        emissive: 0x000000,
        emissiveIntensity: 0.0,
        metalness: this.currentGlassSettings.metalness,
        roughness: this.currentGlassSettings.roughness,
        clearcoat: this.currentGlassSettings.clearcoat,
        clearcoatRoughness: 0.02,
        transmission: this.currentGlassSettings.transmission,
        thickness: 0.40,
        transparent: this.currentGlassSettings.opacity < 1.0,
        opacity: this.currentGlassSettings.opacity,
        envMapIntensity: 3.0,
        reflectivity: 1.0,
        ior: 1.5,
        side: THREE.DoubleSide
      });
      this.glassMaterials.push(whiteGlassMat);
      doorData.glassMat = whiteGlassMat;

      // Calculate transformed local clipping planes: 1.0 threshold (outer frame boundary) ensures zero gaps when closed while cleanly clipping wings inside wall pockets
      const clipDist = (doorWidth / 2) * 1.0;
      doorLocationGroup.updateMatrixWorld(true);
      const clipL = new THREE.Plane(new THREE.Vector3(1, 0, 0), clipDist).applyMatrix4(doorLocationGroup.matrixWorld);
      const clipR = new THREE.Plane(new THREE.Vector3(-1, 0, 0), clipDist).applyMatrix4(doorLocationGroup.matrixWorld);
      doorData.clipL = clipL;
      doorData.clipR = clipR;

      const doorGlassMaterials: THREE.MeshPhysicalMaterial[] = [];
      const blueAccentMaterials: THREE.MeshStandardMaterial[] = [];
      const texturedMats: { material: THREE.MeshStandardMaterial; blueTex: THREE.Texture; redTex: THREE.Texture; themedTex?: THREE.Texture | null }[] = [];
      const doorBodyMaterials: THREE.MeshStandardMaterial[] = [];

      spaceshipModel.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          const meshName = (m.name || '').toLowerCase();
          const parentName = (m.parent?.name || '').toLowerCase();
          // ONLY Empty.002 and Empty.003 are the sliding door wings!
          // Empty.001 is the static outer casing / frame and must NEVER be clipped!
          const isSlidingWing = meshName.includes('002') || meshName.includes('003') ||
                                parentName.includes('002') || parentName.includes('003');

          // Remove the internal threshold stopper peg triangles (y < -1.90, |x| < 1.45) from frame mesh to prevent any floating particle in the door opening
          if (!isSlidingWing && m.geometry && m.geometry.index) {
            const pos = m.geometry.attributes.position;
            const idx = m.geometry.index;
            const triCount = idx.count / 3;
            const newIndices: number[] = [];
            for (let t = 0; t < triCount; t++) {
              const iA = idx.getX(t * 3);
              const iB = idx.getX(t * 3 + 1);
              const iC = idx.getX(t * 3 + 2);
              const yA = pos.getY(iA), yB = pos.getY(iB), yC = pos.getY(iC);
              const xA = pos.getX(iA), xB = pos.getX(iB), xC = pos.getX(iC);
              const maxAY = Math.max(yA, yB, yC);
              const maxAX = Math.max(Math.abs(xA), Math.abs(xB), Math.abs(xC));
              if (maxAY < -1.90 && maxAX < 1.45) {
                continue;
              }
              newIndices.push(iA, iB, iC);
            }
            if (newIndices.length !== idx.count) {
              m.geometry = m.geometry.clone();
              m.geometry.setIndex(newIndices);
              m.geometry.computeVertexNormals();
            }
          }

          // Clone materials so per-door color changes are completely isolated
          const rawMats = Array.isArray(m.material) ? m.material : [m.material];
          const clonedMats = rawMats.map(mat => mat ? (mat as THREE.Material).clone() : mat);

          const updatedMats = clonedMats.map((mat) => {
            if (!mat) return mat;
            const stdMat = mat as THREE.MeshStandardMaterial;
            const matName = (stdMat.name || '').toLowerCase();
            const c = stdMat.color;
            const em = stdMat.emissive;

            // Apply clipping planes ONLY to sliding wings so they cleanly hide inside wall pocket
            if (isSlidingWing) {
              stdMat.clippingPlanes = [clipL, clipR];
              stdMat.clipShadows = true;
            }

            // 1. Identify strictly the purple/blue window glass panes
            const isPurpleHue = c && (c.r > 0.40 && c.b > 0.60 && c.g < 0.65);
            const isGlassMeshName = (meshName.includes('glass') || meshName.includes('window')) && !meshName.includes('frame') && !meshName.includes('casing');
            const isGlassMatName = (matName.includes('glass') || matName.includes('window') || matName.includes('purple')) && !matName.includes('frame');

            if (isPurpleHue || isGlassMeshName || isGlassMatName) {
              const glassMat = whiteGlassMat.clone();
              glassMat.clippingPlanes = [clipL, clipR];
              glassMat.clipShadows = true;
              doorGlassMaterials.push(glassMat);
              this.glassMaterials.push(glassMat);
              return glassMat;
            }

            // Collect body materials (frame & wing solid bodies) so they can turn sleek matte black in white room
            doorBodyMaterials.push(stdMat);

            // If material has an image texture (e.g. Door_texture), generate and manage red and themed variant textures
            if (stdMat.map) {
              const blueTex = stdMat.map;
              blueTex.generateMipmaps = false;
              blueTex.minFilter = THREE.LinearFilter;

              const redTex = this.createRedVariantTexture(blueTex);
              const themedTex = this.createThemedVariantTexture(blueTex, this.currentFloorColor);
              if (redTex) {
                texturedMats.push({
                  material: stdMat,
                  blueTex: blueTex,
                  redTex: redTex,
                  themedTex: themedTex
                });
              }
              if (themedTex && !doorData.isSelected) {
                stdMat.map = themedTex;
              }
              return stdMat;
            }

            // 2. Identify the outer white frame / casing
            const isOuterFrameMesh = meshName.includes('001') || parentName.includes('001') ||
                                    meshName.includes('frame') || meshName.includes('casing') ||
                                    meshName.includes('outer') || meshName.includes('arch');
            if (isOuterFrameMesh) {
              const frameMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.25,
                metalness: 0.05,
                side: THREE.DoubleSide
              });
              doorBodyMaterials.push(frameMat);
              return frameMat;
            }

            // 3. Identify non-textured blue decorative lines / emissive accent trims
            const isEmissive = em && (em.b > 0.10 || em.r > 0.10 || em.getHex() > 0);
            const isBlueNamed = matName.includes('blue') || matName.includes('line') || matName.includes('accent') ||
                                matName.includes('stripe') || matName.includes('light') || matName.includes('neon') ||
                                meshName.includes('line') || meshName.includes('stripe') || meshName.includes('accent');
            const isBlueColored = c && (c.b > 0.35 && c.b > c.r + 0.10);

            if (isEmissive || isBlueNamed || isBlueColored) {
              if (!doorData.isSelected && this.currentFloorColor) {
                stdMat.color.set(this.currentFloorColor);
                if (em) {
                  stdMat.emissive.set(this.currentFloorColor);
                  stdMat.emissiveIntensity = 0.8;
                }
              }
              blueAccentMaterials.push(stdMat);
              return stdMat;
            }

            // 4. White door wing panels
            stdMat.color.setHex(0xffffff);
            if (em) stdMat.emissive.setHex(0x000000);
            return stdMat;
          });

          m.material = Array.isArray(m.material) ? updatedMats : updatedMats[0];
        }
      });

      doorData.doorBodyMats = doorBodyMaterials;
      doorData.glassMats = doorGlassMaterials;
      doorData.glassMat = doorGlassMaterials[0] || whiteGlassMat;
      doorData.frameAccentMats = blueAccentMaterials;
      doorData.texturedAccentMats = texturedMats;

      // Center and scale spaceship door to fit doorway cutout with 100% precision
      const doorWrapper = new THREE.Group();
      const bbox = new THREE.Box3().setFromObject(spaceshipModel);
      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());

      spaceshipModel.position.set(-center.x, -bbox.min.y, -center.z);
      doorWrapper.add(spaceshipModel);

      doorWrapper.userData = { sizeX: size.x || 1.61, sizeY: size.y || 1.59 };
      const scaleX = this.currentDoorWidth / (size.x || 1.61);
      const scaleY = this.currentDoorHeight / (size.y || 1.59);
      const scaleZ = scaleY;

      doorWrapper.scale.set(scaleX, scaleY, scaleZ);
      doorWrapper.position.set(0, 0, 0.0);

      // Remove placeholder mesh and display model seamlessly
      if (placeholderMesh.parent) {
        placeholderMesh.parent.remove(placeholderMesh);
      }

      doorData.spaceshipDoorMesh = doorWrapper;
      doorLocationGroup.add(doorWrapper);

      // Immediately apply theme
      this.applyDoorThemeToDoor(doorData, this.currentFloorColor);
    };

    if (TestDoorSystem.cachedDoorGLTF) {
      attachSpaceshipDoor(TestDoorSystem.cachedDoorGLTF);
    } else {
      gltfLoader.load(
        '/3d_testing_props/super_low-poly_anime_spaceship_door.glb',
        (gltf) => {
          TestDoorSystem.cachedDoorGLTF = gltf;
          attachSpaceshipDoor(gltf);
        },
        undefined,
        (err) => console.warn('Could not load super_low-poly_anime_spaceship_door.glb:', err)
      );
    }

    this.doors.push(doorData);
    return doorData;
  }

  public update(delta: number) {
    this.doors.forEach((door) => {
      if (door.animationMixer) {
        door.animationMixer.update(delta);
      }
    });
  }

  public setDoorSelected(direction?: string | null, isSkip: boolean = false) {
    let targetDir = direction;
    if (targetDir === 'up') targetDir = 'north';
    if (targetDir === 'down') targetDir = 'south';
    if (targetDir === 'right') targetDir = 'east';
    if (targetDir === 'left') targetDir = 'west';

    const isLightOrWhite = this.isLightOrWhiteRoom(this.currentFloorColor);

    this.doors.forEach((door) => {
      const isThisSelected = !!targetDir && door.direction === targetDir;
      door.isSelected = isThisSelected;

      // Update ALL glass materials on this door:
      // Red (#bd0000) when selected!
      // If unselected in white room: BLACK (0x0a0a0c)!
      // If unselected in other rooms: glass settings color!
      const glassList = (door.glassMats && door.glassMats.length > 0) ? door.glassMats : (door.glassMat ? [door.glassMat] : []);
      glassList.forEach((mat) => {
        gsap.killTweensOf(mat);
        if (isThisSelected) {
          mat.color.setHex(0xbd0000); // Pure crimson red when selected
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0.0;
        } else if (isLightOrWhite) {
          mat.color.setHex(0x0a0a0c); // Sleek black glass for white room!
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0.0;
        } else {
          mat.color.set(this.currentGlassSettings.color);
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0.0;
        }
        mat.needsUpdate = true;
      });

      // Door body materials: Always clean white 0xffffff in all rooms
      if (door.doorBodyMats) {
        door.doorBodyMats.forEach((mat) => {
          mat.color.setHex(0xffffff);
          mat.roughness = 0.25;
          mat.metalness = 0.05;
          mat.needsUpdate = true;
        });
      }

      // Swap texture map so blue lines become crimson red (#bd0000) when selected, or floor color when unselected
      if (door.texturedAccentMats) {
        door.texturedAccentMats.forEach(({ material, blueTex, redTex, themedTex }) => {
          material.map = isThisSelected ? redTex : (themedTex || blueTex);
          material.needsUpdate = true;
        });
      }

      // Turn decorative accent lines to red (#bd0000) when selected, black in white room, floor color when unselected
      if (door.frameAccentMats) {
        door.frameAccentMats.forEach((mat) => {
          if (isThisSelected) {
            mat.color.setHex(0xbd0000);
            if ('emissive' in mat) {
              mat.emissive.setHex(0xbd0000);
              mat.emissiveIntensity = 0.9;
            }
          } else if (isLightOrWhite) {
            mat.color.setHex(0x000000);
            if ('emissive' in mat) {
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0.0;
            }
          } else {
            mat.color.set(this.currentFloorColor);
            if ('emissive' in mat) {
              mat.emissive.set(this.currentFloorColor);
              mat.emissiveIntensity = 0.8;
            }
          }
        });
      }

      if (door.glowFrameMat) {
        gsap.killTweensOf(door.glowFrameMat);
        if (isThisSelected) {
          door.glowFrameMat.color.setHex(0xbd0000);
          door.glowFrameMat.opacity = 0.95;
        } else if (isLightOrWhite) {
          door.glowFrameMat.color.setHex(0x000000);
          door.glowFrameMat.opacity = 0.70;
        } else {
          door.glowFrameMat.color.set(this.currentFloorColor);
          door.glowFrameMat.opacity = 0.85;
        }
      }

      // Direction Card: Red when selected, floor color when unselected
      if (door.dirCardMat) {
        const newTex = this.createDirectionCardTexture(door.direction, isThisSelected, isSkip, this.currentFloorColor);
        door.dirCardMat.map = newTex;
        door.dirCardMat.needsUpdate = true;
      }

      if (door.dirCardMesh) {
        gsap.killTweensOf(door.dirCardMesh.scale);
        door.dirCardMesh.scale.set(1.0, 1.0, 1.0);
      }

      // Scanner Status Label: Red when selected, floor color when unselected
      if (door.scannerStatusMat) {
        const statusText = isThisSelected ? 'SCANNER: SELECTED' : (door.isOpen ? 'STATUS: UNLOCKED' : 'SCANNER: READY');
        const statusType = isThisSelected ? 'selected' : (door.isOpen ? 'open' : 'ready');
        const newTex = this.createScannerStatusTexture(statusText, statusType, this.currentFloorColor, isThisSelected);
        door.scannerStatusMat.map = newTex;
        door.scannerStatusMat.needsUpdate = true;
      }

      // Scanner LED & Ring: Red (#bd0000) when selected, slate/cyan when unselected
      if (door.scannerLedMat) {
        door.scannerLedMat.color.setHex(isThisSelected ? 0xbd0000 : (isLightOrWhite ? 0x475569 : 0x06b6d4));
      }
      if (door.scannerRingMat) {
        door.scannerRingMat.color.setHex(isThisSelected ? 0xbd0000 : (isLightOrWhite ? 0x64748b : 0x38bdf8));
      }

      // Terminal Kiosk emissive: Red (#bd0000) when selected, off in white room, cyan in others
      if (door.terminalWrapper) {
        door.terminalWrapper.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            mats.forEach((mat) => {
              if (mat && 'emissive' in mat) {
                (mat as THREE.MeshStandardMaterial).emissive.setHex(isThisSelected ? 0xbd0000 : (isLightOrWhite ? 0x000000 : 0x0284c7));
                (mat as THREE.MeshStandardMaterial).emissiveIntensity = isThisSelected ? 2.0 : 0.6;
              }
            });
          }
        });
      }
    });
  }

  public applyDoorThemeToDoor(door: TestDoorData3D, floorColor: string) {
    if (!floorColor) return;
    const isLightOrWhite = this.isLightOrWhiteRoom(floorColor);

    // 1. Door body color: Sleek clean white (#ffffff) for ALL rooms!
    if (door.doorBodyMats && door.doorBodyMats.length > 0) {
      door.doorBodyMats.forEach((mat) => {
        mat.color.setHex(0xffffff);
        mat.roughness = 0.25;
        mat.metalness = 0.05;
        mat.needsUpdate = true;
      });
    }

    // 2. Update Direction Card above door to match floor color (or red if selected)
    if (door.dirCardMat) {
      const newTex = this.createDirectionCardTexture(door.direction, door.isSelected, false, floorColor);
      door.dirCardMat.map = newTex;
      door.dirCardMat.needsUpdate = true;
    }

    // 4. Update Scanner Status Badge (Red if selected, or floor color if unselected)
    if (door.scannerStatusMat) {
      const statusText = door.isSelected ? 'SCANNER: SELECTED' : (door.isOpen ? 'STATUS: UNLOCKED' : 'SCANNER: READY');
      const statusType = door.isSelected ? 'selected' : (door.isOpen ? 'open' : 'ready');
      const newTex = this.createScannerStatusTexture(statusText, statusType, floorColor, door.isSelected);
      door.scannerStatusMat.map = newTex;
      door.scannerStatusMat.needsUpdate = true;
    }

    // 5. Update glass & accents (if unselected)
    if (!door.isSelected) {
      if (door.glassMats) {
        door.glassMats.forEach((gm) => {
          if (isLightOrWhite) {
            // "make black color for door glass only"
            gm.color.setHex(0x0a0a0c); // Sleek black glass for white room
          } else {
            gm.color.set(this.currentGlassSettings.color || floorColor);
          }
          gm.needsUpdate = true;
        });
      }

      const accentColor = isLightOrWhite ? '#000000' : floorColor;

      if (door.frameAccentMats) {
        door.frameAccentMats.forEach((mat) => {
          mat.color.set(accentColor);
          if ('emissive' in mat) {
            mat.emissive.set(accentColor);
            mat.emissiveIntensity = isLightOrWhite ? 0.0 : 0.8;
          }
          mat.needsUpdate = true;
        });
      }

      if (door.glowFrameMat) {
        door.glowFrameMat.color.set(accentColor);
        door.glowFrameMat.opacity = isLightOrWhite ? 0.70 : 0.85;
      }

      // 6. Update textured door panels (Door_texture blue lines -> floorColor)
      if (door.texturedAccentMats) {
        door.texturedAccentMats.forEach((item) => {
          item.themedTex = this.createThemedVariantTexture(item.blueTex, accentColor);
          if (item.themedTex) {
            item.material.map = item.themedTex;
            item.material.needsUpdate = true;
          }
        });
      }
    }
  }

  public updateDoorThemeColors(floorColor: string) {
    if (!floorColor) return;
    this.currentFloorColor = floorColor;

    this.doors.forEach((door) => {
      this.applyDoorThemeToDoor(door, floorColor);
    });
  }

  public animateDoorsFadeIn(entryDirOrFlag?: any) {
    this.doors.forEach((door) => {
      if (door.doorLocationGroup) {
        door.doorLocationGroup.position.y = -0.3;
        gsap.to(door.doorLocationGroup.position, {
          y: 0,
          duration: 0.6,
          ease: 'power2.out'
        });
      }
    });
  }

  public closeAllDoors(slow: boolean = false, keepOpened: boolean = false) {
    this.doors.forEach((door) => {
      if (keepOpened && door.isOpen) return;
      door.isOpen = false;
      if (door.doorAction) {
        door.doorAction.paused = false;
        door.doorAction.timeScale = slow ? -1.0 : -2.5;
        door.doorAction.play();
      }
    });
  }

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

      const loadedTexture = textureLoader.load(cardImgUrl, (t) => {
        t.needsUpdate = true;
        t.colorSpace = THREE.SRGBColorSpace;
      });
      loadedTexture.colorSpace = THREE.SRGBColorSpace;

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

    group.rotation.y = 0;
    gsap.to(group.rotation, {
      y: Math.PI * 2,
      duration: 6.0,
      repeat: -1,
      ease: 'none'
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

  public updateScannerStatus(
    direction: 'north' | 'south' | 'east' | 'west',
    statusText: string,
    statusType: 'ready' | 'scanning' | 'granted' | 'open' | 'selected' = 'ready'
  ) {
    const door = this.doors.find(d => d.direction === direction);
    if (door && door.scannerStatusMat) {
      const isSelected = !!door.isSelected && (statusType === 'ready' || statusType === 'selected' || statusType === 'open');
      const finalType = isSelected ? 'selected' : statusType;
      const finalText = (isSelected && statusText === 'SCANNER: READY') ? 'SCANNER: SELECTED' : statusText;
      const newTex = this.createScannerStatusTexture(finalText, finalType, this.currentFloorColor, isSelected);
      door.scannerStatusMat.map = newTex;
      door.scannerStatusMat.needsUpdate = true;
    }
  }

  public resetAllScannerStatus() {
    this.doors.forEach((door) => {
      if (door.scannerStatusMat) {
        const isSelected = !!door.isSelected;
        const statusText = isSelected ? 'SCANNER: SELECTED' : (door.isOpen ? 'STATUS: UNLOCKED' : 'SCANNER: READY');
        const statusType = isSelected ? 'selected' : (door.isOpen ? 'open' : 'ready');
        const newTex = this.createScannerStatusTexture(statusText, statusType, this.currentFloorColor, isSelected);
        door.scannerStatusMat.map = newTex;
        door.scannerStatusMat.needsUpdate = true;
      }
    });
  }

  public setScannerTransform(posX: number, posY: number, posZ: number, scale: number = 1.60, rotX: number = 0, rotY: number = 0, rotZ: number = 0) {
    this.currentScannerSettings = { posX, posY, posZ, scale };
    this.doors.forEach((door) => {
      if (door.scannerGroup) {
        door.scannerGroup.position.set(this.currentDoorWidth / 2 + posX, posY, posZ);
        door.scannerGroup.scale.set(scale, scale, scale);
        door.scannerGroup.rotation.set(rotX, rotY, rotZ);
      }
    });
  }

  public triggerFaceScan(direction: 'north' | 'south' | 'east' | 'west', onComplete?: () => void) {
    const door = this.doors.find(d => d.direction === direction);
    if (!door || !door.scannerBeamGroup || !door.scannerLedMat) {
      if (onComplete) onComplete();
      return;
    }

    const beamGroup = door.scannerBeamGroup;
    const ledMat = door.scannerLedMat;
    const ringMat = door.scannerRingMat;
    const beamMats = door.scannerBeamMats || [];
    const reticleMesh = door.scannerReticleMesh;

    // Reset initial state to bright laser cyan
    ledMat.color.setHex(0x00ffff);
    if (ringMat) ringMat.color.setHex(0x00ffff);
    beamMats.forEach((m, idx) => {
      m.color.setHex(0x00ffff);
      m.opacity = idx === 1 ? 0.40 : (idx === 2 ? 0.60 : 0.85);
    });

    beamGroup.visible = true;
    beamGroup.position.set(0, 0.05, 0.04);
    beamGroup.rotation.set(0, 0, 0);
    if (reticleMesh) {
      reticleMesh.scale.set(1.0, 1.0, 1.0);
      reticleMesh.rotation.z = 0;
    }

    try { this.soundEngine?.playBeep(); } catch (e) { }

    // Smooth volumetric optical sweeping animation
    const tl = gsap.timeline({
      onComplete: () => {
        // Recognition success: turn laser emerald green
        ledMat.color.setHex(0x10b981);
        if (ringMat) ringMat.color.setHex(0x10b981);
        beamMats.forEach((m) => m.color.setHex(0x10b981));

        try { this.soundEngine?.playLaserCharge(); } catch (e) { }

        // Reticle pulse expansion
        if (reticleMesh) {
          gsap.to(reticleMesh.scale, { x: 1.35, y: 1.35, duration: 0.35, ease: 'back.out(2)' });
        }

        // Fade out volumetric beam
        beamMats.forEach((m) => {
          gsap.to(m, {
            opacity: 0,
            duration: 0.35,
            delay: 0.3,
            onComplete: () => {
              beamGroup.visible = false;
              m.color.setHex(0x00ffff);
            }
          });
        });

        setTimeout(() => {
          if (onComplete) onComplete();
        }, 450);
      }
    });

    // Optical vertical raster sweep and slight angle tilt (mimics biometric laser tracking face)
    tl.to(beamGroup.position, { y: 0.22, duration: 0.38, ease: 'sine.inOut' }, 0)
      .to(beamGroup.rotation, { x: -0.08, duration: 0.38, ease: 'sine.inOut' }, 0)
      .to(beamGroup.position, { y: -0.12, duration: 0.42, ease: 'sine.inOut' }, 0.38)
      .to(beamGroup.rotation, { x: 0.06, duration: 0.42, ease: 'sine.inOut' }, 0.38)
      .to(beamGroup.position, { y: 0.05, duration: 0.35, ease: 'sine.inOut' }, 0.80)
      .to(beamGroup.rotation, { x: 0.0, duration: 0.35, ease: 'sine.inOut' }, 0.80);

    if (reticleMesh) {
      tl.to(reticleMesh.rotation, { z: Math.PI * 0.5, duration: 1.15, ease: 'power1.inOut' }, 0);
    }
  }

  public getNearbyDoor(playerPos: THREE.Vector3): TestDoorData3D | null {
    for (const door of this.doors) {
      const dist = playerPos.distanceTo(door.position);
      if (dist <= 4.0) {
        return door;
      }
    }
    return null;
  }

  public openDoor(door: TestDoorData3D, onComplete?: () => void) {
    if (door.isOpen) return;
    door.isOpen = true;

    // Smoothly slide the door wings deep into the wall pockets with heavy, realistic pneumatic sci-fi pace
    if (door.spaceshipRightPanel && door.spaceshipLeftPanel) {
      gsap.killTweensOf(door.spaceshipRightPanel.position);
      gsap.killTweensOf(door.spaceshipLeftPanel.position);
      const initRightX = door.spaceshipRightInitX ?? 153.8;
      const initLeftX = door.spaceshipLeftInitX ?? 153.8;

      door.spaceshipRightPanel.visible = true;
      door.spaceshipLeftPanel.visible = true;

      gsap.to(door.spaceshipRightPanel.position, {
        x: initRightX + 85.0,
        duration: 1.45,
        ease: 'power2.inOut',
        onComplete: () => {
          if (door.isOpen) {
            if (door.spaceshipRightPanel) door.spaceshipRightPanel.visible = false;
            if (door.spaceshipLeftPanel) door.spaceshipLeftPanel.visible = false;
          }
        }
      });
      gsap.to(door.spaceshipLeftPanel.position, {
        x: initLeftX - 85.0,
        duration: 1.45,
        ease: 'power2.inOut'
      });
    }

    if (onComplete) {
      setTimeout(onComplete, 1200);
    }
  }

  public closeDoor(door: TestDoorData3D, onComplete?: () => void) {
    door.isOpen = false;

    // Smoothly slide the door wings back to closed rest position
    if (door.spaceshipRightPanel && door.spaceshipLeftPanel) {
      gsap.killTweensOf(door.spaceshipRightPanel.position);
      gsap.killTweensOf(door.spaceshipLeftPanel.position);
      const initRightX = door.spaceshipRightInitX ?? 153.8;
      const initLeftX = door.spaceshipLeftInitX ?? 153.8;

      door.spaceshipRightPanel.visible = true;
      door.spaceshipLeftPanel.visible = true;

      gsap.to(door.spaceshipRightPanel.position, {
        x: initRightX,
        duration: 1.45,
        ease: 'power2.inOut'
      });
      gsap.to(door.spaceshipLeftPanel.position, {
        x: initLeftX,
        duration: 1.45,
        ease: 'power2.inOut'
      });
    }

    if (onComplete) {
      setTimeout(onComplete, 1200);
    }
  }

  /**
   * Set scanner LED/ring/model glow color on a specific door
   * @param direction - which door's scanner to update
   * @param color - 'green' (authenticated), 'cyan' (scanning), 'white' (open), 'red' (denied)
   */
  public setScannerGlow(direction: 'north' | 'south' | 'east' | 'west', color: 'green' | 'cyan' | 'white' | 'red') {
    const door = this.doors.find(d => d.direction === direction);
    if (!door) return;

    const hexMap: Record<string, number> = {
      green: 0x22c55e,
      cyan:  0x06b6d4,
      white: 0xf8fafc,
      red:   0xef4444,
    };
    const hex = hexMap[color] ?? 0x06b6d4;

    if (door.scannerLedMat) {
      door.scannerLedMat.color.setHex(hex);
    }
    if (door.scannerRingMat) {
      door.scannerRingMat.color.setHex(hex);
    }

    // Glow the 3D terminal mesh materials
    if (door.terminalWrapper) {
      door.terminalWrapper.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => {
            if (mat && 'emissive' in mat) {
              (mat as THREE.MeshStandardMaterial).emissive.setHex(hex);
              (mat as THREE.MeshStandardMaterial).emissiveIntensity = color === 'green' ? 2.5 : 1.2;
            }
          });
        }
      });
    }

    // Also pulse the scanner beam briefly on touch
    if (color === 'cyan' || color === 'green') {
      const beamGroup = door.scannerBeamGroup || (door.scannerBeam as THREE.Group);
      const beamMats = door.scannerBeamMats;
      if (beamGroup) {
        beamGroup.visible = true;
        if (beamMats) {
          beamMats.forEach((m, idx) => {
            m.color.setHex(hex);
            m.opacity = idx === 1 ? 0.40 : 0.75;
            gsap.to(m, {
              opacity: 0,
              duration: 0.45,
              delay: 0.1,
              onComplete: () => { beamGroup.visible = false; }
            });
          });
        }
      }
    }
  }

  public openBoughtDoor(boughtDirName?: string | null, instant: boolean = false, isSkip: boolean = false) {
    let targetDir = boughtDirName;
    if (targetDir === 'up') targetDir = 'north';
    if (targetDir === 'down') targetDir = 'south';
    if (targetDir === 'right') targetDir = 'east';
    if (targetDir === 'left') targetDir = 'west';

    this.setDoorSelected(targetDir, isSkip);

    this.doors.forEach((door) => {
      if (targetDir && door.direction === targetDir) {
        this.openDoor(door);
      } else {
        this.closeDoor(door);
      }
    });
  }
}
