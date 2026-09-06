import os
import pygltflib

def analyze_glb(path):
    size_bytes = os.path.getsize(path)
    gltf = pygltflib.GLTF2().load(path)
    raw_buffer_data = gltf.binary_blob()
    
    img_bvs = set()
    img_bytes = 0
    for img in gltf.images:
        if img.bufferView is not None:
            img_bvs.add(img.bufferView)
            img_bytes += gltf.bufferViews[img.bufferView].byteLength

    geo_bytes = len(raw_buffer_data) - img_bytes

    print(f"\n==============================================")
    print(f"File: {path}")
    print(f"Total Size: {size_bytes / 1024:.1f} KB ({size_bytes / (1024*1024):.2f} MB)")
    print(f"Images count: {len(gltf.images)}, Image data: {img_bytes / 1024:.1f} KB")
    print(f"Geometry / Other buffer data: {geo_bytes / 1024:.1f} KB")
    print(f"Meshes: {len(gltf.meshes)}, Nodes: {len(gltf.nodes)}, Animations: {len(gltf.animations)}")

if __name__ == '__main__':
    for root, dirs, files in os.walk('public'):
        for f in files:
            if f.endswith('.glb'):
                full_p = os.path.join(root, f)
                analyze_glb(full_p)
