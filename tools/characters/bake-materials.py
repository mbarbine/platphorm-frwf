"""Bake licensed MakeHuman skin and anatomical ring-gear masks into shared-UV game textures.
Requires Python, numpy and Pillow. Run after MPFB export; no generated body is downloaded.
"""
from pathlib import Path
import json,gzip,hashlib,subprocess,argparse
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[2]
source=root/'assets/characters'
recipes=json.loads((root/'tools/characters/phenotypes.json').read_text())
rig=json.loads((source/'makehuman/default.mhskel').read_text())
weights=json.loads((source/'makehuman/default_weights.mhw').read_text())['weights']
uv=[];faces=[];group=''
for line in (source/'makehuman/base.obj').read_text().splitlines():
    a=line.split()
    if not a:continue
    if a[0]=='vt':uv.append(list(map(float,a[1:3])))
    if a[0]=='g':group=a[1]
    if a[0]=='f' and group=='body':
        corners=[tuple(int(n)-1 for n in v.split('/')[:2]) for v in a[1:]]
        for i in range(1,len(corners)-1):faces.append([corners[0],corners[i],corners[i+1]])
uv=np.array(uv);regions=np.zeros(19158);maximum=np.zeros(19158)
for name,entries in weights.items():
    region=1 if name.startswith(('spine','pelvis','root','upperleg','breast','clavicle','shoulder')) else 2 if name.startswith(('upperarm','lowerarm')) else 3 if name.startswith(('foot','toe','lowerleg')) else 0
    for i,w in entries:
        if w>maximum[i]:maximum[i]=w;regions[i]=region
