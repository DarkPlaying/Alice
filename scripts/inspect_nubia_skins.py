import pygltflib

g = pygltflib.GLTF2().load('public/nubia__multiversus.glb')
print(f"Skins: {len(g.skins)}")
for idx, s in enumerate(g.skins):
    root_bone = g.nodes[s.skeleton] if s.skeleton is not None else None
    print(f"Skin {idx}: Skeleton node = {s.skeleton} ({root_bone.name if root_bone else 'None'}), Joints count = {len(s.joints)}")
    first_few_joints = [g.nodes[j].name for j in s.joints[:10]]
    print(f"  First few joints: {first_few_joints}")
