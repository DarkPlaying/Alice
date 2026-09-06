import pygltflib

for name, path in [('Nubia', 'public/nubia__multiversus.glb'), ('Evil Joker', 'public/evil_joker_3d_model.glb')]:
    g = pygltflib.GLTF2().load(path)
    print(f"\n==================== {name} ====================")
    n0 = g.nodes[0]
    print(f"Node 0: {n0.name}, Children={n0.children}")
    for c_idx in n0.children or []:
        c = g.nodes[c_idx]
        print(f"  Child {c_idx} ({c.name}): Rot={c.rotation}, Trans={c.translation}, Scale={c.scale}, Children={c.children}")
        for gc_idx in c.children or []:
            gc = g.nodes[gc_idx]
            print(f"    Grandchild {gc_idx} ({gc.name}): Rot={gc.rotation}, Trans={gc.translation}, Scale={gc.scale}, Mesh={gc.mesh}")
