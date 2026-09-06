import pygltflib
import numpy as np

models = [
    ('Evil Joker', 'public/evil_joker_3d_model.glb'),
    ('Batman', 'public/batman_origins_suit_-_textured_and_rigged.glb'),
    ('Harley', 'public/harley_quin_-_textured_and_rigged.glb'),
    ('Nubia', 'public/nubia__multiversus.glb'),
    ('Spider-Gwen', 'public/spider_gwen_marvel_ultimate_alliance_3.glb'),
    ('Origins Joker', 'public/joker_batman_arkham_origins.glb'),
    ('Classic Joker', 'public/joker.glb')
]

for name, path in models:
    g = pygltflib.GLTF2().load(path)
    scene = g.scenes[g.scene or 0]
    print(f"\n==================== {name} ({path}) ====================")
    print(f"Scene root nodes: {scene.nodes}")
    for n_idx in scene.nodes:
        n = g.nodes[n_idx]
        print(f"  Root Node {n_idx} ({n.name}): Trans={n.translation}, Rot={n.rotation}, Scale={n.scale}")
