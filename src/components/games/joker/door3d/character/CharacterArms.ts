import * as THREE from 'three';
import { CharacterMaterials } from './CharacterMaterials';

export interface ArmGroupPair {
    leftArmGroup: THREE.Group;
    rightArmGroup: THREE.Group;
}

/**
 * Creates or extracts the 3D Arm modules with purple suit sleeves and articulated joints
 */
export class CharacterArms {
    public leftArmGroup: THREE.Group;
    public rightArmGroup: THREE.Group;

    constructor(glbLeftArmMeshes?: THREE.Object3D[], glbRightArmMeshes?: THREE.Object3D[]) {
        this.leftArmGroup = new THREE.Group();
        this.leftArmGroup.name = 'ModularLeftArmGroup';

        this.rightArmGroup = new THREE.Group();
        this.rightArmGroup.name = 'ModularRightArmGroup';

        if (glbLeftArmMeshes && glbLeftArmMeshes.length > 0) {
            glbLeftArmMeshes.forEach(m => this.leftArmGroup.add(m.clone()));
        } else {
            this.buildStylizedArm(this.leftArmGroup, 1);
        }

        if (glbRightArmMeshes && glbRightArmMeshes.length > 0) {
            glbRightArmMeshes.forEach(m => this.rightArmGroup.add(m.clone()));
        } else {
            this.buildStylizedArm(this.rightArmGroup, -1);
        }
    }

    private buildStylizedArm(group: THREE.Group, sideMultiplier: number) {
        // Shoulder Ball Joint
        const shoulderGeo = new THREE.SphereGeometry(0.08, 16, 16);
        const shoulderMesh = new THREE.Mesh(shoulderGeo, CharacterMaterials.purpleSuit);
        shoulderMesh.position.set(sideMultiplier * 0.28, 0.55, 0);
        shoulderMesh.castShadow = true;
        group.add(shoulderMesh);

        // Upper Arm Sleeve
        const upperArmGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.32, 12);
        const upperArmMesh = new THREE.Mesh(upperArmGeo, CharacterMaterials.purpleSuit);
        upperArmMesh.position.set(sideMultiplier * 0.32, 0.38, 0);
        upperArmMesh.castShadow = true;
        group.add(upperArmMesh);

        // Forearm / Gauntlet
        const forearmGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.30, 12);
        const forearmMesh = new THREE.Mesh(forearmGeo, CharacterMaterials.purpleSuit);
        forearmMesh.position.set(sideMultiplier * 0.35, 0.12, 0);
        forearmMesh.castShadow = true;
        group.add(forearmMesh);

        // Hand Glove
        const handGeo = new THREE.SphereGeometry(0.055, 12, 12);
        const handMesh = new THREE.Mesh(handGeo, CharacterMaterials.paleSkin);
        handMesh.position.set(sideMultiplier * 0.37, -0.06, 0);
        handMesh.castShadow = true;
        group.add(handMesh);
    }
}
