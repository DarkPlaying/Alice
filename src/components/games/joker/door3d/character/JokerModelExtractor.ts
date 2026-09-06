import * as THREE from 'three';

export interface ExtractedJokerParts {
    headGroup: THREE.Group;
    torsoGroup: THREE.Group;
    leftArmGroup: THREE.Group;
    rightArmGroup: THREE.Group;
    leftLegGroup: THREE.Group;
    rightLegGroup: THREE.Group;
    weaponsGroup: THREE.Group;
}

// ============================================================================
// EXTRACTS SEPARATE MODULAR BODY PARTS DIRECTLY FROM HIGH-POLY GLB MODEL
// ============================================================================
export class JokerModelExtractor {
    public static extractPartsFromGLTF(gltfScene: THREE.Group): ExtractedJokerParts {
        const headGroup = new THREE.Group();
        headGroup.name = 'JokerModularHead';

        const torsoGroup = new THREE.Group();
        torsoGroup.name = 'JokerModularTorso';

        const leftArmGroup = new THREE.Group();
        leftArmGroup.name = 'JokerModularLeftArm';

        const rightArmGroup = new THREE.Group();
        rightArmGroup.name = 'JokerModularRightArm';

        const leftLegGroup = new THREE.Group();
        leftLegGroup.name = 'JokerModularLeftLeg';

        const rightLegGroup = new THREE.Group();
        rightLegGroup.name = 'JokerModularRightLeg';

        const weaponsGroup = new THREE.Group();
        weaponsGroup.name = 'JokerModularWeapons';

        // Traverse all children in GLB model and categorize into separate groups
        gltfScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = (child as THREE.Mesh).clone();
                mesh.castShadow = true;
                mesh.receiveShadow = true;

                const name = child.name.toLowerCase();

                if (name.includes('head') || name.includes('hair') || name.includes('face') || name.includes('eye') || name.includes('glass')) {
                    headGroup.add(mesh);
                } else if (name.includes('blade') || name.includes('weapon') || name.includes('knife') || name.includes('dagger') || name.includes('phone')) {
                    weaponsGroup.add(mesh);
                } else if (name.includes('arm') || name.includes('shoulder') || name.includes('hand') || name.includes('sleeve')) {
                    if (name.includes('l') || child.position.x > 0.05) {
                        leftArmGroup.add(mesh);
                    } else {
                        rightArmGroup.add(mesh);
                    }
                } else if (name.includes('leg') || name.includes('pant') || name.includes('trouser') || name.includes('boot') || name.includes('shoe')) {
                    if (name.includes('l') || child.position.x > 0) {
                        leftLegGroup.add(mesh);
                    } else {
                        rightLegGroup.add(mesh);
                    }
                } else {
                    // Default torso / jacket
                    torsoGroup.add(mesh);
                }
            }
        });

        // If categorization by name was empty, split root meshes by spatial bounding box coordinates
        if (headGroup.children.length === 0 && gltfScene.children.length > 0) {
            gltfScene.children.forEach(child => {
                const clone = child.clone(true);
                const bbox = new THREE.Box3().setFromObject(clone);
                const center = bbox.getCenter(new THREE.Vector3());

                if (center.y > 1.2) {
                    headGroup.add(clone);
                } else if (center.y < 0.6) {
                    if (center.x > 0) leftLegGroup.add(clone);
                    else rightLegGroup.add(clone);
                } else {
                    if (center.x > 0.2) leftArmGroup.add(clone);
                    else if (center.x < -0.2) rightArmGroup.add(clone);
                    else torsoGroup.add(clone);
                }
            });
        }

        return {
            headGroup,
            torsoGroup,
            leftArmGroup,
            rightArmGroup,
            leftLegGroup,
            rightLegGroup,
            weaponsGroup
        };
    }
}
