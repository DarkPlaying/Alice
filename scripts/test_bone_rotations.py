import pygltflib
import numpy as np

def inspect_bip_rotations(path):
    print(f"\n==========================================")
    print(f"File: {path}")
    g = pygltflib.GLTF2().load(path)
    for n in g.nodes:
        if n.name and any(k in n.name for k in ['Bip01_L_UpperArm', 'Bip01_R_UpperArm', 'Bip01_L_Thigh', 'Bip01_R_Thigh', 'Bip01_Spine', 'fml_un_L_uparm', 'fml_un_L_thigh']):
            print(f"  Node: {n.name}")
            print(f"    Rot: {n.rotation}")
            print(f"    Trans: {n.translation}")

inspect_bip_rotations('public/batman_origins_suit_-_textured_and_rigged.glb')
inspect_bip_rotations('public/harley_quin_-_textured_and_rigged.glb')
