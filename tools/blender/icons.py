# Blender: 3D-Icons für die Angebote-Leiste (Pizzastück, Cola-Dose, "12%").
# Aufruf (mit pip-Paket bpy): python icons.py <LilitaOne.ttf> <out_dir>
import bpy, bmesh, math, sys
from mathutils import Vector

FONT, OUT = sys.argv[-2], sys.argv[-1]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = 640
    sc.render.resolution_y = 640
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w')
    sc.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.85, 0.85, 0.85, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
    return sc


def mat(name, color, rough=0.35, coat=0.6, metal=0.0, sss=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = 0.15
    if sss:
        b.inputs['Subsurface Weight'].default_value = sss
    return m


def hexc(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def lights_camera(target=(0, 0, 0), dist=6.0, elev=28, azim=-25, lens=55):
    sc = bpy.context.scene
    def area(loc, energy, size, color=(1, 1, 1)):
        bpy.ops.object.light_add(type='AREA', location=loc)
        l = bpy.context.object
        l.data.energy = energy
        l.data.size = size
        l.data.color = color
        d = Vector(target) - l.location
        l.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    area((3, -4, 5), 900, 4)
    area((-4, -2, 2), 300, 5, (1, 0.95, 0.9))
    area((0, 4, 3), 500, 3)
    e, a = math.radians(elev), math.radians(azim)
    cam_loc = Vector(target) + Vector((dist * math.cos(e) * math.sin(a), -dist * math.cos(e) * math.cos(a), dist * math.sin(e)))
    bpy.ops.object.camera_add(location=cam_loc)
    cam = bpy.context.object
    cam.data.lens = lens
    cam.rotation_euler = (Vector(target) - cam_loc).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam


def smooth(obj, level=2):
    for p in obj.data.polygons:
        p.use_smooth = True
    m = obj.modifiers.new('sub', 'SUBSURF')
    m.levels = m.render_levels = level


def render(name):
    bpy.context.scene.render.filepath = f'{OUT}/{name}.png'
    bpy.ops.render.render(write_still=True)


# ---------- Pizzastück ----------
def pizza_slice():
    reset()
    ang = math.radians(42)
    R = 2.0
    steps = 24

    def sector(name, radius, z0, z1, material, inset=0.0):
        bm = bmesh.new()
        pts = [Vector((0.0 + inset * 1.8, 0, 0))]
        for i in range(steps + 1):
            t = -ang / 2 + ang * i / steps
            pts.append(Vector((radius * math.cos(t), radius * math.sin(t), 0)))
        bot = [bm.verts.new((p.x, p.y, z0)) for p in pts]
        top = [bm.verts.new((p.x, p.y, z1)) for p in pts]
        bm.faces.new(bot[::-1])
        bm.faces.new(top)
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((bot[i], bot[j], top[j], top[i]))
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
        ob.data.materials.append(material)
        bev = ob.modifiers.new('bev', 'BEVEL')
        bev.width = 0.04
        bev.segments = 4
        for p in ob.data.polygons:
            p.use_smooth = True
        return ob

    dough = mat('dough', hexc('#E7A955'), 0.55, 0.2)
    cheese = mat('cheese', hexc('#FBC531'), 0.3, 0.7, sss=0.1)
    salami = mat('salami', hexc('#C0392B'), 0.3, 0.7)
    olive = mat('olive', hexc('#1E1B18'), 0.2, 0.8)
    pepper = mat('pepper', hexc('#3E8E2F'), 0.3, 0.7)

    sector('dough', R, 0, 0.14, dough)
    sector('cheese', R - 0.22, 0.12, 0.2, cheese, inset=0.05)

    # Rand (Kruste) als gebogener Wulst entlang des Bogens
    curve = bpy.data.curves.new('crust', 'CURVE')
    curve.dimensions = '3D'
    sp = curve.splines.new('POLY')
    sp.points.add(steps)
    for i in range(steps + 1):
        t = -ang / 2 + ang * i / steps
        sp.points[i].co = ((R - 0.12) * math.cos(t), (R - 0.12) * math.sin(t), 0.16, 1)
    curve.bevel_depth = 0.17
    curve.bevel_resolution = 6
    curve.use_fill_caps = True
    crust = bpy.data.objects.new('crust', curve)
    bpy.context.collection.objects.link(crust)
    crust.data.materials.append(mat('crust', hexc('#D9893A'), 0.5, 0.3))

    for (r, t, s) in [(0.75, 0.0, 0.22), (1.35, 0.2, 0.24), (1.4, -0.21, 0.2)]:
        bpy.ops.mesh.primitive_cylinder_add(radius=s, depth=0.06, location=(r * math.cos(t), r * math.sin(t), 0.23))
        o = bpy.context.object; o.data.materials.append(salami); smooth(o, 1)
    for (r, t) in [(1.05, -0.12), (1.0, 0.16), (1.6, 0.0)]:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.035, location=(r * math.cos(t), r * math.sin(t), 0.24))
        o = bpy.context.object; o.data.materials.append(olive)
    for (r, t, rot) in [(0.5, 0.05, 0.6), (1.2, 0.02, -0.5)]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(r * math.cos(t), r * math.sin(t), 0.24))
        o = bpy.context.object; o.scale = (0.18, 0.05, 0.03); o.rotation_euler = (0, 0, rot)
        o.data.materials.append(pepper); smooth(o, 2)

    # gesamtes Stück leicht anheben und kippen
    bpy.ops.object.empty_add(location=(0, 0, 0))
    root = bpy.context.object
    for o in bpy.data.objects:
        if o != root and o.type in ('MESH', 'CURVE'):
            o.parent = root
            o.location.x -= 1.05
    root.rotation_euler = (math.radians(10), math.radians(-6), math.radians(215))
    lights_camera(target=(0, 0, 0.1), dist=3.6, elev=48, azim=-10, lens=50)
    render('pizza-stueck')


