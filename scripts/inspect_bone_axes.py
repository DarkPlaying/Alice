import pygltflib
import numpy as np

def inspect_bone_hierarchy(path):
    print(f"\n==========================================")
    print(f"File: {path}")
    g = pygltflib.GLTF2().load(path)
    for n in g.nodes:
        if n.name and any(k in n.name.lower() for k in ['upperarm', 'uparm', 'thigh', 'leg_a', 'bip01_l_upperarm', 'bip01_r_upperarm']):
            print(f"  Node: {n.name}")
            print(f"    Translation: {n.translation}")
            print(f"    Rotation (quaternion): {n.rotation}")
            print(f"    Scale: {n.scale}")

inspect_bone_hierarchy('public/batman_origins_suit_-_textured_and_rigged.glb')
inspect_bone_hierarchy('public/harley_quin_-_textured_and_rigged.glb')
inspect_bone_hierarchy('public/nubia__multiversus.glb')
inspect_bone_hierarchy('public/evil_joker_3d_model.glb')
