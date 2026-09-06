import pygltflib

def inspect_geo(path):
    g = pygltflib.GLTF2().load(path)
    print(f"\n=================================")
    print(f"File: {path}")
    for m_idx, mesh in enumerate(g.meshes):
        for p_idx, prim in enumerate(mesh.primitives):
            attrs = prim.attributes
            attr_dict = {}
            if attrs:
                for k in ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0']:
                    val = getattr(attrs, k, None)
                    if val is not None:
                        acc = g.accessors[val]
                        attr_dict[k] = f"count={acc.count}, type={acc.type}, comp={acc.componentType}"
            print(f"  Mesh {m_idx} ({mesh.name}) Prim {p_idx}: {attr_dict}")

inspect_geo('public/batman_origins_suit_-_textured_and_rigged.glb')
inspect_geo('public/harley_quin_-_textured_and_rigged.glb')
