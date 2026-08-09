import * as THREE from 'three';
import type { DoorData3D } from './DoorSystem';
import { SoundEngine } from './SoundEngine';
import { DOOR_3D_CONFIG } from './door3dConfig';

export class PlayerController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private soundEngine: SoundEngine;

  public position: THREE.Vector3;

  private isPointerLocked = false;
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');

  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;

  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  public moveSpeed = 6.0;

  private stepTimer = 0;
  private stepDistance = 0;

  public onSelectKeyPress?: () => void;
  public onExitDoorBoundary?: () => void;
  public allowExitDoor = false;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, soundEngine: SoundEngine) {
    this.camera = camera;
    this.domElement = domElement;
    this.soundEngine = soundEngine;

    this.position = new THREE.Vector3(0, 1.6, 0);
    this.camera.position.copy(this.position);

    this.initEventListeners();
  }

  public setPosition(x: number, y: number, z: number) {
    this.position.set(x, y, z);
    this.camera.position.set(x, y, z);
  }

  public resetPositionKeepRotation(pos: THREE.Vector3 = new THREE.Vector3(0, 1.6, 0)) {
    this.position.copy(pos);
    this.camera.position.copy(pos);
    this.euler.setFromQuaternion(this.camera.quaternion);
  }

  public resetPositionAndRotation(pos: THREE.Vector3 = new THREE.Vector3(0, 1.6, 0), yaw: number = 0, pitch: number = 0) {
    this.position.copy(pos);
    this.camera.position.copy(pos);
    this.euler.set(pitch, yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
  }

  public setFacingDirection(dirName: string) {
    let yaw = 0;
    const d = String(dirName).toLowerCase();
    if (d === 'up' || d === 'north') yaw = 0;
    if (d === 'down' || d === 'south') yaw = Math.PI;
    if (d === 'right' || d === 'east') yaw = -Math.PI / 2;
    if (d === 'left' || d === 'west') yaw = Math.PI / 2;

    this.euler.set(0, yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
  }

  private initEventListeners() {
    this.domElement.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.domElement;
    });

    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  public resetToCenter() {
    this.position.set(0, 1.6, 0);
    this.euler.set(0, 0, 0);
    this.camera.quaternion.setFromEuler(this.euler);
  }

  public unlockPointer() {
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    if (this.isPointerLocked) {
      document.exitPointerLock();
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isPointerLocked) return;

    const movementX = e.movementX || 0;
    const movementY = e.movementY || 0;

    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= movementX * 0.0022;
    this.euler.x -= movementY * 0.0022;

    this.euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (!this.isPointerLocked) return;

    if (e.key === 'Control') {
      this.unlockPointer();
    }

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = true;
        break;
      case 'KeyE':
      case 'Space':
        if (!e.repeat && this.onSelectKeyPress) {
          this.onSelectKeyPress();
        }
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = false;
        break;
    }
  }

  public update(delta: number, isInteracting: boolean, doors: DoorData3D[] = []) {
    this.velocity.x -= this.velocity.x * 10.0 * delta;
    this.velocity.z -= this.velocity.z * 10.0 * delta;

    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;

    if (this.moveForward || this.moveBackward) {
      this.velocity.z -= this.direction.z * this.moveSpeed * 10.0 * delta;
    }
    if (this.moveLeft || this.moveRight) {
      this.velocity.x -= this.direction.x * this.moveSpeed * 10.0 * delta;
    }

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    const moveVector = forward.clone().multiplyScalar(-this.velocity.z * delta)
      .add(right.clone().multiplyScalar(-this.velocity.x * delta));

    const nextPos = this.position.clone().add(moveVector);

    // Room bounds matching Door reference project: 7.2m base square room
    const bound = 7.2;
    const isSkipActive = doors.some(d => (d as any).isSkip);
    const passDepth = isSkipActive ? 28.0 : 12.0;

    let minX = -bound, maxX = bound;
    let minZ = -bound, maxZ = bound;

    if (this.allowExitDoor) {
      const openNorth = doors.find(d => (d.direction === 'north' || (d as any).direction === 'up') && d.isOpen);
      const openSouth = doors.find(d => (d.direction === 'south' || (d as any).direction === 'down') && d.isOpen);
      const openEast = doors.find(d => (d.direction === 'east' || (d as any).direction === 'right') && d.isOpen);
      const openWest = doors.find(d => (d.direction === 'west' || (d as any).direction === 'left') && d.isOpen);

      // Tight corridor: half door width minus buffer so player can't squeeze past frame
      const corridorHalf = DOOR_3D_CONFIG.DOOR_WIDTH / 2 - 0.15;

      // Check NEXT position (not current) to prevent entering corridor from the side
      if (openNorth && Math.abs(nextPos.x) < corridorHalf) minZ = -passDepth;
      if (openSouth && Math.abs(nextPos.x) < corridorHalf) maxZ = passDepth;
      if (openWest && Math.abs(nextPos.z) < corridorHalf) minX = -passDepth;
      if (openEast && Math.abs(nextPos.z) < corridorHalf) maxX = passDepth;
    }

    if (nextPos.x >= minX && nextPos.x <= maxX) {
      this.position.x = nextPos.x;
    }
    if (nextPos.z >= minZ && nextPos.z <= maxZ) {
      this.position.z = nextPos.z;
    }

    // Force-clamp perpendicular axis when inside corridor zone (past room wall)
    // This prevents the player from strafing sideways through door frame walls
    const corridorClamp = DOOR_3D_CONFIG.DOOR_WIDTH / 2 - 0.15;
    if (Math.abs(this.position.z) > bound) {
      // In north/south corridor — clamp X to corridor width
      this.position.x = Math.max(-corridorClamp, Math.min(corridorClamp, this.position.x));
    }
    if (Math.abs(this.position.x) > bound) {
      // In east/west corridor — clamp Z to corridor width
      this.position.z = Math.max(-corridorClamp, Math.min(corridorClamp, this.position.z));
    }
    this.position.y = 1.6;

    if (isMoving) {
      this.stepTimer += delta * 10;
      this.stepDistance += delta * this.moveSpeed;

      if (Math.random() < 0.05) {
        console.log(`[PLAYER 3D POS] X: ${this.position.x.toFixed(2)}m, Y: ${this.position.y.toFixed(2)}m, Z: ${this.position.z.toFixed(2)}m`);
      }

      if (this.stepDistance > 1.8) {
        this.soundEngine.playStep();
        this.stepDistance = 0;
      }

      this.camera.position.y = 1.6 + Math.sin(this.stepTimer) * 0.04;
    } else {
      this.stepTimer += delta * 2;
      this.camera.position.y = 1.6 + Math.sin(this.stepTimer) * 0.008;
    }

    this.camera.position.x = this.position.x;
    this.camera.position.z = this.position.z;
  }
}
