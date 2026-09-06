import pygltflib

g = pygltflib.GLTF2().load('public/nubia__multiversus.glb')
for n_idx, n in enumerate(g.nodes):
    if n.mesh is not None:
        print(f"Mesh Node {n_idx} ({n.name}): Mesh={n.mesh} ({g.meshes[n.mesh].name}), Skin={n.skin}, Rot={n.rotation}, Trans={n.translation}, Scale={n.scale}")

for s_idx, s in enumerate(g.skins):
    print(f"Skin {s_idx} ({s.name}): Skeleton={s.skeleton}, Joints count={len(s.joints)}")
