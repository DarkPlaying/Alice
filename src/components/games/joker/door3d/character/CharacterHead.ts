import * as THREE from 'three';
import { CharacterMaterials } from './CharacterMaterials';

/**
 * Creates or extracts the 3D Head module with pale skin, green hair, and black dot eyes
 */
export class CharacterHead {
    public group: THREE.Group;

    constructor(glbHeadMeshes?: THREE.Object3D[]) {
        this.group = new THREE.Group();
        this.group.name = 'ModularCharacterHead';

        if (glbHeadMeshes && glbHeadMeshes.length > 0) {
            // Attach extracted GLB head meshes directly
            glbHeadMeshes.forEach(mesh => this.group.add(mesh.clone()));
        } else {
            // Build stylized Arkham Joker head geometry
            const headGeo = new THREE.SphereGeometry(0.18, 24, 24);
            headGeo.scale(1, 1.25, 1);
            const headMesh = new THREE.Mesh(headGeo, CharacterMaterials.paleSkin);
            headMesh.castShadow = true;
            this.group.add(headMesh);

            // Green Hair Crest
            const hairGeo = new THREE.ConeGeometry(0.22, 0.28, 16);
            hairGeo.rotateX(0.2);
            const hairMesh = new THREE.Mesh(hairGeo, CharacterMaterials.greenHair);
            hairMesh.position.set(0, 0.16, -0.02);
            hairMesh.castShadow = true;
            this.group.add(hairMesh);

            // Black Dot Eyes
            const eyeGeo = new THREE.SphereGeometry(0.025, 12, 12);
            const leftEye = new THREE.Mesh(eyeGeo, CharacterMaterials.blackEyeDot);
            leftEye.position.set(0.065, 0.04, 0.16);

            const rightEye = new THREE.Mesh(eyeGeo, CharacterMaterials.blackEyeDot);
            rightEye.position.set(-0.065, 0.04, 0.16);

            this.group.add(leftEye);
            this.group.add(rightEye);
        }
    }
}
