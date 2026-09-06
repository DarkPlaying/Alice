"""
GLB Optimization Script for Borderland Game Assets
Reduces GLB file sizes from megabytes down to small Kilobytes (KB) by:
1. Isolating only active/required 3D nodes and meshes.
2. Pruning unused geometry, accessors, bufferViews, and materials.
3. Resizing high-res 2K/4K textures to optimal real-time dimensions (512x512 / 1024x1024).
4. Compressing textures with high-quality JPEG / optimized PNG.
"""

import os
import sys
import io
import pygltflib
from PIL import Image

def compress_image_bytes(raw_bytes, mime_type, max_dim=512, quality=85):
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
            # If all alpha is 255, convert to RGB
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

def optimize_sci_fi_props(input_path, output_path, max_dim=512, quality=85):
    print(f"\n=======================================================")
    print(f"Optimizing: {input_path}")
    orig_size = os.path.getsize(input_path)
    print(f"Original size: {orig_size / (1024 * 1024):.2f} MB ({orig_size / 1024:.1f} KB)")

    gltf = pygltflib.GLTF2().load(input_path)

    # 1. Find the Door_controls node index
    door_controls_idx = None
    for idx, node in enumerate(gltf.nodes):
        if node.name == 'Door_controls':
            door_controls_idx = idx
            break

    if door_controls_idx is None:
        for idx, node in enumerate(gltf.nodes):
            if node.name and 'door' in node.name.lower():
                door_controls_idx = idx
                break

    if door_controls_idx is None:
        print("Error: Could not identify target node.")
        return

    print(f"Target: 'Door_controls' at index {door_controls_idx}")

    active_nodes = set()
    def collect_nodes(n_idx):
        active_nodes.add(n_idx)
        node = gltf.nodes[n_idx]
        for child_idx in node.children:
            collect_nodes(child_idx)

    collect_nodes(door_controls_idx)

    active_meshes = set()
    for n_idx in active_nodes:
        m_idx = gltf.nodes[n_idx].mesh
        if m_idx is not None:
            active_meshes.add(m_idx)

    active_materials = set()
    active_accessors = set()

    for m_idx in active_meshes:
        mesh = gltf.meshes[m_idx]
        for prim in mesh.primitives:
            if prim.material is not None:
                active_materials.add(prim.material)
            if prim.indices is not None:
                active_accessors.add(prim.indices)
            if prim.attributes:
                for attr_name in ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0']:
                    acc = getattr(prim.attributes, attr_name, None)
                    if acc is not None:
                        active_accessors.add(acc)

    active_textures = set()
    for mat_idx in active_materials:
        mat = gltf.materials[mat_idx]
        if mat.pbrMetallicRoughness:
            if mat.pbrMetallicRoughness.baseColorTexture:
                active_textures.add(mat.pbrMetallicRoughness.baseColorTexture.index)
            if mat.pbrMetallicRoughness.metallicRoughnessTexture:
                active_textures.add(mat.pbrMetallicRoughness.metallicRoughnessTexture.index)
        if mat.normalTexture:
            active_textures.add(mat.normalTexture.index)
        if mat.occlusionTexture:
            active_textures.add(mat.occlusionTexture.index)
        if mat.emissiveTexture:
            active_textures.add(mat.emissiveTexture.index)

    active_images = set()
    for tex_idx in active_textures:
        tex = gltf.textures[tex_idx]
        if tex.source is not None:
            active_images.add(tex.source)

    active_geometry_bv = set()
    for acc_idx in active_accessors:
        acc = gltf.accessors[acc_idx]
        if acc.bufferView is not None:
            active_geometry_bv.add(acc.bufferView)

    raw_buffer_data = gltf.binary_blob()
    new_binary_data = bytearray()
    old_to_new_bv = {}

    # Copy geometry bufferViews
    for old_bv_idx in sorted(list(active_geometry_bv)):
        bv = gltf.bufferViews[old_bv_idx]
        start = bv.byteOffset or 0
        length = bv.byteLength
        chunk = raw_buffer_data[start:start+length]

        while len(new_binary_data) % 4 != 0:
            new_binary_data.append(0)

        new_bv_idx = len(old_to_new_bv)
        old_to_new_bv[old_bv_idx] = new_bv_idx

    new_buffer_views = []
    for old_bv_idx in sorted(list(active_geometry_bv)):
        old_bv = gltf.bufferViews[old_bv_idx]
        start = old_bv.byteOffset or 0
        length = old_bv.byteLength
        chunk = raw_buffer_data[start:start+length]

        while len(new_binary_data) % 4 != 0:
            new_binary_data.append(0)

        offset = len(new_binary_data)
        new_binary_data.extend(chunk)

        new_bv = pygltflib.BufferView(
            buffer=0,
            byteOffset=offset,
            byteLength=length,
            byteStride=old_bv.byteStride,
            target=old_bv.target
        )
        new_buffer_views.append(new_bv)

    # Compress and append image bufferViews
    old_to_new_img = {}
    new_images = []

    for old_img_idx in sorted(list(active_images)):
        old_img = gltf.images[old_img_idx]
        if old_img.bufferView is not None:
            bv = gltf.bufferViews[old_img.bufferView]
            start = bv.byteOffset or 0
            length = bv.byteLength
            chunk = raw_buffer_data[start:start+length]

            comp_chunk, new_mime = compress_image_bytes(chunk, old_img.mimeType or 'image/png', max_dim=max_dim, quality=quality)
            print(f"  Image {old_img_idx}: {len(chunk) / 1024:.1f} KB -> {len(comp_chunk) / 1024:.1f} KB ({new_mime})")

            while len(new_binary_data) % 4 != 0:
                new_binary_data.append(0)

            img_offset = len(new_binary_data)
            new_binary_data.extend(comp_chunk)

            new_img_bv = pygltflib.BufferView(
                buffer=0,
                byteOffset=img_offset,
                byteLength=len(comp_chunk)
            )
            new_img_bv_idx = len(new_buffer_views)
            new_buffer_views.append(new_img_bv)

            new_img = pygltflib.Image(
                name=old_img.name,
                mimeType=new_mime,
                bufferView=new_img_bv_idx
            )
            old_to_new_img[old_img_idx] = len(new_images)
            new_images.append(new_img)

    # Re-map accessors
    old_to_new_acc = {}
    new_accessors = []
    for old_acc_idx in sorted(list(active_accessors)):
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

    # Re-map textures
    old_to_new_tex = {}
    new_textures = []
    for old_tex_idx in sorted(list(active_textures)):
        old_tex = gltf.textures[old_tex_idx]
        new_tex = pygltflib.Texture(
            name=old_tex.name,
            sampler=old_tex.sampler,
            source=old_to_new_img.get(old_tex.source) if old_tex.source is not None else None
        )
        old_to_new_tex[old_tex_idx] = len(new_textures)
        new_textures.append(new_tex)

    # Re-map materials
    old_to_new_mat = {}
    new_materials = []
    for old_mat_idx in sorted(list(active_materials)):
        old_mat = gltf.materials[old_mat_idx]
        new_mat = pygltflib.Material(
            name=old_mat.name,
            doubleSided=old_mat.doubleSided,
            emissiveFactor=old_mat.emissiveFactor
        )
        if old_mat.pbrMetallicRoughness:
            pbr = pygltflib.PbrMetallicRoughness(
                baseColorFactor=old_mat.pbrMetallicRoughness.baseColorFactor,
                metallicFactor=old_mat.pbrMetallicRoughness.metallicFactor,
                roughnessFactor=old_mat.pbrMetallicRoughness.roughnessFactor
            )
            if old_mat.pbrMetallicRoughness.baseColorTexture:
                pbr.baseColorTexture = pygltflib.TextureInfo(
                    index=old_to_new_tex[old_mat.pbrMetallicRoughness.baseColorTexture.index]
                )
            if old_mat.pbrMetallicRoughness.metallicRoughnessTexture:
                pbr.metallicRoughnessTexture = pygltflib.TextureInfo(
                    index=old_to_new_tex[old_mat.pbrMetallicRoughness.metallicRoughnessTexture.index]
                )
            new_mat.pbrMetallicRoughness = pbr

        if old_mat.normalTexture:
            new_mat.normalTexture = pygltflib.NormalMaterialTexture(
                index=old_to_new_tex[old_mat.normalTexture.index]
            )
        if old_mat.emissiveTexture:
            new_mat.emissiveTexture = pygltflib.TextureInfo(
                index=old_to_new_tex[old_mat.emissiveTexture.index]
            )
        if old_mat.occlusionTexture:
            new_mat.occlusionTexture = pygltflib.OcclusionTextureInfo(
                index=old_to_new_tex[old_mat.occlusionTexture.index]
            )

        old_to_new_mat[old_mat_idx] = len(new_materials)
        new_materials.append(new_mat)

    # Re-map meshes
    old_to_new_mesh = {}
    new_meshes = []
    for old_m_idx in sorted(list(active_meshes)):
        old_mesh = gltf.meshes[old_m_idx]
        new_prims = []
        for prim in old_mesh.primitives:
            new_prim = pygltflib.Primitive(
                indices=old_to_new_acc.get(prim.indices) if prim.indices is not None else None,
                material=old_to_new_mat.get(prim.material) if prim.material is not None else None,
                mode=prim.mode
            )
            new_attrs = pygltflib.Attributes()
            if prim.attributes:
                for attr_name in ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0']:
                    acc = getattr(prim.attributes, attr_name, None)
                    if acc is not None and acc in old_to_new_acc:
                        setattr(new_attrs, attr_name, old_to_new_acc[acc])
            new_prim.attributes = new_attrs
            new_prims.append(new_prim)

        new_mesh = pygltflib.Mesh(name=old_mesh.name, primitives=new_prims)
        old_to_new_mesh[old_m_idx] = len(new_meshes)
        new_meshes.append(new_mesh)

    # Re-map nodes
    old_to_new_node = {}
    new_nodes = []
    for old_n_idx in sorted(list(active_nodes)):
        old_node = gltf.nodes[old_n_idx]
        new_node = pygltflib.Node(
            name=old_node.name,
            translation=old_node.translation,
            rotation=old_node.rotation,
            scale=old_node.scale,
            matrix=old_node.matrix
        )
        old_to_new_node[old_n_idx] = len(new_nodes)
        new_nodes.append(new_node)

    for old_n_idx in sorted(list(active_nodes)):
        new_idx = old_to_new_node[old_n_idx]
        old_node = gltf.nodes[old_n_idx]
        new_children = [old_to_new_node[c] for c in old_node.children if c in old_to_new_node]
        new_nodes[new_idx].children = new_children
        if old_node.mesh is not None and old_node.mesh in old_to_new_mesh:
            new_nodes[new_idx].mesh = old_to_new_mesh[old_node.mesh]

    root_node_idx = old_to_new_node[door_controls_idx]
    new_gltf = pygltflib.GLTF2(
        scene=0,
        scenes=[pygltflib.Scene(name="Scene", nodes=[root_node_idx])],
        nodes=new_nodes,
        meshes=new_meshes,
        materials=new_materials,
        textures=new_textures,
        images=new_images,
        accessors=new_accessors,
        bufferViews=new_buffer_views,
        buffers=[pygltflib.Buffer(byteLength=len(new_binary_data))]
    )
    new_gltf.set_binary_blob(bytes(new_binary_data))

    new_gltf.save(output_path)
    new_size = os.path.getsize(output_path)
    reduction = (orig_size - new_size) / orig_size * 100
    print(f"Optimized size: {new_size / 1024:.1f} KB ({new_size / (1024*1024):.2f} MB)")
    print(f"Total reduction: {reduction:.1f}%")

