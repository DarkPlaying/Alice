import * as THREE from 'three';
import gsap from 'gsap';
import { DoorSystem } from './DoorSystem';
import type { MapCell } from '../jokerTypes';
import { DOOR_3D_CONFIG } from './door3dConfig';

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

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);

    this.cornerBeamMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8, // Light slate corner beams
      side: THREE.DoubleSide
    });

    this.cornerLineMaterial = new THREE.LineBasicMaterial({
      color: 0x94a3b8, // Light slate room outline lines
      linewidth: 3,
      depthTest: true,
      depthWrite: true
    });

    this.smoothWhiteMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2
    });

    this.doorOpeningBorderMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8, // Light slate architectural doorway frame border
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2
    });

    this.wallMaterial = new THREE.MeshBasicMaterial({
      color: 0xf8fafc, // Soft off-white wall for subtle visual contrast with lines
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2
    });

    this.floorMaterial = new THREE.MeshBasicMaterial({
      color: 0xf1f5f9, // Light slate floor for spatial depth
      side: THREE.DoubleSide
    });

    this.ceilingMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2
    });
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
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 128);

    ctx.lineWidth = 6;
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(6, 6, 500, 116);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(14, 14, 484, 100);

    ctx.fillStyle = '#475569';
    ctx.font = '900 42px "Cinzel", "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BLOCKED WALL', 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  public rebuildRoomForCell(cell: MapCell, doorSystem: DoorSystem, gridMatrix: MapCell[][], isSkip: boolean = false, player?: any, isRevealPhase: boolean = false) {
    this.player = player;
    while (this.roomGroup.children.length > 0) {
      const child = this.roomGroup.children[0];
      this.roomGroup.remove(child);
    }

    doorSystem.clearDoors();

    const roomSize = DOOR_3D_CONFIG.ROOM_SIZE;
    const height = DOOR_3D_CONFIG.ROOM_HEIGHT;
    const doorWidth = DOOR_3D_CONFIG.DOOR_WIDTH;
    const doorHeight = DOOR_3D_CONFIG.DOOR_HEIGHT;
    const wallThickness = DOOR_3D_CONFIG.WALL_THICKNESS;
    const doorOffsetPos = roomSize / 2; // Exact wall position for 0 gap!

    const floorGeo = new THREE.PlaneGeometry(roomSize, roomSize);
    const floor = new THREE.Mesh(floorGeo, this.floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    this.roomGroup.add(floor);

    const ceilingGeo = new THREE.PlaneGeometry(roomSize, roomSize);
    const ceiling = new THREE.Mesh(ceilingGeo, this.ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = height;
    this.roomGroup.add(ceiling);

    // Clean 3D vector lines (0 thickness) for room box outline in light charcoal (#64748b)
    const halfR = roomSize / 2 - 0.01;
    const cornerBeamGroup = new THREE.Group();

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
    cornerLines.renderOrder = 9999;
    cornerBeamGroup.add(cornerLines);

    this.roomGroup.add(cornerBeamGroup);

    const buildWallWithFullRoomView = (
      position: THREE.Vector3,
      rotationY: number,
      hasDoor: boolean,
      isSkipPassage: boolean = false,
      destCell?: MapCell | null,
      doorCost: number = 10,
      doorId: number = 1,
      specialType?: string
    ) => {
      const wallGroup = new THREE.Group();
      wallGroup.position.copy(position);
      wallGroup.rotation.y = rotationY;

      const sideWidth = (roomSize - doorWidth) / 2;
      const topHeight = height - doorHeight;

      // Clean vector line border (0 thickness) for wall face & doorway opening
      const wHalf = roomSize / 2 - 0.01;
      const wallFacePoints: THREE.Vector3[] = [
        new THREE.Vector3(-wHalf, 0.01, 0.01), new THREE.Vector3(wHalf, 0.01, 0.01),
        new THREE.Vector3(wHalf, 0.01, 0.01), new THREE.Vector3(wHalf, height - 0.01, 0.01),
        new THREE.Vector3(wHalf, height - 0.01, 0.01), new THREE.Vector3(-wHalf, height - 0.01, 0.01),
        new THREE.Vector3(-wHalf, height - 0.01, 0.01), new THREE.Vector3(-wHalf, 0.01, 0.01),
      ];

      if (hasDoor) {
        const dWHalf = doorWidth / 2;
        wallFacePoints.push(
          new THREE.Vector3(-dWHalf, 0.01, 0.01), new THREE.Vector3(-dWHalf, doorHeight, 0.01),
          new THREE.Vector3(-dWHalf, doorHeight, 0.01), new THREE.Vector3(dWHalf, doorHeight, 0.01),
          new THREE.Vector3(dWHalf, doorHeight, 0.01), new THREE.Vector3(dWHalf, 0.01, 0.01)
        );
      }

      const wallLineGeo = new THREE.BufferGeometry().setFromPoints(wallFacePoints);
      const wallLineMesh = new THREE.LineSegments(wallLineGeo, this.cornerLineMaterial);
      wallLineMesh.renderOrder = 9999;
      wallGroup.add(wallLineMesh);

      if (!hasDoor) {
        const wallGeo = new THREE.PlaneGeometry(roomSize, height);
        this.setSegmentUVs(wallGeo, 0, 1, 0, 1);
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
        const badgeMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), badgeMat);
        badgeMesh.position.set(0, height / 2, 0.03);
        wallGroup.add(badgeMesh);
      } else {
        // Solid 3D Wall Blocks for Left, Right, and Top sections (100% solid wall volume)
        const leftBlock = new THREE.Mesh(new THREE.BoxGeometry(sideWidth, height, wallThickness), this.wallMaterial);
        leftBlock.position.set(-(doorWidth / 2 + sideWidth / 2), height / 2, -wallThickness / 2);

        const rightBlock = new THREE.Mesh(new THREE.BoxGeometry(sideWidth, height, wallThickness), this.wallMaterial);
        rightBlock.position.set(doorWidth / 2 + sideWidth / 2, height / 2, -wallThickness / 2);

        const topBlock = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, topHeight, wallThickness), this.wallMaterial);
        topBlock.position.set(0, doorHeight + topHeight / 2, -wallThickness / 2);

        wallGroup.add(leftBlock, rightBlock, topBlock);

        wallGroup.add(leftBlock, rightBlock, topBlock);
      }

      if (hasDoor) {
        // Complete adjoining room preview space behind open door (Extends 2 rooms for skip!)
        const previewGroup = new THREE.Group();
        const offsetZ = wallThickness;
        const depthMultiplier = isSkipPassage ? 2 : 1;
        const previewDepth = roomSize * depthMultiplier;
        const pCenterZ = -previewDepth / 2 - offsetZ;

        const prevFloor = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, previewDepth), this.floorMaterial);
        prevFloor.rotation.x = -Math.PI / 2;
        prevFloor.position.set(0, 0, pCenterZ);

        const prevCeilingGeo = new THREE.PlaneGeometry(roomSize, previewDepth);
        const prevCeiling = new THREE.Mesh(prevCeilingGeo, this.ceilingMaterial);
        prevCeiling.rotation.x = Math.PI / 2;
        prevCeiling.position.y = height;
        prevCeiling.position.set(0, height, pCenterZ);

        const prevBackWallGeo = new THREE.PlaneGeometry(roomSize, height);
        this.setSegmentUVs(prevBackWallGeo, 0, 1, 0, 1);
        const prevBackWall = new THREE.Mesh(prevBackWallGeo, this.wallMaterial);
        prevBackWall.position.set(0, height / 2, -previewDepth - offsetZ);

        const prevLeftWallGeo = new THREE.PlaneGeometry(previewDepth, height);
        this.setSegmentUVs(prevLeftWallGeo, 0, depthMultiplier, 0, 1);
        const prevLeftWall = new THREE.Mesh(prevLeftWallGeo, this.wallMaterial);
        prevLeftWall.rotation.y = Math.PI / 2;
        prevLeftWall.position.set(-roomSize / 2, height / 2, pCenterZ);

        const prevRightWallGeo = new THREE.PlaneGeometry(previewDepth, height);
        this.setSegmentUVs(prevRightWallGeo, 0, depthMultiplier, 0, 1);
        const prevRightWall = new THREE.Mesh(prevRightWallGeo, this.wallMaterial);
        prevRightWall.rotation.y = -Math.PI / 2;
        prevRightWall.position.set(roomSize / 2, height / 2, pCenterZ);

        // Front divider wall facing back into the preview room so looking backward shows a clean wall
        const prevFrontLeftGeo = new THREE.PlaneGeometry(sideWidth, height);
        this.setSegmentUVs(prevFrontLeftGeo, 0, sideWidth / roomSize, 0, 1);
        const prevFrontLeft = new THREE.Mesh(prevFrontLeftGeo, this.wallMaterial);
        prevFrontLeft.rotation.y = Math.PI;
        prevFrontLeft.position.set(-(doorWidth / 2 + sideWidth / 2), height / 2, -offsetZ);

        const prevFrontRightGeo = new THREE.PlaneGeometry(sideWidth, height);
        this.setSegmentUVs(prevFrontRightGeo, 1 - sideWidth / roomSize, 1, 0, 1);
        const prevFrontRight = new THREE.Mesh(prevFrontRightGeo, this.wallMaterial);
        prevFrontRight.rotation.y = Math.PI;
        prevFrontRight.position.set(doorWidth / 2 + sideWidth / 2, height / 2, -offsetZ);

        const prevFrontTopGeo = new THREE.PlaneGeometry(doorWidth, topHeight);
        this.setSegmentUVs(prevFrontTopGeo, sideWidth / roomSize, 1 - sideWidth / roomSize, doorHeight / height, 1);
        const prevFrontTop = new THREE.Mesh(prevFrontTopGeo, this.wallMaterial);
        prevFrontTop.rotation.y = Math.PI;
        prevFrontTop.position.set(0, doorHeight + topHeight / 2, -offsetZ);

        // Clean 3D vector lines for both middle skipped room and final destination room
        const pHalfR = roomSize / 2 - 0.01;
        const z0 = -offsetZ; // -0.2m
        const z1 = -roomSize - offsetZ; // -10.2m (End of Middle Room / Start of Destination Room)
        const z2 = isSkipPassage ? -roomSize * 2 - offsetZ : z1; // -20.2m if skip, -10.2m if normal

        const prevLinePoints: THREE.Vector3[] = [];

        const addRoomBoxLines = (zStart: number, zEnd: number) => {
          // Floor perimeter
          prevLinePoints.push(
            new THREE.Vector3(-pHalfR, 0.01, zStart), new THREE.Vector3(pHalfR, 0.01, zStart),
            new THREE.Vector3(pHalfR, 0.01, zStart), new THREE.Vector3(pHalfR, 0.01, zEnd),
            new THREE.Vector3(pHalfR, 0.01, zEnd), new THREE.Vector3(-pHalfR, 0.01, zEnd),
            new THREE.Vector3(-pHalfR, 0.01, zEnd), new THREE.Vector3(-pHalfR, 0.01, zStart)
          );

          // Ceiling perimeter
          prevLinePoints.push(
            new THREE.Vector3(-pHalfR, height - 0.01, zStart), new THREE.Vector3(pHalfR, height - 0.01, zStart),
            new THREE.Vector3(pHalfR, height - 0.01, zStart), new THREE.Vector3(pHalfR, height - 0.01, zEnd),
            new THREE.Vector3(pHalfR, height - 0.01, zEnd), new THREE.Vector3(-pHalfR, height - 0.01, zEnd),
            new THREE.Vector3(-pHalfR, height - 0.01, zEnd), new THREE.Vector3(-pHalfR, height - 0.01, zStart)
          );

          // 4 Vertical Corner Pillars
          prevLinePoints.push(
            new THREE.Vector3(-pHalfR, 0.01, zStart), new THREE.Vector3(-pHalfR, height - 0.01, zStart),
            new THREE.Vector3(pHalfR, 0.01, zStart), new THREE.Vector3(pHalfR, height - 0.01, zStart),
            new THREE.Vector3(-pHalfR, 0.01, zEnd), new THREE.Vector3(-pHalfR, height - 0.01, zEnd),
            new THREE.Vector3(pHalfR, 0.01, zEnd), new THREE.Vector3(pHalfR, height - 0.01, zEnd)
          );
        };

        // Room 1 (Middle Skipped Room: z0 -> z1)
        addRoomBoxLines(z0, z1);

        // Room 2 (Final Destination Room: z1 -> z2) if skip card used
        if (isSkipPassage) {
          addRoomBoxLines(z1, z2);

          // Middle doorway opening frame lines at divider wall z1
          const dWHalf = doorWidth / 2;
          prevLinePoints.push(
            new THREE.Vector3(-dWHalf, 0.01, z1), new THREE.Vector3(-dWHalf, doorHeight, z1),
            new THREE.Vector3(-dWHalf, doorHeight, z1), new THREE.Vector3(dWHalf, doorHeight, z1),
            new THREE.Vector3(dWHalf, doorHeight, z1), new THREE.Vector3(dWHalf, 0.01, z1)
          );
        }

        const prevLineGeo = new THREE.BufferGeometry().setFromPoints(prevLinePoints);
        const prevLineMesh = new THREE.LineSegments(prevLineGeo, this.cornerLineMaterial);
        prevLineMesh.renderOrder = 9999;

        previewGroup.add(
          prevFloor, prevCeiling, prevBackWall, prevLeftWall, prevRightWall,
          prevFrontLeft, prevFrontRight, prevFrontTop,
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

          // Crisp 2nd Door Outline Lines
          const midDoorOutlinePoints: THREE.Vector3[] = [
            new THREE.Vector3(-doorWidth / 2, 0.01, midZ + 0.01), new THREE.Vector3(-doorWidth / 2, doorHeight, midZ + 0.01),
            new THREE.Vector3(doorWidth / 2, 0.01, midZ + 0.01), new THREE.Vector3(doorWidth / 2, doorHeight, midZ + 0.01),
            new THREE.Vector3(-doorWidth / 2, doorHeight, midZ + 0.01), new THREE.Vector3(doorWidth / 2, doorHeight, midZ + 0.01),

            new THREE.Vector3(-doorWidth / 2, 0.01, midZ), new THREE.Vector3(-doorWidth / 2, 0.01, midZ - wallThickness),
            new THREE.Vector3(doorWidth / 2, 0.01, midZ), new THREE.Vector3(doorWidth / 2, 0.01, midZ - wallThickness),
            new THREE.Vector3(-doorWidth / 2, doorHeight, midZ), new THREE.Vector3(-doorWidth / 2, doorHeight, midZ - wallThickness),
            new THREE.Vector3(doorWidth / 2, doorHeight, midZ), new THREE.Vector3(doorWidth / 2, doorHeight, midZ - wallThickness),

            new THREE.Vector3(-doorWidth / 2, 0.01, midZ - wallThickness - 0.01), new THREE.Vector3(-doorWidth / 2, doorHeight, midZ - wallThickness - 0.01),
            new THREE.Vector3(doorWidth / 2, 0.01, midZ - wallThickness - 0.01), new THREE.Vector3(doorWidth / 2, 0.01, midZ - wallThickness - 0.01),
            new THREE.Vector3(-doorWidth / 2, doorHeight, midZ - wallThickness - 0.01), new THREE.Vector3(doorWidth / 2, doorHeight, midZ - wallThickness - 0.01),
          ];

          const midDoorLineGeo = new THREE.BufferGeometry().setFromPoints(midDoorOutlinePoints);
          const midDoorLineMesh = new THREE.LineSegments(midDoorLineGeo, this.cornerLineMaterial);

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
            midDoorLineMesh,
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
    buildWallWithFullRoomView(new THREE.Vector3(0, 0, -roomSize / 2), 0, hasNorth || hasNorthPassage, isSkip && hasNorth, northCell, northDoorData?.cost || 10, 1, northDoorData?.specialType);
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
    buildWallWithFullRoomView(new THREE.Vector3(roomSize / 2, 0, 0), -Math.PI / 2, hasEast || hasEastPassage, isSkip && hasEast, eastCell, eastDoorData?.cost || 10, 2, eastDoorData?.specialType);
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
    buildWallWithFullRoomView(new THREE.Vector3(0, 0, roomSize / 2), Math.PI, hasSouth || hasSouthPassage, isSkip && hasSouth, southCell, southDoorData?.cost || 10, 3, southDoorData?.specialType);
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
    buildWallWithFullRoomView(new THREE.Vector3(-roomSize / 2, 0, 0), Math.PI / 2, hasWest || hasWestPassage, isSkip && hasWest, westCell, westDoorData?.cost || 10, 4, westDoorData?.specialType);
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
