"""Bake the MPFB crowd library into a bounded, instanced GLB. Run after build-human-assets.mjs."""
import bpy, pathlib, json, hashlib
root=pathlib.Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'public/characters/crowd-source.glb'))
variants=[]
anatomy=json.loads((root/'assets/characters/mpfb/crowd-anatomy.json').read_text())
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH': continue
    triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
    modifier=obj.modifiers.new('Crowd triangle budget','DECIMATE')
    modifier.ratio=min(1,2200/max(1,triangles))
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    variants.append({'name':obj.name,**anatomy[obj.name],'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons)})
path=root/'public/characters/crowd-source.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_yup=True,export_animations=False,export_extras=False)
data=path.read_bytes(); digest=hashlib.sha256(data).hexdigest()
filename='crowd.'+digest[:12]+'.glb'
path.rename(path.with_name(filename))
manifest_path=root/'public/characters/manifest.json'
manifest=json.loads(manifest_path.read_text())
manifest['crowd']={'url':'/characters/'+filename,'sha256':digest,'bytes':len(data),'variants':variants}
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
print('CROWD',len(variants),'variants',len(data),'bytes',flush=True)