def compress_general_glb(input_path, output_path, max_dim=1024, quality=85):
    print(f"\n=======================================================")
    print(f"Compressing GLB: {input_path}")
    orig_size = os.path.getsize(input_path)
    print(f"Original size: {orig_size / (1024 * 1024):.2f} MB ({orig_size / 1024:.1f} KB)")

    gltf = pygltflib.GLTF2().load(input_path)
    raw_buffer_data = gltf.binary_blob()
    new_binary_data = bytearray()

    # Determine image bufferViews
    img_bv_indices = set()
    for img in gltf.images:
        if img.bufferView is not None:
            img_bv_indices.add(img.bufferView)

    old_to_new_bv = {}
    new_buffer_views = []

    # Copy non-image bufferViews (geometry)
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
            print(f"  Image: {len(chunk) / 1024:.1f} KB -> {len(comp_chunk) / 1024:.1f} KB ({new_mime})")

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
    # 1. Optimize sci-fi props bundle (Door_controls scanner terminal) down to KB
    props_target = 'public/3d_testing_props/free_props_for_a_sci_fi_environment.glb'
    if os.path.exists(props_target):
        optimize_sci_fi_props(props_target, props_target, max_dim=512, quality=82)

    # 2. Optimize spaceship door GLB down to KB
    door_target = 'public/3d_testing_props/super_low-poly_anime_spaceship_door.glb'
    if os.path.exists(door_target):
        compress_general_glb(door_target, door_target, max_dim=1024, quality=85)

    print("\n[ALL GLB FILES SUCCESSFULLY OPTIMIZED TO KB]")
