# Dönerspieß aus dem Logo als Drehkörper rendern: 24 Bilder einer Umdrehung (Blender 5, bpy).
# Vorher: python3 tools/blender/spiess_vorbereiten.py  ·  Danach: python3 tools/blender/spiess_vorbereiten.py --blatt
import bpy, json, math, os
SP = os.path.dirname(os.path.abspath(__file__)) + '/spiess/'   # Arbeitsordner (Profil, Textur, Einzelbilder)
P = json.load(open(SP + 'profil.json'))
W, H, prof = P['W'], P['H'], P['prof']
YB, CB, TILT = P['yb'], P['cb'], P['tilt']
N = 24
S = 72            # Segmente rundum
SC = 0.01         # 1 Pixel = 0.01 Einheiten
UP = 3            # Renderauflösung = Bild × UP

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# Mesh: ein Ring je Bildzeile
verts, faces, uvs = [], [], []
rings = [p for p in prof if p[1] > 0]
for (y, rad, c) in rings:
    z = (YB - y) * SC
    for j in range(S + 1):
        th = 2 * math.pi * j / S
        verts.append((rad * SC * math.sin(th), -rad * SC * math.cos(th), z))
for i in range(len(rings) - 1):
    for j in range(S):
        a = i * (S + 1) + j
        b = a + 1
        c2 = a + (S + 1)
        d = c2 + 1
        faces.append((a, b, d, c2))
mesh = bpy.data.meshes.new('spiess')
mesh.from_pydata(verts, [], faces)
mesh.update()
uvl = mesh.uv_layers.new(name='UV')
for poly in mesh.polygons:
    for li in poly.loop_indices:
        vi = mesh.loops[li].vertex_index
        ring, j = divmod(vi, S + 1)
        y = rings[ring][0]
        uvl.data[li].uv = (j / S, 1 - (y + 0.5) / H)
for poly in mesh.polygons:
    poly.use_smooth = True
obj = bpy.data.objects.new('spiess', mesh)
scene.collection.objects.link(obj)
# Mitte der Achse im Bild: x = AXIS (Pixel); Objekt dort hinsetzen
obj.location = ((CB + 0.5 - W / 2) * SC, 0, (H - YB - 0.5) * SC)
obj.rotation_mode = 'ZYX'

mat = bpy.data.materials.new('fleisch')
mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
out = nt.nodes.new('ShaderNodeOutputMaterial')
em = nt.nodes.new('ShaderNodeEmission')
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = bpy.data.images.load(SP + 'textur.png')
tex.interpolation = 'Linear'
# Textur gilt rundum; vorne (u=0) soll die Bildmitte sein: Phase bei u=0 → sin(0)=0 → Mitte
nt.links.new(tex.outputs['Color'], em.inputs['Color'])
em.inputs['Strength'].default_value = 1.0
nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
obj.data.materials.append(mat)

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
scene.collection.objects.link(cam)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = max(W, H) * SC
cam.location = (0, -5, H / 2 * SC)
cam.rotation_euler = (math.pi / 2, 0, 0)
scene.camera = cam

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.cycles.use_denoising = False
scene.render.film_transparent = True
scene.render.resolution_x = W * UP
scene.render.resolution_y = H * UP
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'

os.makedirs(SP + 'frames', exist_ok=True)
for k in range(N):
    obj.rotation_euler = (0, TILT, 2 * math.pi * k / N)
    scene.render.filepath = SP + f'frames/f{k:02d}.png'
    bpy.ops.render.render(write_still=True)
print('fertig', N)
