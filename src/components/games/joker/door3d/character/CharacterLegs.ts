import * as THREE from 'three';
import { CharacterMaterials } from './CharacterMaterials';

/**
 * Creates or extracts the 3D Leg modules with trousers, knee caps, and dark boots
 */
export class CharacterLegs {
    public leftLegGroup: THREE.Group;
    public rightLegGroup: THREE.Group;

    constructor(glbLeftLegMeshes?: THREE.Object3D[], glbRightLegMeshes?: THREE.Object3D[]) {
        this.leftLegGroup = new THREE.Group();
        this.leftLegGroup.name = 'ModularLeftLegGroup';

        this.rightLegGroup = new THREE.Group();
        this.rightLegGroup.name = 'ModularRightLegGroup';

        if (glbLeftLegMeshes && glbLeftLegMeshes.length > 0) {
            glbLeftLegMeshes.forEach(m => this.leftLegGroup.add(m.clone()));
        } else {
            this.buildStylizedLeg(this.leftLegGroup, 1);
        }

        if (glbRightLegMeshes && glbRightLegMeshes.length > 0) {
            glbRightLegMeshes.forEach(m => this.rightLegGroup.add(m.clone()));
        } else {
            this.buildStylizedLeg(this.rightLegGroup, -1);
        }
    }

    private buildStylizedLeg(group: THREE.Group, sideMultiplier: number) {
        // Thigh / Upper Leg
        const thighGeo = new THREE.CylinderGeometry(0.09, 0.075, 0.40, 12);
        const thighMesh = new THREE.Mesh(thighGeo, CharacterMaterials.purpleSuit);
        thighMesh.position.set(sideMultiplier * 0.12, -0.20, 0);
        thighMesh.castShadow = true;
        group.add(thighMesh);

        // Knee Cap Joint
        const kneeGeo = new THREE.SphereGeometry(0.07, 12, 12);
        const kneeMesh = new THREE.Mesh(kneeGeo, CharacterMaterials.purpleSuit);
        kneeMesh.position.set(sideMultiplier * 0.12, -0.42, 0.01);
        kneeMesh.castShadow = true;
        group.add(kneeMesh);

        // Shin / Lower Leg
        const shinGeo = new THREE.CylinderGeometry(0.07, 0.055, 0.40, 12);
        const shinMesh = new THREE.Mesh(shinGeo, CharacterMaterials.purpleSuit);
        shinMesh.position.set(sideMultiplier * 0.12, -0.64, 0);
        shinMesh.castShadow = true;
        group.add(shinMesh);

        // Leather Shoe / Boot
        const bootGeo = new THREE.BoxGeometry(0.12, 0.10, 0.24);
        const bootMesh = new THREE.Mesh(bootGeo, CharacterMaterials.darkBoots);
        bootMesh.position.set(sideMultiplier * 0.12, -0.85, 0.05);
        bootMesh.castShadow = true;
        group.add(bootMesh);
    }
}
