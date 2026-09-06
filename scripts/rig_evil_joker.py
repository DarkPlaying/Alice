import pygltflib
import numpy as np
import struct
import shutil
import os
from scipy.spatial import KDTree

def rig_evil_joker():
    src_evil = 'public/evil_joker_3d_model.glb'
    backup_evil = 'public/evil_joker_3d_model_backup.glb'
    if not os.path.exists(backup_evil):
        shutil.copyfile(src_evil, backup_evil)
        print("Backed up evil_joker_3d_model.glb")

    arkham_gltf = pygltflib.GLTF2().load('public/joker_batman_arkham_origins.glb')
    evil_gltf = pygltflib.GLTF2().load(backup_evil)

    print("Loaded Arkham Joker and Evil Joker.")

    # 1. Compute world transforms of Arkham joints
    def quat_to_mat4(q):
        x, y, z, w = q
        return np.array([
            [1 - 2*y*y - 2*z*z, 2*x*y - 2*z*w, 2*x*z + 2*y*w, 0],
            [2*x*y + 2*z*w, 1 - 2*x*x - 2*z*z, 2*y*z - 2*x*w, 0],
            [2*x*z - 2*y*w, 2*y*z + 2*x*w, 1 - 2*x*x - 2*y*y, 0],
            [0, 0, 0, 1]
        ], dtype=np.float32)

    def node_local_matrix(node):
        T = np.eye(4, dtype=np.float32)
        if node.translation:
            T[0:3, 3] = node.translation
        R = np.eye(4, dtype=np.float32)
        if node.rotation:
            R = quat_to_mat4(node.rotation)
        S = np.eye(4, dtype=np.float32)
        if node.scale:
            S[0, 0] = node.scale[0]
            S[1, 1] = node.scale[1]
            S[2, 2] = node.scale[2]
        if node.matrix:
            return np.array(node.matrix, dtype=np.float32).reshape(4, 4).T
        return T @ R @ S

    parent_map = {}
    for p_idx, node in enumerate(arkham_gltf.nodes):
        if node.children:
            for c_idx in node.children:
                parent_map[c_idx] = p_idx

    world_matrices = {}
    def get_world_matrix(n_idx):
        if n_idx in world_matrices:
            return world_matrices[n_idx]
        local = node_local_matrix(arkham_gltf.nodes[n_idx])
        if n_idx in parent_map:
            parent_world = get_world_matrix(parent_map[n_idx])
            world = parent_world @ local
        else:
            world = local
        world_matrices[n_idx] = world
        return world

    skin = arkham_gltf.skins[0]
    num_joints = len(skin.joints)
    joint_positions = []
    joint_names = []
    for j_idx, node_idx in enumerate(skin.joints):
        wm = get_world_matrix(node_idx)
        joint_positions.append(wm[0:3, 3])
        joint_names.append(arkham_gltf.nodes[node_idx].name)

    joint_positions = np.array(joint_positions, dtype=np.float32)

    # Define primary functional bones & segments for natural human skinning
    # Find joint indices by name in skin.joints
    def find_joint(pattern, require=True):
        for j_idx, node_idx in enumerate(skin.joints):
            if pattern.lower() in arkham_gltf.nodes[node_idx].name.lower():
                return j_idx
        if require:
            raise ValueError(f"Joint pattern not found: {pattern}")
        return None

    # Key body joint indices in skin.joints
    j_pelvis = find_joint('bip01_pelvis')
    j_spine_low = find_joint('spine lower')
    j_spine_mid = find_joint('spine middle')
    j_spine_up = find_joint('spine upper')
    j_neck = find_joint('head neck lower')
    j_head = find_joint('head neck upper')

    # Left Arm
    j_l_clavicle = find_joint('arm left shoulder 1')
    j_l_shoulder = find_joint('arm left shoulder 2')
    j_l_elbow = find_joint('arm left elbow')
    j_l_wrist = find_joint('arm left wrist')

    # Right Arm
    j_r_clavicle = find_joint('arm right shoulder 1')
    j_r_shoulder = find_joint('arm right shoulder 2')
    j_r_elbow = find_joint('arm right elbow')
    j_r_wrist = find_joint('arm right wrist')

    # Left Leg
    j_l_thigh = find_joint('leg left thigh')
    j_l_knee = find_joint('leg left knee')
    j_l_ankle = find_joint('leg left ankle')
    j_l_toe = find_joint('leg left toes')

    # Right Leg
    j_r_thigh = find_joint('leg right thigh')
    j_r_knee = find_joint('leg right knee')
    j_r_ankle = find_joint('leg right ankle')
    j_r_toe = find_joint('leg right toes')

    print(f"Key joints mapped: Pelvis={j_pelvis}, SpineUp={j_spine_up}, Head={j_head}, LSh={j_l_shoulder}, RSh={j_r_shoulder}")

    # Bone segments with radius of influence
    # Each segment has: (j_start, j_end, base_weight_func)
    bone_segments = [
        # Pelvis & lower spine
        ('pelvis', j_pelvis, j_spine_low),
        ('spine_mid', j_spine_low, j_spine_mid),
        ('spine_up', j_spine_mid, j_spine_up),
        ('neck_head', j_neck, j_head),
        # Left arm
        ('l_clav', j_spine_up, j_l_clavicle),
        ('l_uparm', j_l_shoulder, j_l_elbow),
        ('l_loarm', j_l_elbow, j_l_wrist),
        # Right arm
        ('r_clav', j_spine_up, j_r_clavicle),
        ('r_uparm', j_r_shoulder, j_r_elbow),
        ('r_loarm', j_r_elbow, j_r_wrist),
        # Left leg
        ('l_thigh', j_l_thigh, j_l_knee),
        ('l_calf', j_l_knee, j_l_ankle),
        ('l_foot', j_l_ankle, j_l_toe),
        # Right leg
        ('r_thigh', j_r_thigh, j_r_knee),
        ('r_calf', j_r_knee, j_r_ankle),
        ('r_foot', j_r_ankle, j_r_toe),
    ]

    # Function to calculate distance from points to a line segment
    def dist_to_segment(p, a, b):
        # p: (N, 3), a: (3,), b: (3,)
        ab = b - a
        ab_len2 = np.dot(ab, ab)
        if ab_len2 < 1e-8:
            return np.linalg.norm(p - a, axis=1), np.zeros(len(p))
        ap = p - a
        t = np.clip(np.sum(ap * ab, axis=1) / ab_len2, 0.0, 1.0)
        proj = a + t[:, np.newaxis] * ab
        dist = np.linalg.norm(p - proj, axis=1)
        return dist, t

    # Helper to compute joint weights for vertex array
    def compute_skin_weights(vertices, mesh_name):
        N = len(vertices)
        # We will compute scores for all joints
        scores = np.zeros((N, num_joints), dtype=np.float32)

        # 1. Segment-based distance field
        for name, j_start, j_end in bone_segments:
            p_start = joint_positions[j_start]
            p_end = joint_positions[j_end]
            dist, t = dist_to_segment(vertices, p_start, p_end)
            
            # Attenuation factor based on segment type
            sigma = 0.12
            if 'spine' in name or 'pelvis' in name:
                sigma = 0.18
            elif 'head' in name:
                sigma = 0.15
            elif 'arm' in name:
                sigma = 0.09
            elif 'leg' in name:
                sigma = 0.10

            w_seg = np.exp(- (dist ** 2) / (2 * (sigma ** 2)))

            # Distribute weight between start and end joint of segment
            scores[:, j_start] += w_seg * (1.0 - t)
            scores[:, j_end] += w_seg * t

        # Special overrides based on mesh name for flawless deformation
        m_lower = mesh_name.lower()
        if 'hat' in m_lower or 'feather' in m_lower:
            # 100% Head
            scores[:] = 0.0
            scores[:, j_head] = 1.0
        elif 'head' in m_lower:
            # Head + Neck
            head_dist = np.linalg.norm(vertices - joint_positions[j_head], axis=1)
            neck_dist = np.linalg.norm(vertices - joint_positions[j_neck], axis=1)
            scores[:] = 0.0
            scores[:, j_head] = np.exp(-head_dist / 0.15)
            scores[:, j_neck] = np.exp(-neck_dist / 0.15)
        elif 'shoe' in m_lower:
            # Feet and Ankles only
            scores[:] = 0.0
            l_mask = vertices[:, 0] >= 0
            r_mask = vertices[:, 0] < 0
            
            l_ankle_d = np.linalg.norm(vertices - joint_positions[j_l_ankle], axis=1)
            l_toe_d = np.linalg.norm(vertices - joint_positions[j_l_toe], axis=1)
            scores[l_mask, j_l_ankle] = np.exp(-l_ankle_d[l_mask] / 0.12)
            scores[l_mask, j_l_toe] = np.exp(-l_toe_d[l_mask] / 0.12)

            r_ankle_d = np.linalg.norm(vertices - joint_positions[j_r_ankle], axis=1)
            r_toe_d = np.linalg.norm(vertices - joint_positions[j_r_toe], axis=1)
            scores[r_mask, j_r_ankle] = np.exp(-r_ankle_d[r_mask] / 0.12)
            scores[r_mask, j_r_toe] = np.exp(-r_toe_d[r_mask] / 0.12)
        else:
            # Fallback if vertex has too low score: assign closest joint
            row_sums = scores.sum(axis=1)
            zero_mask = row_sums < 1e-4
            if np.any(zero_mask):
                kdtree = KDTree(joint_positions)
                _, nearest = kdtree.query(vertices[zero_mask])
                scores[zero_mask, nearest] = 1.0

        # Extract top 4 joints and normalized weights for glTF JOINTS_0 & WEIGHTS_0
        top4_joints = np.argsort(scores, axis=1)[:, -4:][:, ::-1] # (N, 4)
        top4_weights = np.take_along_axis(scores, top4_joints, axis=1) # (N, 4)
        
        # Normalize weights to sum to 1.0
        weight_sums = top4_weights.sum(axis=1, keepdims=True)
        weight_sums[weight_sums == 0] = 1.0
        top4_weights = top4_weights / weight_sums

        return top4_joints.astype(np.uint16), top4_weights.astype(np.float32)

    # 2. Extract Evil Joker meshes and transform them to match Arkham Joker frame
    # Evil Joker FBX transform matrix:
    m0 = np.array(evil_gltf.nodes[0].matrix, dtype=np.float32).reshape(4,4).T
    m1 = np.array(evil_gltf.nodes[1].matrix, dtype=np.float32).reshape(4,4).T
    # -90 deg rotation around Y to align facing from +X to +Z
    rot_y_neg90 = np.array([
        [0, 0, -1, 0],
        [0, 1, 0, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 1]
    ], dtype=np.float32)
    world_m = rot_y_neg90 @ m0 @ m1
    norm_m = np.linalg.inv(world_m[0:3, 0:3]).T

    # Helper to get accessor data from gltf
    def get_acc_bytes(gltf, acc_idx):
        acc = gltf.accessors[acc_idx]
        bv = gltf.bufferViews[acc.bufferView]
        data = gltf.binary_blob()
        offset = (bv.byteOffset or 0) + (acc.byteOffset or 0)
        type_count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[acc.type]
        item_size = {5126: 4, 5123: 2, 5121: 1, 5125: 4}[acc.componentType]
        byte_len = acc.count * type_count * item_size
        return data[offset:offset + byte_len]

    # Build new GLTF using Arkham Joker as the base (which already has full skeleton, materials, textures, buffers)
    # We will replace Arkham Joker's meshes with Evil Joker's rigged meshes!
    out_gltf = arkham_gltf

    # Keep all textures, materials, images, samplers from Evil Joker
    out_gltf.materials = evil_gltf.materials
    out_gltf.textures = evil_gltf.textures
    out_gltf.images = evil_gltf.images
    out_gltf.samplers = evil_gltf.samplers

    # Start binary buffer with Evil Joker's raw image data and buffers
    evil_blob = evil_gltf.binary_blob()
    arkham_blob = arkham_gltf.binary_blob()

    # In Arkham Joker, find the inverseBindMatrices accessor and bufferView
    ibm_acc = arkham_gltf.accessors[skin.inverseBindMatrices]
    ibm_bv = arkham_gltf.bufferViews[ibm_acc.bufferView]
    ibm_bytes = arkham_blob[ibm_bv.byteOffset : ibm_bv.byteOffset + ibm_bv.byteLength]

    # Create fresh buffers & bufferViews & accessors
    out_blob = bytearray()

    # 1. Add inverseBindMatrices
    ibm_offset = len(out_blob)
    out_blob.extend(ibm_bytes)
    # Pad to 4 bytes
    while len(out_blob) % 4 != 0:
        out_blob.append(0)

    out_gltf.bufferViews = []
    out_gltf.accessors = []

    bv_ibm = pygltflib.BufferView(
        buffer=0,
        byteOffset=ibm_offset,
        byteLength=len(ibm_bytes)
    )
    out_gltf.bufferViews.append(bv_ibm)
    ibm_acc.bufferView = 0
    ibm_acc.byteOffset = 0
    out_gltf.accessors.append(ibm_acc)
    out_gltf.skins[0].inverseBindMatrices = 0

    # 2. Add Evil Joker's images (bufferViews for embedded textures)
    for img in out_gltf.images:
        if img.bufferView is not None:
            old_bv = evil_gltf.bufferViews[img.bufferView]
            img_data = evil_blob[old_bv.byteOffset : old_bv.byteOffset + old_bv.byteLength]
            img_offset = len(out_blob)
            out_blob.extend(img_data)
            while len(out_blob) % 4 != 0:
                out_blob.append(0)
            
            new_bv_idx = len(out_gltf.bufferViews)
            out_gltf.bufferViews.append(pygltflib.BufferView(
                buffer=0,
                byteOffset=img_offset,
                byteLength=len(img_data)
            ))
            img.bufferView = new_bv_idx

    # 3. Process each mesh of Evil Joker, compute JOINTS_0 & WEIGHTS_0, and add to buffers
    out_gltf.meshes = []
    new_mesh_nodes = []

    for m_idx, mesh in enumerate(evil_gltf.meshes):
        new_prims = []
        for p_idx, prim in enumerate(mesh.primitives):
            # Indices
            ind_acc = evil_gltf.accessors[prim.indices]
            ind_bytes = get_acc_bytes(evil_gltf, prim.indices)
            ind_offset = len(out_blob)
            out_blob.extend(ind_bytes)
            while len(out_blob) % 4 != 0:
                out_blob.append(0)

            bv_ind_idx = len(out_gltf.bufferViews)
            out_gltf.bufferViews.append(pygltflib.BufferView(
                buffer=0,
                byteOffset=ind_offset,
                byteLength=len(ind_bytes),
                target=34963 # ELEMENT_ARRAY_BUFFER
            ))
            acc_ind_idx = len(out_gltf.accessors)
            new_ind_acc = pygltflib.Accessor(
                bufferView=bv_ind_idx,
                byteOffset=0,
                componentType=ind_acc.componentType,
                count=ind_acc.count,
                type=ind_acc.type,
                max=ind_acc.max,
                min=ind_acc.min
            )
            out_gltf.accessors.append(new_ind_acc)

            # Positions (transformed)
            pos_acc = evil_gltf.accessors[prim.attributes.POSITION]
            raw_pos = np.frombuffer(get_acc_bytes(evil_gltf, prim.attributes.POSITION), dtype=np.float32).reshape(-1, 3)
            h_pos = np.hstack([raw_pos, np.ones((len(raw_pos), 1), dtype=np.float32)])
            trans_pos = (h_pos @ world_m.T)[:, :3].astype(np.float32)

            pos_bytes = trans_pos.tobytes()
            pos_offset = len(out_blob)
            out_blob.extend(pos_bytes)
            while len(out_blob) % 4 != 0:
                out_blob.append(0)

            bv_pos_idx = len(out_gltf.bufferViews)
            out_gltf.bufferViews.append(pygltflib.BufferView(
                buffer=0,
                byteOffset=pos_offset,
                byteLength=len(pos_bytes),
                target=34962 # ARRAY_BUFFER
            ))
            acc_pos_idx = len(out_gltf.accessors)
            new_pos_acc = pygltflib.Accessor(
                bufferView=bv_pos_idx,
                byteOffset=0,
                componentType=5126,
                count=len(trans_pos),
                type='VEC3',
                max=trans_pos.max(axis=0).tolist(),
                min=trans_pos.min(axis=0).tolist()
            )
            out_gltf.accessors.append(new_pos_acc)

            # Normals (transformed)
            acc_norm_idx = None
            if prim.attributes.NORMAL is not None:
                raw_norm = np.frombuffer(get_acc_bytes(evil_gltf, prim.attributes.NORMAL), dtype=np.float32).reshape(-1, 3)
                trans_norm = (raw_norm @ norm_m.T)
                norm_lens = np.linalg.norm(trans_norm, axis=1, keepdims=True)
                norm_lens[norm_lens == 0] = 1.0
                trans_norm = (trans_norm / norm_lens).astype(np.float32)

                norm_bytes = trans_norm.tobytes()
                norm_offset = len(out_blob)
                out_blob.extend(norm_bytes)
                while len(out_blob) % 4 != 0:
                    out_blob.append(0)

                bv_norm_idx = len(out_gltf.bufferViews)
                out_gltf.bufferViews.append(pygltflib.BufferView(
                    buffer=0,
                    byteOffset=norm_offset,
                    byteLength=len(norm_bytes),
                    target=34962
                ))
                acc_norm_idx = len(out_gltf.accessors)
                out_gltf.accessors.append(pygltflib.Accessor(
                    bufferView=bv_norm_idx,
                    byteOffset=0,
                    componentType=5126,
                    count=len(trans_norm),
                    type='VEC3',
                    max=trans_norm.max(axis=0).tolist(),
                    min=trans_norm.min(axis=0).tolist()
                ))

            # Texture Coords (UVs)
            acc_uv_idx = None
            if prim.attributes.TEXCOORD_0 is not None:
                uv_acc = evil_gltf.accessors[prim.attributes.TEXCOORD_0]
                uv_bytes = get_acc_bytes(evil_gltf, prim.attributes.TEXCOORD_0)
                uv_offset = len(out_blob)
                out_blob.extend(uv_bytes)
                while len(out_blob) % 4 != 0:
                    out_blob.append(0)

                bv_uv_idx = len(out_gltf.bufferViews)
                out_gltf.bufferViews.append(pygltflib.BufferView(
                    buffer=0,
                    byteOffset=uv_offset,
                    byteLength=len(uv_bytes),
                    target=34962
                ))
                acc_uv_idx = len(out_gltf.accessors)
                out_gltf.accessors.append(pygltflib.Accessor(
                    bufferView=bv_uv_idx,
                    byteOffset=0,
                    componentType=uv_acc.componentType,
                    count=uv_acc.count,
                    type='VEC2',
                    max=uv_acc.max,
                    min=uv_acc.min
                ))

            # COMPUTE JOINTS_0 & WEIGHTS_0
            joints_data, weights_data = compute_skin_weights(trans_pos, mesh.name)

            # JOINTS_0 (uint16 VEC4)
            joints_bytes = joints_data.tobytes()
            joints_offset = len(out_blob)
            out_blob.extend(joints_bytes)
            while len(out_blob) % 4 != 0:
                out_blob.append(0)

            bv_joints_idx = len(out_gltf.bufferViews)
            out_gltf.bufferViews.append(pygltflib.BufferView(
                buffer=0,
                byteOffset=joints_offset,
                byteLength=len(joints_bytes),
                target=34962
            ))
            acc_joints_idx = len(out_gltf.accessors)
            out_gltf.accessors.append(pygltflib.Accessor(
                bufferView=bv_joints_idx,
                byteOffset=0,
                componentType=5123, # UNSIGNED_SHORT
                count=len(joints_data),
                type='VEC4'
            ))

            # WEIGHTS_0 (float32 VEC4)
            weights_bytes = weights_data.tobytes()
            weights_offset = len(out_blob)
            out_blob.extend(weights_bytes)
            while len(out_blob) % 4 != 0:
                out_blob.append(0)

            bv_weights_idx = len(out_gltf.bufferViews)
            out_gltf.bufferViews.append(pygltflib.BufferView(
                buffer=0,
                byteOffset=weights_offset,
                byteLength=len(weights_bytes),
                target=34962
            ))
            acc_weights_idx = len(out_gltf.accessors)
            out_gltf.accessors.append(pygltflib.Accessor(
                bufferView=bv_weights_idx,
                byteOffset=0,
                componentType=5126, # FLOAT
                count=len(weights_data),
                type='VEC4'
            ))

            # Assemble new primitive
            new_attrs = pygltflib.Attributes(
                POSITION=acc_pos_idx,
                NORMAL=acc_norm_idx,
                TEXCOORD_0=acc_uv_idx,
                JOINTS_0=acc_joints_idx,
                WEIGHTS_0=acc_weights_idx
            )
            new_prim = pygltflib.Primitive(
                attributes=new_attrs,
                indices=acc_ind_idx,
                material=prim.material
            )
            new_prims.append(new_prim)

        new_mesh = pygltflib.Mesh(name=mesh.name, primitives=new_prims)
        out_gltf.meshes.append(new_mesh)

    # 4. Remove old Arkham mesh nodes and create new mesh nodes attached to skin 0
    # In Arkham Joker, node 1..8 were mesh nodes
    # Let's see which nodes had meshes
    root_scene_nodes = []
    # Retain the main skeleton root node (node 0: Scene / Armature / bip01)
    # Arkham root skeleton is node 0 (GLTF_created_0 or Scene)
    # Add mesh nodes
    for m_idx, mesh in enumerate(out_gltf.meshes):
        node_idx = len(out_gltf.nodes)
        mesh_node = pygltflib.Node(
            name=mesh.name,
            mesh=m_idx,
            skin=0
        )
        out_gltf.nodes.append(mesh_node)
        new_mesh_nodes.append(node_idx)

    # Attach new mesh nodes to scene
    scene = out_gltf.scenes[out_gltf.scene or 0]
    # Filter scene nodes: keep skeleton root, add mesh nodes
    # Arkham Joker scene had nodes [0, 1, 2, 3, 4, 5, 6, 7]
    # Node 0 was GLTF_created_0 (contains the skeleton root node 8)
    scene.nodes = [0] + new_mesh_nodes

    # Update single buffer
    out_gltf.buffers = [pygltflib.Buffer(byteLength=len(out_blob))]
    out_gltf.set_binary_blob(bytes(out_blob))

    # Save to public/evil_joker_3d_model.glb
    out_gltf.save(src_evil)
    print(f"Successfully rigged Evil Joker with {len(out_gltf.meshes)} meshes and {num_joints} bones!")
    print(f"Saved to {src_evil}")

rig_evil_joker()
