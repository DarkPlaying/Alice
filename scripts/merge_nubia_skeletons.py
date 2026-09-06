import pygltflib
import os

def merge_nubia_skeletons():
    input_path = 'public/nubia__multiversus.glb'
    gltf = pygltflib.GLTF2().load(input_path)

    # Skin 0 is the primary character skeleton (405 joints)
    skin0 = gltf.skins[0]
    skin1 = gltf.skins[1]
    skin2 = gltf.skins[2]

    # Map joint names from skin 1 and skin 2 to skin 0
    s0_name_to_idx = {gltf.nodes[j].name.split('_')[0] + '_' + gltf.nodes[j].name.split('_')[1] if len(gltf.nodes[j].name.split('_')) > 1 else gltf.nodes[j].name: j for j in skin0.joints}

    print(f"Skin 0 joint sample: {list(s0_name_to_idx.keys())[:10]}")

    # Point Skin 1 and Skin 2 to Skin 0's skeleton and joints
    gltf.skins[1].skeleton = skin0.skeleton
    gltf.skins[1].joints = list(skin0.joints)
    gltf.skins[1].inverseBindMatrices = skin0.inverseBindMatrices

    gltf.skins[2].skeleton = skin0.skeleton
    gltf.skins[2].joints = list(skin0.joints)
    gltf.skins[2].inverseBindMatrices = skin0.inverseBindMatrices

    # Delete redundant duplicate skeleton nodes 415..823 and 824..1222 from root children
    # Root node children:
    scene_root = gltf.nodes[2] # GLTF_SceneRootNode
    print(f"Scene root children before: {scene_root.children}")
    # Only keep Node 5 (Skin 0 skeleton), Mesh 7, Mesh 8, Mesh 417, Mesh 826
    # Keep child node 3 (GLTF_created_0)
    # Remove child node 413 (GLTF_created_1), node 822 (GLTF_created_2)
    new_children = []
    for c in scene_root.children:
        if c not in [413, 822]:
            new_children.append(c)
    scene_root.children = new_children
    print(f"Scene root children after: {scene_root.children}")

    gltf.save(input_path)
    print("Nubia single skeleton merged successfully!")

merge_nubia_skeletons()
