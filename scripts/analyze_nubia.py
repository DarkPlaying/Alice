import pygltflib
import os

gltf = pygltflib.GLTF2().load('public/nubia__multiversus.glb')
print(f"Buffers: {len(gltf.buffers)}, BufferViews: {len(gltf.bufferViews)}, Accessors: {len(gltf.accessors)}")
print(f"Animations: {len(gltf.animations)}")
for i, anim in enumerate(gltf.animations):
    print(f"  Anim {i}: {anim.name}, Channels: {len(anim.channels)}, Samplers: {len(anim.samplers)}")

# Check size of accessors and buffer views for animations vs geometry
anim_bvs = set()
for anim in gltf.animations:
    for sampler in anim.samplers:
        input_acc = gltf.accessors[sampler.input]
        output_acc = gltf.accessors[sampler.output]
        if input_acc.bufferView is not None:
            anim_bvs.add(input_acc.bufferView)
        if output_acc.bufferView is not None:
            anim_bvs.add(output_acc.bufferView)

anim_bytes = sum(gltf.bufferViews[bv].byteLength for bv in anim_bvs)
print(f"Animation bufferViews total size: {anim_bytes / (1024*1024):.2f} MB")