# ---------- Cola-Dose ----------
def cola_can():
    reset()
    red = mat('can_red', hexc('#D62828'), 0.25, 0.8, metal=0.3)
    silver = mat('silver', (0.75, 0.75, 0.78), 0.2, 0.3, metal=1.0)
    white = mat('white', (0.95, 0.95, 0.95), 0.3, 0.6)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.62, depth=2.0, location=(0, 0, 0))
    body = bpy.context.object; body.data.materials.append(red)
    bev = body.modifiers.new('bev', 'BEVEL'); bev.width = 0.08; bev.segments = 6
    for p in body.data.polygons: p.use_smooth = True
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.52, depth=0.16, location=(0, 0, 1.05))
    top = bpy.context.object; top.data.materials.append(silver)
    bev = top.modifiers.new('bev', 'BEVEL'); bev.width = 0.05; bev.segments = 4
    for p in top.data.polygons: p.use_smooth = True
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.55, depth=0.12, location=(0, 0, -1.03))
    bot = bpy.context.object; bot.data.materials.append(silver)
    for p in bot.data.polygons: p.use_smooth = True
    # Lasche
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.12, 1.14))
    tab = bpy.context.object; tab.scale = (0.16, 0.28, 0.02); tab.data.materials.append(silver); smooth(tab, 2)
    # weißer Schwung
    bpy.ops.object.empty_add(location=(0, 0, 0))
    root = bpy.context.object
    for o in (body, top, bot, tab):
        o.parent = root
    root.rotation_euler = (0, math.radians(8), 0)
    lights_camera(target=(0, 0, 0), dist=4.4, elev=16, azim=-20, lens=55)
    render('cola')


# ---------- "12%" ----------
def percent(text='12%'):
    reset()
    font = bpy.data.fonts.load(FONT)
    yellow = mat('yellow', hexc('#F9C015'), 0.3, 0.8)
    brown = mat('brown', hexc('#3A1C05'), 0.45, 0.4)

    def txt(name, offset, extrude, z, material):
        cu = bpy.data.curves.new(name, 'FONT')
        cu.body = text
        cu.font = font
        cu.size = 2.0
        cu.align_x = 'CENTER'
        cu.align_y = 'CENTER'
        cu.offset = offset
        cu.extrude = extrude
        cu.bevel_depth = 0.035
        cu.bevel_resolution = 4
        ob = bpy.data.objects.new(name, cu)
        bpy.context.collection.objects.link(ob)
        ob.location = (0, 0, z)
        ob.data.materials.append(material)
        return ob

    front = txt('front', 0.0, 0.16, 0.0, yellow)
    back = txt('back', 0.09, 0.2, -0.12, brown)
    bpy.ops.object.empty_add(location=(0, 0, 0))
    root = bpy.context.object
    front.parent = back.parent = root
    root.rotation_euler = (math.radians(90), 0, math.radians(-6))
    lights_camera(target=(0, 0, 0), dist=7.5, elev=10, azim=-18, lens=50)
    bpy.context.scene.render.resolution_x = 900
    bpy.context.scene.render.resolution_y = 520
    render('rabatt-12')


pizza_slice()
cola_can()
percent()
