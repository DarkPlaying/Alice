import pygltflib

def inspect_nubia(path):
    g = pygltflib.GLTF2().load(path)
    print(f"\n================ NUBIA INSPECTION ================")
    print(f"Total Meshes: {len(g.meshes)}")
    for i, m in enumerate(g.meshes):
        print(f"  Mesh {i}: {m.name}")
        for p_idx, p in enumerate(m.primitives):
            mat_name = g.materials[p.material].name if p.material is not None and p.material < len(g.materials) else "None"
            print(f"    Primitive {p_idx}: Material={mat_name}")

    print(f"\nTotal Nodes: {len(g.nodes)}")
    for i, n in enumerate(g.nodes):
        if n.mesh is not None:
            print(f"  Node {i}: {n.name}, Mesh={n.mesh} ({g.meshes[n.mesh].name}), Rot={n.rotation}, Scale={n.scale}, Trans={n.translation}")
        elif any(k in (n.name or '').lower() for k in ['hair', 'spear', 'weapon', 'prop', 'head']):
            print(f"  Bone/Node {i}: {n.name}, Rot={n.rotation}, Scale={n.scale}, Trans={n.translation}")

inspect_nubia('public/nubia__multiversus.glb')
