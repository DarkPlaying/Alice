import * as THREE from 'three';
import { CellData, MazeMapData } from './MazeMapData';
import { DoorSystem } from './DoorSystem';
import { TextureConfig } from '../config/TextureConfig';
import { TextureGenerator } from '../textures/TextureGenerator';

export class DungeonHallway {
  private scene: THREE.Scene;
  private roomGroup: THREE.Group;

  // Cached materials driven by TextureConfig color and image variables
  private wallMaterial: THREE.MeshStandardMaterial;
  private floorMaterial: THREE.MeshStandardMaterial;
  private ceilingMaterial: THREE.MeshStandardMaterial;
  private pillarMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);

    // Roughness 1.0 & Metalness 0.0 eliminates all specular light reflections & glare spots
    this.wallMaterial = new THREE.MeshStandardMaterial({
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });

    this.ceilingMaterial = new THREE.MeshStandardMaterial({
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide
    });

    this.floorMaterial = new THREE.MeshStandardMaterial({
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });

    this.pillarMat = new THREE.MeshStandardMaterial({
      metalness: 0.0,
      roughness: 1.0,
      side: THREE.DoubleSide
    });

    this.updateMaterialsFromConfig();
  }

  private parseColor(colorStr: string): THREE.Color {
    if (!colorStr) return new THREE.Color(0xffffff);
    let cleanStr = colorStr.trim();
    if (cleanStr.startsWith('#') && cleanStr.length === 9) {
      cleanStr = cleanStr.substring(0, 7);
    }
    try {
      return new THREE.Color(cleanStr);
    } catch {
      return new THREE.Color(0xffffff);
    }
  }

  /**
   * Reads latest TextureConfig and updates all materials dynamically with instant fallback.
   */
  public updateMaterialsFromConfig() {
    const textureLoader = new THREE.TextureLoader();

    // --- WALL MATERIAL ---
    if (TextureConfig.USE_WALL_IMAGE && TextureConfig.WALL_IMAGE) {
      const wallMap = textureLoader.load(
        TextureConfig.WALL_IMAGE,
        (tex) => {
          tex.needsUpdate = true;
          this.wallMaterial.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn(`[TextureLoader] Wall image fallback "${TextureConfig.WALL_IMAGE}":`, err);
          const fallback = TextureGenerator.createSilverWallTexture();
          this.wallMaterial.map = fallback.map;
          this.wallMaterial.color.set(0xffffff);
          this.wallMaterial.needsUpdate = true;
        }
      );
      wallMap.wrapS = THREE.ClampToEdgeWrapping;
      wallMap.wrapT = THREE.ClampToEdgeWrapping;
      wallMap.repeat.set(1, 1);
      this.wallMaterial.map = wallMap;
      this.wallMaterial.color.set(0xffffff);
    } else {
      this.wallMaterial.map = null;
      this.wallMaterial.color = this.parseColor(TextureConfig.WALL_COLOR);
    }
    this.wallMaterial.needsUpdate = true;

    // --- CEILING MATERIAL ---
    if (TextureConfig.USE_CEILING_IMAGE && TextureConfig.CEILING_IMAGE) {
      const ceilingMap = textureLoader.load(
        TextureConfig.CEILING_IMAGE,
        (tex) => {
          tex.needsUpdate = true;
          this.ceilingMaterial.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn(`[TextureLoader] Ceiling image fallback "${TextureConfig.CEILING_IMAGE}":`, err);
          const fallback = TextureGenerator.createSilverWallTexture();
          this.ceilingMaterial.map = fallback.map;
          this.ceilingMaterial.color.set(0xffffff);
          this.ceilingMaterial.needsUpdate = true;
        }
      );
      ceilingMap.wrapS = THREE.ClampToEdgeWrapping;
      ceilingMap.wrapT = THREE.ClampToEdgeWrapping;
      ceilingMap.repeat.set(1, 1);
      this.ceilingMaterial.map = ceilingMap;
      this.ceilingMaterial.color.set(0xffffff);
    } else {
      this.ceilingMaterial.map = null;
      this.ceilingMaterial.color = this.parseColor(TextureConfig.CEILING_COLOR);
    }
    this.ceilingMaterial.needsUpdate = true;

    // --- FLOOR MATERIAL ---
    if (TextureConfig.USE_FLOOR_IMAGE && TextureConfig.FLOOR_IMAGE) {
      const floorMap = textureLoader.load(
        TextureConfig.FLOOR_IMAGE,
        (tex) => {
          tex.needsUpdate = true;
          this.floorMaterial.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn(`[TextureLoader] Floor image fallback "${TextureConfig.FLOOR_IMAGE}":`, err);
          this.floorMaterial.map = null;
          this.floorMaterial.color = this.parseColor(TextureConfig.FLOOR_COLOR);
          this.floorMaterial.needsUpdate = true;
        }
      );
      floorMap.wrapS = THREE.ClampToEdgeWrapping;
      floorMap.wrapT = THREE.ClampToEdgeWrapping;
      floorMap.repeat.set(1, 1);
      this.floorMaterial.map = floorMap;
      this.floorMaterial.color.set(0xffffff);
    } else {
      this.floorMaterial.map = null;
      this.floorMaterial.color = this.parseColor(TextureConfig.FLOOR_COLOR);
    }
    this.floorMaterial.needsUpdate = true;

    // --- PILLAR MATERIAL ---
    this.pillarMat.color = this.parseColor(TextureConfig.PILLAR_COLOR);
    this.pillarMat.needsUpdate = true;
  }

  private setSegmentUVs(geo: THREE.PlaneGeometry, uMin: number, uMax: number, vMin: number, vMax: number) {
    const uvAttr = geo.attributes.uv;
    uvAttr.setXY(0, uMin, vMax); // top-left
    uvAttr.setXY(1, uMax, vMax); // top-right
    uvAttr.setXY(2, uMin, vMin); // bottom-left
    uvAttr.setXY(3, uMax, vMin); // bottom-right
    uvAttr.needsUpdate = true;
  }

  public rebuildRoomForCell(cell: CellData, doorSystem: DoorSystem) {
    this.updateMaterialsFromConfig();

    while (this.roomGroup.children.length > 0) {
      const obj = this.roomGroup.children[0];
      this.roomGroup.remove(obj);
    }
    doorSystem.clearDoors();

    // 3D Room Dimensions driven by Pixel Specifications
    const roomSize = 16.0;
    const wallAspect = (TextureConfig.WALL_PIXEL_HEIGHT || 628) / (TextureConfig.WALL_PIXEL_WIDTH || 1120);
    const height = Math.max(3.5, Math.min(roomSize * wallAspect, 8.0));
    const wallThick = 0.16;

    // Floor
    const floorGeo = new THREE.PlaneGeometry(roomSize, roomSize);
    const floor = new THREE.Mesh(floorGeo, this.floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    this.roomGroup.add(floor);

    // Ceiling
    const ceilingGeo = new THREE.PlaneGeometry(roomSize, roomSize);
    const ceiling = new THREE.Mesh(ceilingGeo, this.ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, height, 0);
    this.roomGroup.add(ceiling);

    // Door Dimensions
    const doorAspect = (TextureConfig.DOOR_PIXEL_HEIGHT || 2516) / (TextureConfig.DOOR_PIXEL_WIDTH || 1696);
    const doorWidth = 2.8;
    const doorHeight = Math.min(doorWidth * doorAspect, height - 0.4);

    const doorOffsetPos = roomSize / 2 - 0.05;

    const buildWallWithFullRoomView = (
      pos: THREE.Vector3,
      rotY: number,
      hasDoor: boolean,
      dir: 'north' | 'south' | 'east' | 'west',
      targetCell: CellData | null
    ) => {
      const wallGroup = new THREE.Group();
      wallGroup.position.copy(pos);
      wallGroup.rotation.y = rotY;

      if (!hasDoor) {
        // Solid Wall
        const solidWallGeo = new THREE.PlaneGeometry(roomSize, height);
        this.setSegmentUVs(solidWallGeo, 0, 1, 0, 1);
        const solidWall = new THREE.Mesh(solidWallGeo, this.wallMaterial);
        solidWall.position.set(0, height / 2, 0);
        wallGroup.add(solidWall);
      } else {
        // Wall with door cutout
        const sideW = (roomSize - doorWidth) / 2;
        const uDoorStart = sideW / roomSize;
        const uDoorEnd = (sideW + doorWidth) / roomSize;
        const vDoorTop = doorHeight / height;

        // Left wall segment
        const leftGeo = new THREE.PlaneGeometry(sideW, height);
        this.setSegmentUVs(leftGeo, 0.0, uDoorStart, 0.0, 1.0);
        const leftSeg = new THREE.Mesh(leftGeo, this.wallMaterial);
        leftSeg.position.set(-sideW / 2 - doorWidth / 2, height / 2, 0);

        // Right wall segment
        const rightGeo = new THREE.PlaneGeometry(sideW, height);
        this.setSegmentUVs(rightGeo, uDoorEnd, 1.0, 0.0, 1.0);
        const rightSeg = new THREE.Mesh(rightGeo, this.wallMaterial);
        rightSeg.position.set(sideW / 2 + doorWidth / 2, height / 2, 0);

        // Top wall segment above door height
        const topH = height - doorHeight;
        const topGeo = new THREE.PlaneGeometry(doorWidth, topH);
        this.setSegmentUVs(topGeo, uDoorStart, uDoorEnd, vDoorTop, 1.0);
        const topSeg = new THREE.Mesh(topGeo, this.wallMaterial);
        topSeg.position.set(0, doorHeight + topH / 2, 0);

        wallGroup.add(leftSeg, rightSeg, topSeg);

        // --- DOORWAY OPENING BORDER LINES ---
        if (TextureConfig.ENABLE_BORDER_LINES) {
          const borderMat = new THREE.MeshBasicMaterial({
            color: this.parseColor(TextureConfig.BORDER_LINE_COLOR || '#475569'),
            transparent: true,
            opacity: TextureConfig.BORDER_LINE_OPACITY ?? 0.5
          });
          const thick = TextureConfig.BORDER_LINE_THICKNESS || 0.04;

          const jambL = new THREE.Mesh(new THREE.BoxGeometry(thick, doorHeight, thick), borderMat);
          jambL.position.set(-doorWidth / 2, doorHeight / 2, 0);

          const jambR = new THREE.Mesh(new THREE.BoxGeometry(thick, doorHeight, thick), borderMat);
          jambR.position.set(doorWidth / 2, doorHeight / 2, 0);

          const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, thick, thick), borderMat);
          lintel.position.set(0, doorHeight, 0);

          wallGroup.add(jambL, jambR, lintel);
        }

        // --- FULL ADJACENT ROOM PREVIEW ---
        const previewGroup = new THREE.Group();
        const offsetZ = wallThick / 2;
        const pCenterZ = -roomSize / 2 - offsetZ;

        // Floor Slab
        const prevFloor = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomSize), this.floorMaterial);
        prevFloor.rotation.x = -Math.PI / 2;
        prevFloor.position.set(0, 0, pCenterZ);

        // Ceiling Slab
        const prevCeilingGeo = new THREE.PlaneGeometry(roomSize, roomSize);
        const prevCeiling = new THREE.Mesh(prevCeilingGeo, this.ceilingMaterial);
        prevCeiling.rotation.x = Math.PI / 2;
        prevCeiling.position.set(0, height, pCenterZ);

        // Far Back Wall
        const prevBackWallGeo = new THREE.PlaneGeometry(roomSize, height);
        this.setSegmentUVs(prevBackWallGeo, 0, 1, 0, 1);
        const prevBackWall = new THREE.Mesh(prevBackWallGeo, this.wallMaterial);
        prevBackWall.position.set(0, height / 2, -roomSize - offsetZ);

        // Left Side Wall
        const prevLeftWallGeo = new THREE.PlaneGeometry(roomSize, height);
        this.setSegmentUVs(prevLeftWallGeo, 0, 1, 0, 1);
        const prevLeftWall = new THREE.Mesh(prevLeftWallGeo, this.wallMaterial);
        prevLeftWall.rotation.y = Math.PI / 2;
        prevLeftWall.position.set(-roomSize / 2, height / 2, pCenterZ);

        // Right Side Wall
        const prevRightWallGeo = new THREE.PlaneGeometry(roomSize, height);
        this.setSegmentUVs(prevRightWallGeo, 0, 1, 0, 1);
        const prevRightWall = new THREE.Mesh(prevRightWallGeo, this.wallMaterial);
        prevRightWall.rotation.y = -Math.PI / 2;
        prevRightWall.position.set(roomSize / 2, height / 2, pCenterZ);

        previewGroup.add(prevFloor, prevCeiling, prevBackWall, prevLeftWall, prevRightWall);

        // --- ADJACENT ROOM BORDER LINES ---
        if (TextureConfig.ENABLE_BORDER_LINES) {
          const borderMat = new THREE.MeshBasicMaterial({
            color: this.parseColor(TextureConfig.BORDER_LINE_COLOR || '#475569'),
            transparent: true,
            opacity: TextureConfig.BORDER_LINE_OPACITY ?? 0.5
          });

          const thick = TextureConfig.BORDER_LINE_THICKNESS || 0.04;
          const pRHalf = roomSize / 2;
          const zFar = -roomSize - offsetZ;
          const zNear = -offsetZ;

          // Top Ceiling Perimeter Bars in Preview Room
          const pTopBack = new THREE.Mesh(new THREE.BoxGeometry(roomSize, thick, thick), borderMat);
          pTopBack.position.set(0, height - thick / 2, zFar + thick / 2);

          const pTopFront = new THREE.Mesh(new THREE.BoxGeometry(roomSize, thick, thick), borderMat);
          pTopFront.position.set(0, height - thick / 2, zNear - thick / 2);

          const pTopLeft = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, roomSize), borderMat);
          pTopLeft.position.set(-pRHalf + thick / 2, height - thick / 2, pCenterZ);

          const pTopRight = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, roomSize), borderMat);
          pTopRight.position.set(pRHalf - thick / 2, height - thick / 2, pCenterZ);

          // Bottom Floor Perimeter Bars in Preview Room
          const pBotBack = new THREE.Mesh(new THREE.BoxGeometry(roomSize, thick, thick), borderMat);
          pBotBack.position.set(0, thick / 2, zFar + thick / 2);

          const pBotFront = new THREE.Mesh(new THREE.BoxGeometry(roomSize, thick, thick), borderMat);
          pBotFront.position.set(0, thick / 2, zNear - thick / 2);

          const pBotLeft = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, roomSize), borderMat);
          pBotLeft.position.set(-pRHalf + thick / 2, thick / 2, pCenterZ);

          const pBotRight = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, roomSize), borderMat);
          pBotRight.position.set(pRHalf - thick / 2, thick / 2, pCenterZ);

          // 4 Vertical Corner Bars in Preview Room
          const pC1 = new THREE.Mesh(new THREE.BoxGeometry(thick, height, thick), borderMat);
          pC1.position.set(-pRHalf + thick / 2, height / 2, zFar + thick / 2);

          const pC2 = new THREE.Mesh(new THREE.BoxGeometry(thick, height, thick), borderMat);
          pC2.position.set(pRHalf - thick / 2, height / 2, zFar + thick / 2);

          const pC3 = new THREE.Mesh(new THREE.BoxGeometry(thick, height, thick), borderMat);
          pC3.position.set(pRHalf - thick / 2, height / 2, zNear - thick / 2);

          const pC4 = new THREE.Mesh(new THREE.BoxGeometry(thick, height, thick), borderMat);
          pC4.position.set(-pRHalf + thick / 2, height / 2, zNear - thick / 2);

          previewGroup.add(pTopBack, pTopFront, pTopLeft, pTopRight, pBotBack, pBotFront, pBotLeft, pBotRight, pC1, pC2, pC3, pC4);
        }

        wallGroup.add(previewGroup);
      }

      this.roomGroup.add(wallGroup);
    };

    // North Wall (Z = -roomSize/2)
    const northTarget = MazeMapData.getTargetRoom(cell.x, cell.y, 'north');
    const northCell = northTarget ? MazeMapData.getCell(northTarget.x, northTarget.y) : null;
    buildWallWithFullRoomView(new THREE.Vector3(0, 0, -roomSize / 2), 0, cell.northDoor, 'north', northCell);
    if (cell.northDoor) {
      doorSystem.createDoor(
        1, 'north', northTarget,
        `North Door [Room ${northCell?.label || ''}]`,
        `Walk through to enter room (${northTarget?.x}, ${northTarget?.y}).`,
        new THREE.Vector3(0, 0, -doorOffsetPos), 0, 'crystal'
      );
    }

    // East Wall (X = +roomSize/2)
    const eastTarget = MazeMapData.getTargetRoom(cell.x, cell.y, 'east');
    const eastCell = eastTarget ? MazeMapData.getCell(eastTarget.x, eastTarget.y) : null;
    buildWallWithFullRoomView(new THREE.Vector3(roomSize / 2, 0, 0), -Math.PI / 2, cell.eastDoor, 'east', eastCell);
    if (cell.eastDoor) {
      doorSystem.createDoor(
        2, 'east', eastTarget,
        `East Door [Room ${eastCell?.label || ''}]`,
        `Walk through to enter room (${eastTarget?.x}, ${eastTarget?.y}).`,
        new THREE.Vector3(doorOffsetPos, 0, 0), -Math.PI / 2, 'celestial'
      );
    }

    // South Wall (Z = +roomSize/2)
    const southTarget = MazeMapData.getTargetRoom(cell.x, cell.y, 'south');
    const southCell = southTarget ? MazeMapData.getCell(southTarget.x, southTarget.y) : null;
    buildWallWithFullRoomView(new THREE.Vector3(0, 0, roomSize / 2), Math.PI, cell.southDoor, 'south', southCell);
    if (cell.southDoor) {
      doorSystem.createDoor(
        3, 'south', southTarget,
        `South Door [Room ${southCell?.label || ''}]`,
        `Walk through to enter room (${southTarget?.x}, ${southTarget?.y}).`,
        new THREE.Vector3(0, 0, doorOffsetPos), Math.PI, 'gold'
      );
    }

    // West Wall (X = -roomSize/2)
    const westTarget = MazeMapData.getTargetRoom(cell.x, cell.y, 'west');
    const westCell = westTarget ? MazeMapData.getCell(westTarget.x, westTarget.y) : null;
    buildWallWithFullRoomView(new THREE.Vector3(-roomSize / 2, 0, 0), Math.PI / 2, cell.westDoor, 'west', westCell);
    if (cell.westDoor) {
      doorSystem.createDoor(
        4, 'west', westTarget,
        `West Door [Room ${westCell?.label || ''}]`,
        `Walk through to enter room (${westTarget?.x}, ${westTarget?.y}).`,
        new THREE.Vector3(-doorOffsetPos, 0, 0), Math.PI / 2, 'nature'
      );
    }

    // --- MAIN ROOM ARCHITECTURAL 3D BORDER LINE BARS ---
    if (TextureConfig.ENABLE_BORDER_LINES) {
      const borderMat = new THREE.MeshBasicMaterial({
        color: this.parseColor(TextureConfig.BORDER_LINE_COLOR || '#475569'),
        transparent: true,
        opacity: TextureConfig.BORDER_LINE_OPACITY ?? 0.5
      });

      const thick = TextureConfig.BORDER_LINE_THICKNESS || 0.04;
      const borderGroup = new THREE.Group();
      const rHalf = roomSize / 2;

      // 4 Top Ceiling Perimeter Bars
      const topN = new THREE.Mesh(new THREE.BoxGeometry(roomSize, thick, thick), borderMat);
      topN.position.set(0, height - thick / 2, -rHalf + thick / 2);

      const topS = new THREE.Mesh(new THREE.BoxGeometry(roomSize, thick, thick), borderMat);
      topS.position.set(0, height - thick / 2, rHalf - thick / 2);

      const topE = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, roomSize), borderMat);
      topE.position.set(rHalf - thick / 2, height - thick / 2, 0);

      const topW = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, roomSize), borderMat);
      topW.position.set(-rHalf + thick / 2, height - thick / 2, 0);

      // 4 Bottom Floor Perimeter Bars
      const botN = new THREE.Mesh(new THREE.BoxGeometry(roomSize, thick, thick), borderMat);
      botN.position.set(0, thick / 2, -rHalf + thick / 2);

      const botS = new THREE.Mesh(new THREE.BoxGeometry(roomSize, thick, thick), borderMat);
      botS.position.set(0, thick / 2, rHalf - thick / 2);

      const botE = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, roomSize), borderMat);
      botE.position.set(rHalf - thick / 2, thick / 2, 0);

      const botW = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, roomSize), borderMat);
      botW.position.set(-rHalf + thick / 2, thick / 2, 0);

      // 4 Vertical Corner Bars
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(thick, height, thick), borderMat);
      c1.position.set(-rHalf + thick / 2, height / 2, -rHalf + thick / 2);

      const c2 = new THREE.Mesh(new THREE.BoxGeometry(thick, height, thick), borderMat);
      c2.position.set(rHalf - thick / 2, height / 2, -rHalf + thick / 2);

      const c3 = new THREE.Mesh(new THREE.BoxGeometry(thick, height, thick), borderMat);
      c3.position.set(rHalf - thick / 2, height / 2, rHalf - thick / 2);

      const c4 = new THREE.Mesh(new THREE.BoxGeometry(thick, height, thick), borderMat);
      c4.position.set(-rHalf + thick / 2, height / 2, rHalf - thick / 2);

      borderGroup.add(topN, topS, topE, topW, botN, botS, botE, botW, c1, c2, c3, c4);
      this.roomGroup.add(borderGroup);
    }

    // 4 Corner Pillars
    if (TextureConfig.SHOW_CORNER_PILLARS) {
      const pillarGeo = new THREE.BoxGeometry(0.48, height, 0.48);
      [
        { x: -roomSize / 2 + 0.24, z: -roomSize / 2 + 0.24 },
        { x: roomSize / 2 - 0.24, z: -roomSize / 2 + 0.24 },
        { x: -roomSize / 2 + 0.24, z: roomSize / 2 - 0.24 },
        { x: roomSize / 2 - 0.24, z: roomSize / 2 - 0.24 }
      ].forEach((pos) => {
        const p = new THREE.Mesh(pillarGeo, this.pillarMat);
        p.position.set(pos.x, height / 2, pos.z);
        this.roomGroup.add(p);
      });
    }
  }

  public update(_time: number) {
    // Environment update
  }
}
