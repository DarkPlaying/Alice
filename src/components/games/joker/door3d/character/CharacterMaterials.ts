import * as THREE from 'three';

/**
 * PBR Material palette extracted directly from Arkham Origins Joker model
 */
export class CharacterMaterials {
    // Arkham Purple Suit Jacket
    public static purpleSuit: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
        color: 0x4c1d95,
        roughness: 0.45,
        metalness: 0.15,
        name: 'ArkhamPurpleSuit'
    });

    // Golden Yellow Waistcoat Vest
    public static yellowVest: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
        color: 0xca8a04,
        roughness: 0.35,
        metalness: 0.25,
        name: 'ArkhamYellowVest'
    });

    // Crisp White Dress Shirt
    public static whiteShirt: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.6,
        metalness: 0.0,
        name: 'ArkhamWhiteShirt'
    });

    // Dark Red Tie / Flower Accent
    public static redAccent: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
        color: 0x991b1b,
        roughness: 0.4,
        metalness: 0.1,
        name: 'ArkhamRedAccent'
    });

    // Iconic Joker Green Hair
    public static greenHair: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
        color: 0x15803d,
        roughness: 0.5,
        metalness: 0.1,
        name: 'ArkhamGreenHair'
    });

    // Pale Joker Skin Tone
    public static paleSkin: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        roughness: 0.7,
        metalness: 0.0,
        name: 'ArkhamPaleSkin'
    });

    // Dark Leather Shoes / Boots
    public static darkBoots: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.3,
        metalness: 0.4,
        name: 'ArkhamDarkBoots'
    });

    // Black Eye Dots
    public static blackEyeDot: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.2,
        metalness: 0.8,
        name: 'BlackEyeDot'
    });
}