fighters=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import { FIGHTERS } from './src/game/data/fighters.ts'; console.log(JSON.stringify(FIGHTERS));"],cwd=root))
palettes={f['id']:(f['palette']['secondary'],f['palette']['primary']) for f in fighters}
color=lambda c: np.array([int(c[i:i+2],16) for i in (1,3,5)],dtype=float)
parser=argparse.ArgumentParser();parser.add_argument('--fighter',choices=list(recipes));args=parser.parse_args()
material_file=root/'public/characters/materials.json'
result=json.loads(material_file.read_text()) if args.fighter and material_file.exists() else {}
N=1024
for name,recipe in recipes.items():
    if args.fighter and name!=args.fighter:continue
    points=np.array(json.loads(gzip.decompress((source/f'mpfb/{name}.json.gz').read_bytes())))
    def joint(bone,end):return points[rig['joints'][rig['bones'][bone][end]]].mean(axis=0)
    waist=joint('spine04','head')[1]+.25
    knee=joint('lowerleg01.L','head')[1]
    hem=knee+(.9 if name=='chad' else 1.9)
    skin='middleage_african_male/middleage_darkskinned_male_diffuse.png' if name in ('atlas','vex','brick') else 'young_caucasian_male/young_lightskinned_male_diffuse.png'
    if name=='gil': skin='young_caucasian_female/young_lightskinned_female_diffuse.png'
    image=np.array(Image.open(source/'mpfb/system/skins'/skin).convert('RGB').resize((N,N)),dtype=float)
    gear,trim=map(color,palettes[name]);ink=color('#273330')
    for face in faces:
        vi=np.array([v[0] for v in face]);uvs=uv[[v[1] for v in face]]*np.array([N-1,-(N-1)])+np.array([0,N-1])
        lo=np.maximum(0,np.floor(uvs.min(axis=0)).astype(int));hi=np.minimum(N-1,np.ceil(uvs.max(axis=0)).astype(int))
        x,y=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1))
        a,b,c=uvs;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den)<1e-8:continue
        w0=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den
        w1=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den
        w2=1-w0-w1;inside=(w0>=-.005)&(w1>=-.005)&(w2>=-.005)
        xyz=w0[...,None]*points[vi[0]]+w1[...,None]*points[vi[1]]+w2[...,None]*points[vi[2]]
        region=regions[vi[np.argmax(np.stack([w0,w1,w2],axis=-1),axis=-1)]]
        px,py,pz=xyz[...,0],xyz[...,1],xyz[...,2]
        shorts=(region==1)&(py<waist)&(py>hem)
        pads=(region==3)&(abs(py-knee)<.8)
        boots=(region==3)&(py<knee-1.5)
        pixels=image[y,x].copy(); fabric=.96+.04*np.sin(x*2)*np.sin(y*2)
        pixels[shorts]=(gear[None,:]*fabric[shorts,None])
        edging=shorts&((py>waist-.22)|(py<hem+.1))
        pixels[edging]=trim
        pixels[pads|boots]=color('#1a1d22')
        clothed=('sonny','steve','wrecking_ball','john','justin','mondo','gil','chad','dale')
        if name in clothed:
            shoulder=joint('head','head')[1]-.9
            shirt=(region==1)&(py>=waist-.15)&(py<shoulder)
            sleeves=(region==2)&(py>waist+.85)
            if name in ('chad','justin'): sleeves=np.zeros_like(sleeves)
            if name=='gil': sleeves=(region==2)
            torso=shirt|sleeves
            shade={'sonny':'#a5a49e','steve':'#dad6cd','wrecking_ball':'#23272a','chad':'#e5e2d7'}.get(name,'#232724')
            pixels[torso]=color(shade)[None,:]*fabric[torso,None]
            if name in ('steve','wrecking_ball','dale'):
                vest=torso&(abs(px)>(.95 if name=='wrecking_ball' else .68))&(region==1)
                vest &= py < shoulder-.25
                pixels[vest]=color('#c1af86' if name=='wrecking_ball' else '#292c31')
            trousers=((region==1)|(region==3))&(py<waist)
            pixels[trousers]=color('#b6aa8d' if name=='wrecking_ball' else '#252a2c')
            if name=='gil':
                shorts=(region==1)&(py<waist)&(py>knee+2.5)
                bare=(region==1)&(py<=knee+2.5)&(py>knee-.2)
                pixels[bare]=image[y,x][bare]
                pixels[shorts]=color('#697d91')[None,:]*fabric[shorts,None]
                pixels[(region==3)]=color('#202022')
            if name=='justin':
                bib=(py<shoulder-1.3)&(abs(px)<1.18)
                straps=(abs(abs(px)-.72)<.08)&(py<shoulder-.1)
                apron=shirt&(bib|straps)&(pz>0)
                pixels[shirt&~apron]=image[y,x][shirt&~apron]
                pixels[apron]=color('#1d201f')
            if name=='dale':
                camo=torso&~((abs(px)>.68)&(region==1))
                fleck=np.sin(px*5+py*3)+np.cos(py*6+pz*4)
                pixels[camo]=color('#7d8059')
                pixels[camo&(fleck>.4)]=color('#434d35')
                pixels[camo&(fleck<-.5)]=color('#aaa17b')
            if name=='mondo':
                wave=np.sin(np.sqrt((px*.6)**2+((py-waist-1.8)*.55)**2)*9+np.sin(px*3)*.5)
                for lower,upper,tone in [(-2,-.6,'#62bcb4'),(-.6,0,'#d65885'),(0,.55,'#e8873c'),(.55,2,'#e5d451')]:
                    pixels[torso&(wave>=lower)&(wave<upper)]=color(tone)
                # A mushroom emblem on the front, in the same anatomical UV bake.
                cap=shirt&(pz>0)&((px/1.05)**2+((py-waist-1.5)/.48)**2<1)&(py>waist+1.5)
                stem=shirt&(pz>0)&(abs(px)<.16)&(py>waist+.5)&(py<waist+1.6)
                pixels[cap]=color('#ddc957');pixels[stem]=color('#b5b78a')
            if name=='chad':
                front=shirt&(pz>0)
                palm=front&((px/.4)**2+((py-waist-1.3)/.35)**2<1)
                fingers=front&(py>waist+1.3)&(py<waist+2)&(abs(px)<.4)&(np.cos(px*24)>.05)
                pixels[palm|fingers]=color('#202624')
        if recipe['tattoo']!='none':
            area=(region==2)&((px>0) if recipe['tattoo']=='shoulder' else (py<waist+1.5))
            mark=area&(np.sin(py*7+pz*6)>0)&~shorts
            pixels[mark]=pixels[mark]*.18+ink*.82
        image[y[inside],x[inside]]=pixels[inside]
    image[-3:,:3]=255
    out=Image.fromarray(np.uint8(np.clip(image,0,255)))
    path=root/'public/characters'/f'{name}-skin.webp';out.save(path,quality=94,method=6)
    digest=hashlib.sha256(path.read_bytes()).hexdigest();filename=f'{name}-skin.{digest[:12]}.webp';path.rename(path.with_name(filename))
    result[name]={'skinUrl':'/characters/'+filename,'sha256':digest, 'hairUrl':None}
    if recipe.get('hair'):
        style=recipe['hair']
        hair=Image.open(source/f'mpfb/system/hair/{style}/{style}_diffuse.png').convert('RGBA').resize((512,512))
        if name=='thomas':
            pixels=np.array(hair); luminance=pixels[:,:,:3].mean(axis=2)/255
            pixels[:,:,:3]=np.uint8(np.clip((.45+luminance[:,:,None]*.7)*np.array([202,174,109]),0,255));hair=Image.fromarray(pixels)
            style='long01-blonde'
        path=root/'public/characters'/f'{style}.webp';hair.save(path,lossless=True,method=6)
        h=hashlib.sha256(path.read_bytes()).hexdigest();filename=f'{style}.{h[:12]}.webp';path.rename(path.with_name(filename));result[name]['hairUrl']='/characters/'+filename
    print('MATERIAL',name,flush=True)
(root/'public/characters/materials.json').write_text(json.dumps(result,indent=2)+'\n')provisional=json.loads((root/'tools/characters/provisional-models.json').read_text())
for name,source_name in provisional.items():
    if source_name in result: result[name]=dict(result[source_name])

