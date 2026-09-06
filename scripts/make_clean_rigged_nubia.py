import pygltflib
import os

def clean_rigged_model(input_path, output_path):
    print(f"Cleaning animations from {input_path}")
    orig_size = os.path.getsize(input_path)
    gltf = pygltflib.GLTF2().load(input_path)

    gltf.animations = [] # Strip heavy baked anims; procedural walking will animate the skeleton

    # Collect used accessors
    used_accessors = set()
    for mesh in gltf.meshes:
        for prim in mesh.primitives:
            if prim.indices is not None:
                used_accessors.add(prim.indices)
            if prim.attributes:
                for attr in ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0']:
                    acc = getattr(prim.attributes, attr, None)
                    if acc is not None:
                        used_accessors.add(acc)

    for skin in gltf.skins:
        if skin.inverseBindMatrices is not None:
            used_accessors.add(skin.inverseBindMatrices)

    # Collect used buffer views
    used_buffer_views = set()
    for acc_idx in used_accessors:
        acc = gltf.accessors[acc_idx]
        if acc.bufferView is not None:
            used_buffer_views.add(acc.bufferView)

    for img in gltf.images:
        if img.bufferView is not None:
            used_buffer_views.add(img.bufferView)

    raw_buffer_data = gltf.binary_blob()
    new_binary_data = bytearray()
    old_to_new_bv = {}
    new_buffer_views = []

    for old_bv_idx in sorted(list(used_buffer_views)):
        bv = gltf.bufferViews[old_bv_idx]
        start = bv.byteOffset or 0
        length = bv.byteLength
        chunk = raw_buffer_data[start:start+length]

        while len(new_binary_data) % 4 != 0:
            new_binary_data.append(0)

        offset = len(new_binary_data)
        new_binary_data.extend(chunk)

        new_bv = pygltflib.BufferView(
            buffer=0,
            byteOffset=offset,
            byteLength=length,
            byteStride=bv.byteStride,
            target=bv.target
        )
        old_to_new_bv[old_bv_idx] = len(new_buffer_views)
        new_buffer_views.append(new_bv)

    # Remap accessors
    old_to_new_acc = {}
    new_accessors = []
    for old_acc_idx in sorted(list(used_accessors)):
        old_acc = gltf.accessors[old_acc_idx]
        new_acc = pygltflib.Accessor(
            bufferView=old_to_new_bv.get(old_acc.bufferView) if old_acc.bufferView is not None else None,
            byteOffset=old_acc.byteOffset or 0,
            componentType=old_acc.componentType,
            count=old_acc.count,
            type=old_acc.type,
            max=old_acc.max,
            min=old_acc.min,
            normalized=old_acc.normalized
        )
        old_to_new_acc[old_acc_idx] = len(new_accessors)
        new_accessors.append(new_acc)

    # Update meshes
    for mesh in gltf.meshes:
        for prim in mesh.primitives:
            if prim.indices is not None and prim.indices in old_to_new_acc:
                prim.indices = old_to_new_acc[prim.indices]
            if prim.attributes:
                for attr in ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0']:
                    val = getattr(prim.attributes, attr, None)
                    if val is not None and val in old_to_new_acc:
                        setattr(prim.attributes, attr, old_to_new_acc[val])

    # Update skins
    for skin in gltf.skins:
        if skin.inverseBindMatrices is not None and skin.inverseBindMatrices in old_to_new_acc:
            skin.inverseBindMatrices = old_to_new_acc[skin.inverseBindMatrices]

    # Update images
    for img in gltf.images:
        if img.bufferView is not None and img.bufferView in old_to_new_bv:
            img.bufferView = old_to_new_bv[img.bufferView]

    gltf.accessors = new_accessors
    gltf.bufferViews = new_buffer_views
    gltf.buffers = [pygltflib.Buffer(byteLength=len(new_binary_data))]
    gltf.set_binary_blob(bytes(new_binary_data))

    gltf.save(output_path)
    new_size = os.path.getsize(output_path)
    print(f"Success! {input_path} reduced from {orig_size / (1024*1024):.2f} MB down to {new_size / 1024:.1f} KB ({new_size / (1024*1024):.2f} MB)")

if __name__ == '__main__':
    clean_rigged_model('public/nubia__multiversus.glb', 'public/nubia__multiversus.glb')
