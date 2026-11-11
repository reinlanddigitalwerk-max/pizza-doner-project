# Eigener Keramikteller (salbeigrün, matt, gesprenkelt, unglasierter Rand) – Draufsicht mit Schatten, transparent.
import bpy, math, sys
AUS = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# Profil (r, z) – flache Mulde, weiche Wand, schmaler flacher Rand, außen nach unten
prof = [(0.0, 0.020), (0.55, 0.020), (0.70, 0.024), (0.78, 0.040), (0.845, 0.075), (0.885, 0.105), (0.905, 0.118),
        (0.935, 0.120), (0.955, 0.116), (0.962, 0.100), (0.950, 0.050), (0.900, 0.012), (0.80, 0.0), (0.0, 0.0)]
S = 128
verts, faces = [], []
for j in range(S):
    a = 2 * math.pi * j / S
    for r, z in prof:
        verts.append((r * math.cos(a), r * math.sin(a), z))
P = len(prof)
for j in range(S):
    for i in range(P - 1):
        a0, b0 = j * P + i, ((j + 1) % S) * P + i
        faces.append((a0, b0, b0 + 1, a0 + 1))
me = bpy.data.meshes.new('teller'); me.from_pydata(verts, [], faces); me.update()
ob = bpy.data.objects.new('teller', me); sc.collection.objects.link(ob)
for p in me.polygons: p.use_smooth = True
mod = ob.modifiers.new('glatt', 'SUBSURF'); mod.levels = 2; mod.render_levels = 2

# Material: Glasur nach Radius, Rand unglasiert, feine dunkle Sprenkel
m = bpy.data.materials.new('keramik'); m.use_nodes = True
nt = m.node_tree; n = nt.nodes; L = nt.links
bsdf = n['Principled BSDF']
def srgb(c): return tuple(((v / 255) / 12.92 if v / 255 <= .04045 else (((v / 255) + .055) / 1.055) ** 2.4) for v in c) + (1,)
tc = n.new('ShaderNodeTexCoord')
sep = n.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
mx = n.new('ShaderNodeMath'); mx.operation = 'MULTIPLY'; L.new(sep.outputs[0], mx.inputs[0]); L.new(sep.outputs[0], mx.inputs[1])
my = n.new('ShaderNodeMath'); my.operation = 'MULTIPLY'; L.new(sep.outputs[1], my.inputs[0]); L.new(sep.outputs[1], my.inputs[1])
sm = n.new('ShaderNodeMath'); sm.operation = 'ADD'; L.new(mx.outputs[0], sm.inputs[0]); L.new(my.outputs[0], sm.inputs[1])
rr = n.new('ShaderNodeMath'); rr.operation = 'SQRT'; L.new(sm.outputs[0], rr.inputs[0])
ramp = n.new('ShaderNodeValToRGB'); L.new(rr.outputs[0], ramp.inputs[0])
e = ramp.color_ramp.elements
e[0].position = 0.0; e[0].color = srgb((132, 160, 132))
e[1].position = 0.915; e[1].color = srgb((140, 168, 140))
e3 = e.new(0.93); e3.color = srgb((214, 194, 164))
e4 = e.new(1.0); e4.color = srgb((206, 186, 156))
# Sprenkel
no = n.new('ShaderNodeTexNoise'); no.inputs['Scale'].default_value = 420; no.inputs['Detail'].default_value = 2
sp = n.new('ShaderNodeValToRGB'); L.new(no.outputs['Fac'], sp.inputs[0])
sp.color_ramp.elements[0].position = .63; sp.color_ramp.elements[0].color = (1, 1, 1, 1)
sp.color_ramp.elements[1].position = .67; sp.color_ramp.elements[1].color = (.55, .52, .48, 1)
mul = n.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
L.new(ramp.outputs['Color'], mul.inputs[6]); L.new(sp.outputs['Color'], mul.inputs[7])
L.new(mul.outputs[2], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.62
ob.data.materials.append(m)

# Boden als Schattenfänger
bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
boden = bpy.context.active_object; boden.is_shadow_catcher = True

# Licht wie im Foto: weich von links oben
bpy.ops.object.light_add(type='AREA', location=(-2.2, 2.6, 3.4))
li = bpy.context.active_object; li.data.energy = 230; li.data.size = 3.6
li.rotation_euler = (math.radians(-38), math.radians(-30), 0)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.32

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.36; cam.location = (0, 0, 5); sc.camera = cam

sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 96
try:
    sc.cycles.use_denoising = True
except Exception:
    pass
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 1200
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.render.filepath = AUS
bpy.ops.render.render(write_still=True)
print('fertig', AUS)
