import * as THREE from 'three';
import { CharacterMaterials } from './CharacterMaterials';

/**
 * Creates or extracts the 3D Torso module with purple suit jacket, yellow vest, and shirt
 */
export class CharacterTorso {
    public group: THREE.Group;

    constructor(glbTorsoMeshes?: THREE.Object3D[]) {
        this.group = new THREE.Group();
        this.group.name = 'ModularCharacterTorso';

        if (glbTorsoMeshes && glbTorsoMeshes.length > 0) {
            // Attach extracted GLB torso meshes directly
            glbTorsoMeshes.forEach(mesh => this.group.add(mesh.clone()));
        } else {
            // Main Purple Jacket Body
            const chestGeo = new THREE.CylinderGeometry(0.24, 0.20, 0.65, 16);
            const chestMesh = new THREE.Mesh(chestGeo, CharacterMaterials.purpleSuit);
            chestMesh.position.y = 0.32;
            chestMesh.castShadow = true;
            this.group.add(chestMesh);

            // Yellow Vest Inset
            const vestGeo = new THREE.BoxGeometry(0.22, 0.40, 0.12);
            const vestMesh = new THREE.Mesh(vestGeo, CharacterMaterials.yellowVest);
            vestMesh.position.set(0, 0.32, 0.12);
            vestMesh.castShadow = true;
            this.group.add(vestMesh);

            // White Collar / Shirt
            const shirtGeo = new THREE.BoxGeometry(0.14, 0.15, 0.10);
            const shirtMesh = new THREE.Mesh(shirtGeo, CharacterMaterials.whiteShirt);
            shirtMesh.position.set(0, 0.52, 0.14);
            this.group.add(shirtMesh);

            // Red Tie Accent
            const tieGeo = new THREE.ConeGeometry(0.04, 0.22, 8);
            tieGeo.rotateX(Math.PI);
            const tieMesh = new THREE.Mesh(tieGeo, CharacterMaterials.redAccent);
            tieMesh.position.set(0, 0.42, 0.19);
            this.group.add(tieMesh);
        }
    }
}
