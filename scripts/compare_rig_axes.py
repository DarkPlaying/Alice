import pygltflib

def inspect_nodes(path):
    print(f"\n==========================================")
    print(f"File: {path}")
    g = pygltflib.GLTF2().load(path)
    for n in g.nodes:
        if n.name and any(k in n.name.lower() for k in ['arm', 'leg', 'thigh']):
            if any(k in n.name.lower() for k in ['upper', 'uparm', 'thigh', 'upleg']) and not any(k in n.name.lower() for k in ['twist', 'att']):
                print(f"  Node: {n.name}")
                print(f"    Rot: {n.rotation}")
                print(f"    Trans: {n.translation}")

inspect_nodes('public/joker_batman_arkham_origins.glb')
inspect_nodes('public/batman_origins_suit_-_textured_and_rigged.glb')
inspect_nodes('public/harley_quin_-_textured_and_rigged.glb')
inspect_nodes('public/nubia__multiversus.glb')
