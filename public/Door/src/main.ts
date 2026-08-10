import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { PlayerController } from './engine/PlayerController';
import { DungeonHallway } from './world/DungeonHallway';
import { DoorSystem } from './world/DoorSystem';
import { SoundEngine } from './audio/SoundEngine';
import { InteractionUI } from './ui/InteractionUI';
import { MazeMapData } from './world/MazeMapData';
import { TextureConfig } from './config/TextureConfig';

class Application {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private clock: THREE.Clock;

  private soundEngine: SoundEngine;
  private playerController: PlayerController;
  private hallway: DungeonHallway;
  private doorSystem: DoorSystem;
  private ui: InteractionUI;

  // Current Maze Cell Coordinates (Starts at R1: x=0, y=6)
  private currentRoomCoord = { x: 0, y: 6 };
  private isTransitioningRoom: boolean = false;

  constructor() {
    const container = document.getElementById('canvas-container')!;

    // Clean background & light atmospheric fog
    const bgHex = TextureConfig.BACKGROUND_COLOR && TextureConfig.BACKGROUND_COLOR !== '#000000'
      ? TextureConfig.BACKGROUND_COLOR
      : '#0f172a';
    const bgColor = new THREE.Color(bgHex);
    this.scene = new THREE.Scene();
    this.scene.background = bgColor;

    // Camera
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 50);
    this.scene.add(this.camera);

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // Bloom Pipeline
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    this.clock = new THREE.Clock();

    // Sound & Engine Systems
    this.soundEngine = new SoundEngine();
    this.playerController = new PlayerController(this.camera, this.soundEngine);
    this.hallway = new DungeonHallway(this.scene);
    this.doorSystem = new DoorSystem(this.scene, this.soundEngine);
    this.ui = new InteractionUI(this.soundEngine);

    this.setupLighting();
    this.loadCurrentRoom();
    this.setupEventListeners();

    this.animate();
  }

  private setupLighting() {
    // Pure uniform ambient lighting to eliminate hot spots, specular highlights, and light reflections
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    this.scene.add(ambientLight);
  }

  private loadCurrentRoom() {
    const cell = MazeMapData.getCell(this.currentRoomCoord.x, this.currentRoomCoord.y);
    if (!cell) return;

    this.hallway.rebuildRoomForCell(cell, this.doorSystem);
    this.ui.setCurrentCell(cell);
    this.doorSystem.animateDoorsFadeIn();
  }

  private setupEventListeners() {
    this.renderer.domElement.addEventListener('click', () => {
      const nearbyDoor = this.doorSystem.getNearbyDoor(this.playerController.position);
      if (nearbyDoor && !nearbyDoor.isOpen) {
        if (!this.doorSystem.isAnyDoorOpen()) {
          this.doorSystem.openDoor(nearbyDoor);
        }
      } else if (!this.ui.isModalOpen) {
        this.playerController.requestPointerLock(this.renderer.domElement);
      }
    });

    this.ui.setOnDoorOpenCallback((door) => {
      this.doorSystem.openDoor(door);
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private checkDoorThresholdPassage() {
    if (this.isTransitioningRoom) return;

    const pos = this.playerController.position;

    for (const door of this.doorSystem.doors) {
      if (!door.isOpen || !door.targetRoom) continue;

      let hasCrossed = false;
      let spawnX = pos.x;
      let spawnZ = pos.z;

      switch (door.direction) {
        case 'north':
          if (pos.z <= -10.5 && Math.abs(pos.x) < 1.1) {
            hasCrossed = true;
            spawnX = pos.x;
            spawnZ = 5.5;
          }
          break;
        case 'south':
          if (pos.z >= 10.5 && Math.abs(pos.x) < 1.1) {
            hasCrossed = true;
            spawnX = pos.x;
            spawnZ = -5.5;
          }
          break;
        case 'east':
          if (pos.x >= 10.5 && Math.abs(pos.z) < 1.1) {
            hasCrossed = true;
            spawnX = -5.5;
            spawnZ = pos.z;
          }
          break;
        case 'west':
          if (pos.x <= -10.5 && Math.abs(pos.z) < 1.1) {
            hasCrossed = true;
            spawnX = 5.5;
            spawnZ = pos.z;
          }
          break;
      }

      if (hasCrossed) {
        this.isTransitioningRoom = true;

        this.doorSystem.closeDoor(door);
        this.currentRoomCoord = door.targetRoom;
        this.playerController.position.set(spawnX, 1.6, spawnZ);

        this.loadCurrentRoom();
        this.soundEngine.playMagicChime();

        setTimeout(() => {
          this.isTransitioningRoom = false;
        }, 300);

        break;
      }
    }
  }

  private animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    this.playerController.update(delta, this.ui.isModalOpen, this.doorSystem.doors);
    const nearbyDoor = this.doorSystem.getNearbyDoor(this.playerController.position);
    this.ui.updateProximity(nearbyDoor, this.doorSystem.isAnyDoorOpen());

    this.checkDoorThresholdPassage();

    this.hallway.update(elapsedTime);
    this.composer.render();
  }
}

// Start application
new Application();
