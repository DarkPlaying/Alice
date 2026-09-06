import pygltflib

models = [
    'public/evil_joker_3d_model.glb',
    'public/batman_origins_suit_-_textured_and_rigged.glb',
    'public/harley_quin_-_textured_and_rigged.glb',
    'public/nubia__multiversus.glb',
    'public/spider_gwen_marvel_ultimate_alliance_3.glb'
]

for m in models:
    print(f"\n=====================================")
    print(f"Model: {m}")
    g = pygltflib.GLTF2().load(m)
    nodes_with_mesh = [n.name for n in g.nodes if n.mesh is not None]
    all_names = [n.name for n in g.nodes if n.name]
    print(f"Total Nodes: {len(g.nodes)}, Meshes: {nodes_with_mesh}")
    bones = [n.name for n in g.nodes if n.name and any(k in n.name.lower() for k in ['spine', 'arm', 'leg', 'head', 'hand', 'foot', 'thigh', 'calf', 'shin', 'clavicle', 'shoulder', 'pelvis', 'bip'])]
    print(f"Bone samples ({len(bones)}): {bones[:20]}")
