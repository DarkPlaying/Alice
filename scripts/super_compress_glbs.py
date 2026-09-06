import os
import sys
import io
import pygltflib
from PIL import Image

def compress_image_bytes(raw_bytes, mime_type, max_dim=384, quality=72):
    try:
        im = Image.open(io.BytesIO(raw_bytes))
        orig_w, orig_h = im.size

        # Downscale if larger than max_dim
        scale = min(1.0, max_dim / max(orig_w, orig_h))
        if scale < 1.0:
            new_w = max(16, int(orig_w * scale))
            new_h = max(16, int(orig_h * scale))
            im = im.resize((new_w, new_h), Image.Resampling.LANCZOS)

        out_buf = io.BytesIO()
        has_alpha = ('A' in im.getbands()) or (im.mode in ('RGBA', 'LA', 'PA'))

        # Check if alpha is actually used
        if has_alpha:
            extrema = im.getextrema()
            alpha_extrema = extrema[-1] if isinstance(extrema, tuple) and isinstance(extrema[0], tuple) else extrema
            if isinstance(alpha_extrema, tuple) and alpha_extrema[0] == 255 and alpha_extrema[1] == 255:
                has_alpha = False
                im = im.convert('RGB')

        if has_alpha:
            im.save(out_buf, format='PNG', optimize=True)
            new_mime = 'image/png'
        else:
            if im.mode != 'RGB':
                im = im.convert('RGB')
            im.save(out_buf, format='JPEG', quality=quality, optimize=True)
            new_mime = 'image/jpeg'

        compressed_data = out_buf.getvalue()
        return compressed_data, new_mime
    except Exception as e:
        print(f"  Warning: Image compression failed: {e}")
        return raw_bytes, mime_type

def super_compress_glb(input_path, output_path, max_dim=384, quality=72):
    print(f"\n=======================================================")
    print(f"Super Compressing to KB: {input_path}")
    if not os.path.exists(input_path):
        return

    orig_size = os.path.getsize(input_path)
    gltf = pygltflib.GLTF2().load(input_path)

    # Strip unused/heavy vertex attributes: TANGENT, COLOR_0, TEXCOORD_1
    for mesh in gltf.meshes:
        for prim in mesh.primitives:
            if prim.attributes:
                if prim.attributes.TANGENT is not None:
                    prim.attributes.TANGENT = None
                if prim.attributes.COLOR_0 is not None:
                    prim.attributes.COLOR_0 = None
                if prim.attributes.TEXCOORD_1 is not None:
                    prim.attributes.TEXCOORD_1 = None

    # Collect only actually used accessors
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

    for anim in gltf.animations:
        for sampler in anim.samplers:
            used_accessors.add(sampler.input)
            used_accessors.add(sampler.output)

    # Collect used buffer views
    used_geo_bvs = set()
    for acc_idx in used_accessors:
        acc = gltf.accessors[acc_idx]
        if acc.bufferView is not None:
            used_geo_bvs.add(acc.bufferView)

    raw_buffer_data = gltf.binary_blob()
    new_binary_data = bytearray()
    old_to_new_bv = {}
    new_buffer_views = []

    # Copy and pack geometry bufferViews
    for old_bv_idx in sorted(list(used_geo_bvs)):
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

    # Compress and pack images
    for img in gltf.images:
        if img.bufferView is not None:
            old_bv_idx = img.bufferView
            old_bv = gltf.bufferViews[old_bv_idx]
            start = old_bv.byteOffset or 0
            length = old_bv.byteLength
            chunk = raw_buffer_data[start:start+length]

            comp_chunk, new_mime = compress_image_bytes(chunk, img.mimeType or 'image/png', max_dim=max_dim, quality=quality)

            while len(new_binary_data) % 4 != 0:
                new_binary_data.append(0)

            offset = len(new_binary_data)
            new_binary_data.extend(comp_chunk)

            new_bv = pygltflib.BufferView(
                buffer=0,
                byteOffset=offset,
                byteLength=len(comp_chunk)
            )
            new_bv_idx = len(new_buffer_views)
            old_to_new_bv[old_bv_idx] = new_bv_idx
            new_buffer_views.append(new_bv)

            img.bufferView = new_bv_idx
            img.mimeType = new_mime

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
                    if val is not None:
                        if val in old_to_new_acc:
                            setattr(prim.attributes, attr, old_to_new_acc[val])
                        else:
                            setattr(prim.attributes, attr, None)

    # Update skins
    for skin in gltf.skins:
        if skin.inverseBindMatrices is not None and skin.inverseBindMatrices in old_to_new_acc:
            skin.inverseBindMatrices = old_to_new_acc[skin.inverseBindMatrices]

    # Update animations
    for anim in gltf.animations:
        for sampler in anim.samplers:
            if sampler.input in old_to_new_acc:
                sampler.input = old_to_new_acc[sampler.input]
            if sampler.output in old_to_new_acc:
                sampler.output = old_to_new_acc[sampler.output]

    gltf.accessors = new_accessors
    gltf.bufferViews = new_buffer_views
    gltf.buffers = [pygltflib.Buffer(byteLength=len(new_binary_data))]
    gltf.set_binary_blob(bytes(new_binary_data))

    gltf.save(output_path)
    new_size = os.path.getsize(output_path)
    reduction = (orig_size - new_size) / orig_size * 100
    print(f"Compressed {input_path}: {orig_size / 1024:.1f} KB -> {new_size / 1024:.1f} KB ({new_size / (1024*1024):.2f} MB, {reduction:.1f}% reduction)")

if __name__ == '__main__':
    targets = [
        'public/batman_origins_suit_-_textured_and_rigged.glb',
        'public/harley_quin_-_textured_and_rigged.glb',
        'public/nubia__multiversus.glb',
        'public/spider_gwen_marvel_ultimate_alliance_3.glb',
        'public/evil_joker_3d_model.glb',
        'public/joker_batman_arkham_origins.glb',
        'public/joker_school_uniform_high_poly.glb',
        'public/joker.glb'
    ]

    for t in targets:
        super_compress_glb(t, t, max_dim=384, quality=70)
