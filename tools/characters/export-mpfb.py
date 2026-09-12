"""Run with Blender --background --factory-startup --python-exit-code 1 --python this.py -- /path/to/mpfb2/src.
MPFB 2.0.17 authors phenotypes; the JS exporter binds them to FRWF's contact skeleton.
No Blender preferences are saved. Set BLENDER_USER_RESOURCES to an isolated build directory.
"""
import bpy, addon_utils, sys, pathlib, json, random, gzip, hashlib
root = pathlib.Path(__file__).resolve().parents[2]
source = pathlib.Path(sys.argv[sys.argv.index('--') + 1]).resolve()
package_root = pathlib.Path(bpy.utils.user_resource('CONFIG')).parent / 'frwf_extensions'
package_root.mkdir(parents=True, exist_ok=True)
if not (package_root / 'mpfb').exists():
    (package_root / 'mpfb').symlink_to(source / 'mpfb', target_is_directory=True)
bpy.context.preferences.extensions.repos.new(name='FRWF Authoring', module='frwf_authoring', custom_directory=str(package_root))
addon_utils.enable('bl_ext.frwf_authoring.mpfb', default_set=True)
from bl_ext.frwf_authoring.mpfb import VERSION
from bl_ext.frwf_authoring.mpfb.services.humanservice import HumanService
from bl_ext.frwf_authoring.mpfb.services.targetservice import TargetService
from bl_ext.frwf_authoring.mpfb.services.randomizationservice import RandomizationService
assert VERSION == (2, 0, 17), VERSION
profiles = json.loads((root / 'tools/characters/phenotypes.json').read_text())
output = root / 'assets/characters/mpfb'
output.mkdir(parents=True, exist_ok=True)
manifest = {'version': '.'.join(map(str, VERSION)), 'blender': bpy.app.version_string,
    'revision': '80919fa4682335c41847f761a4d79dcad4124732',
    'source': 'https://github.com/makehumancommunity/mpfb2', 'license': 'CC0-1.0', 'characters': []}
spec = RandomizationService.get_default_phenotype_spec()
spec['phenotype']['discrete_age'] = False
spec['phenotype']['attributes']['age'].update(neutral=0.5, deviation=0.2)
spec['phenotype']['attributes']['weight']['deviation'] = 0.4
spec['phenotype']['attributes']['muscle']['deviation'] = 0.35
for index in range(12):
    seed = 9122026 + index * 7919
    profiles['crowd-' + str(index)] = dict(RandomizationService.randomize_macro_info_dict(spec, random.Random(seed)), seed=seed)
for name, recipe in profiles.items():
    macro = TargetService.get_default_macro_info_dict()
    macro.update({key: value for key, value in recipe.items() if key in macro})
    body = HumanService.create_human(mask_helpers=False, feet_on_ground=False, scale=1, macro_detail_dict=macro)
    if not name.startswith('crowd-'):
        strength = recipe['muscle'] * (0.45 if name == 'brick' else 0.85)
        detail_targets = ['torso/torso-muscle-pectoral-incr', 'torso/torso-muscle-dorsi-incr', 'stomach/stomach-tone-incr']
        for side in ['l', 'r']:
            detail_targets.extend(['arms/'+side+'-upperarm-muscle-incr', 'arms/'+side+'-upperarm-shoulder-muscle-incr', 'legs/'+side+'-upperleg-muscle-incr'])
        if name == 'wrecking_ball': detail_targets = ['stomach/stomach-tone-decr']
        for target in detail_targets:
            TargetService.load_target(body, str(source/'mpfb/data/targets'/ (target+'.target.gz')), weight=strength)
    bpy.context.view_layer.update()
    mesh = body.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
    # Undo Blender's OBJ import rotation, preserving MakeHuman vertex indices and joint helpers.
    points = [[round(v.co.x, 6), round(v.co.z, 6), round(-v.co.y, 6)] for v in mesh.vertices]
    assert len(points) == 19158, (name, len(points))
    encoded = json.dumps(points, separators=(',', ':')).encode()
    (output / (name + '.json.gz')).write_bytes(gzip.compress(encoded, mtime=0))
    manifest['characters'].append({'id': name, 'phenotype': macro, 'seed': recipe.get('seed'), 'sha256': hashlib.sha256(encoded).hexdigest()})
    body.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
    if recipe.get('hair'):
        hairstyle = recipe['hair']
        asset = output/'system/hair'/hairstyle/(hairstyle+'.mhclo')
        hair = HumanService.add_mhclo_asset(str(asset), body, asset_type='Hair', subdiv_levels=0, set_up_rigging=False, interpolate_weights=False, import_subrig=False, import_weights=False)
        bpy.context.view_layer.update()
        evaluated = hair.evaluated_get(bpy.context.evaluated_depsgraph_get()); hm = evaluated.to_mesh(); hm.calc_loop_triangles()
        geometry={'style':hairstyle, 'positions':[], 'uv':[]}
        for triangle in hm.loop_triangles:
            for loop in triangle.loops:
                co=hair.matrix_world @ hm.vertices[hm.loops[loop].vertex_index].co
                geometry['positions'].append([round(co.x,6),round(co.z,6),round(-co.y,6)])
                geometry['uv'].append(list(hm.uv_layers.active.data[loop].uv))
        (output/(name+'-hair.json.gz')).write_bytes(gzip.compress(json.dumps(geometry).encode(),mtime=0))
        evaluated.to_mesh_clear(); bpy.data.objects.remove(hair,do_unlink=True)

    bpy.data.objects.remove(body, do_unlink=True)
    print('EXPORTED', name, len(points), flush=True)
(output / 'provenance.json').write_text(json.dumps(manifest, indent=2) + '\n')
