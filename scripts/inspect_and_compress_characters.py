import os
import sys
import io
import pygltflib
from PIL import Image

def compress_image_bytes(raw_bytes, mime_type, max_dim=512, quality=80):
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

def inspect_and_compress_glb(input_path, output_path, max_dim=512, quality=80):
    print(f"\n=======================================================")
    print(f"Inspecting & Compressing: {input_path}")
    if not os.path.exists(input_path):
        print(f"File does not exist: {input_path}")
        return

    orig_size = os.path.getsize(input_path)
    print(f"Original size: {orig_size / (1024 * 1024):.2f} MB ({orig_size / 1024:.1f} KB)")

    gltf = pygltflib.GLTF2().load(input_path)

    # Inspect Bones / Nodes
    bones_found = []
    for idx, node in enumerate(gltf.nodes):
        name = node.name or f"node_{idx}"
        lname = name.lower()
        if any(k in lname for k in ['bone', 'head', 'spine', 'arm', 'leg', 'shoulder', 'hand', 'knee', 'thigh', 'foot', 'bip', 'root', 'pelvis']):
            bones_found.append(name)

    print(f"Total Nodes: {len(gltf.nodes)}, Total Meshes: {len(gltf.meshes)}, Total Materials: {len(gltf.materials)}")
    print(f"Candidate Joint/Bone Nodes ({len(bones_found)}): {bones_found[:15]} ...")

    # Inspect Animations
    anim_names = [a.name or f"anim_{i}" for i, a in enumerate(gltf.animations)]
    print(f"Embedded Animations ({len(gltf.animations)}): {anim_names}")

    raw_buffer_data = gltf.binary_blob()
    new_binary_data = bytearray()

    # Determine image bufferViews
    img_bv_indices = set()
    for img in gltf.images:
        if img.bufferView is not None:
            img_bv_indices.add(img.bufferView)

    old_to_new_bv = {}
    new_buffer_views = []

    # Copy non-image bufferViews (geometry, animations, skins)
    for idx, bv in enumerate(gltf.bufferViews):
        if idx not in img_bv_indices:
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
            old_to_new_bv[idx] = len(new_buffer_views)
            new_buffer_views.append(new_bv)

    # Process and compress images
    for img in gltf.images:
        if img.bufferView is not None:
            old_bv_idx = img.bufferView
            old_bv = gltf.bufferViews[old_bv_idx]
            start = old_bv.byteOffset or 0
            length = old_bv.byteLength
            chunk = raw_buffer_data[start:start+length]

            comp_chunk, new_mime = compress_image_bytes(chunk, img.mimeType or 'image/png', max_dim=max_dim, quality=quality)
            print(f"  Image '{img.name}': {len(chunk) / 1024:.1f} KB -> {len(comp_chunk) / 1024:.1f} KB ({new_mime})")

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

    # Update accessors bufferView indices
    for acc in gltf.accessors:
        if acc.bufferView is not None and acc.bufferView in old_to_new_bv:
            acc.bufferView = old_to_new_bv[acc.bufferView]

    gltf.bufferViews = new_buffer_views
    gltf.buffers = [pygltflib.Buffer(byteLength=len(new_binary_data))]
    gltf.set_binary_blob(bytes(new_binary_data))

    gltf.save(output_path)
    new_size = os.path.getsize(output_path)
    reduction = (orig_size - new_size) / orig_size * 100
    print(f"Optimized size: {new_size / 1024:.1f} KB ({new_size / (1024*1024):.2f} MB)")
    print(f"Total reduction: {reduction:.1f}%")

if __name__ == '__main__':
    targets = [
        'public/batman_origins_suit_-_textured_and_rigged.glb',
        'public/nubia__multiversus.glb',
        'public/spider_gwen_marvel_ultimate_alliance_3.glb',
        'public/harley_quin_-_textured_and_rigged.glb',
        'public/evil_joker_3d_model.glb'
    ]

    for t in targets:
        inspect_and_compress_glb(t, t, max_dim=512, quality=75)
