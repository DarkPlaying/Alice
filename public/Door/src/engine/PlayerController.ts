import * as THREE from 'three';
import { SoundEngine } from '../audio/SoundEngine';
import { DoorData } from '../world/DoorSystem';

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public position: THREE.Vector3;
  private velocity: THREE.Vector3;
  private direction: THREE.Vector3;
  private euler: THREE.Euler;

  // Movement flags
  public moveForward: boolean = false;
  public moveBackward: boolean = false;
  public moveLeft: boolean = false;
  public moveRight: boolean = false;

  // Mouse rotation sensitivity & limits
  private moveSpeed: number = 4.5;
  private mouseSensitivity: number = 0.0022;
  private isPointerLocked: boolean = false;

  // Head bobbing & footsteps
  private stepTimer: number = 0;
  private stepDistance: number = 0;

  private soundEngine: SoundEngine;

  constructor(camera: THREE.PerspectiveCamera, soundEngine: SoundEngine) {
    this.camera = camera;
    this.soundEngine = soundEngine;

    // Spawn player in center of 16m x 16m square room
    this.position = new THREE.Vector3(0, 1.6, 0);
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    this.camera.position.copy(this.position);
    this.camera.rotation.copy(this.euler);

    this.setupInputs();
  }

  private setupInputs() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));

    let isDragging = false;
    let previousX = 0;
    let previousY = 0;

    window.addEventListener('mousedown', (e) => {
      if (e.target instanceof HTMLCanvasElement) {
        isDragging = true;
        previousX = e.clientX;
        previousY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging && !this.isPointerLocked) {
        const deltaX = e.clientX - previousX;
        const deltaY = e.clientY - previousY;
        previousX = e.clientX;
        previousY = e.clientY;

        this.euler.y -= deltaX * this.mouseSensitivity;
        this.euler.x -= deltaY * this.mouseSensitivity;
        this.clampPitch();
        this.camera.quaternion.setFromEuler(this.euler);
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement !== null;
    });
  }

  public requestPointerLock(element: HTMLElement) {
    element.requestPointerLock();
  }

  private onMouseMove(e: MouseEvent) {
    if (this.isPointerLocked) {
      this.euler.y -= e.movementX * this.mouseSensitivity;
      this.euler.x -= e.movementY * this.mouseSensitivity;
      this.clampPitch();
      this.camera.quaternion.setFromEuler(this.euler);
    }
  }

  private clampPitch() {
    this.euler.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.euler.x));
  }

  private onKeyDown(e: KeyboardEvent) {
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

  public update(delta: number, isModalOpen: boolean, doors: DoorData[]) {
    if (isModalOpen) return;

    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;

    this.velocity.x -= this.velocity.x * 10.0 * delta;
    this.velocity.z -= this.velocity.z * 10.0 * delta;

    if (isMoving) {
      this.velocity.z -= this.direction.z * this.moveSpeed * 10.0 * delta;
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

    // Check open doors to allow deep walking past door frame into adjacent room preview
    const northOpen = doors.some(d => d.direction === 'north' && d.isOpen);
    const southOpen = doors.some(d => d.direction === 'south' && d.isOpen);
    const eastOpen = doors.some(d => d.direction === 'east' && d.isOpen);
    const westOpen = doors.some(d => d.direction === 'west' && d.isOpen);

    let minX = -7.2, maxX = 7.2;
    let minZ = -7.2, maxZ = 7.2;

    // Allow walking deep past open door frames up to 12m
    if (northOpen && Math.abs(this.position.x) < 1.1) minZ = -12.0;
    if (southOpen && Math.abs(this.position.x) < 1.1) maxZ = 12.0;
    if (westOpen && Math.abs(this.position.z) < 1.1) minX = -12.0;
    if (eastOpen && Math.abs(this.position.z) < 1.1) maxX = 12.0;

    if (nextPos.x >= minX && nextPos.x <= maxX) {
      this.position.x = nextPos.x;
    }
    if (nextPos.z >= minZ && nextPos.z <= maxZ) {
      this.position.z = nextPos.z;
    }

    if (isMoving) {
      this.stepTimer += delta * 10;
      this.stepDistance += delta * this.moveSpeed;

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
