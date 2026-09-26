"""Import selected user-supplied venue GLBs with shared, bounded PNG textures.

Usage: python import-completion.py /path/to/FRWF_Remaining_Assets_Complete.zip
Requires Pillow for texture resizing. Does not execute code from the archive.
"""
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'public/venue/completion'
PREFIX = 'FRWF_Asset_Completion/'
SELECTED = {'chair': 'PRP-001', 'table': 'PRP-002', 'trash': 'PRP-004', 'brickWall': 'ARC-001', 'column': 'ARC-010', 'beam': 'ARC-011', 'gate': 'HER-003', 'banner': 'HER-005', 'crate': 'PRP-007', 'workLight': 'PRP-011', 'bleachers': 'PRP-013', 'speakers': 'PRP-015'}
# Match the game's grip origin and table landing plane; meters, Y up.
TARGETS = {
    'brickWall': [[-2, 0, -.16], [2, 3.6, .16]],
    'column': [[-.18, 0, -.18], [.18, 4.2, .18]],
    'beam': [[-4.5, 0, -.16], [4.5, .32, .16]],
    'gate': [[-1.8, 0, -.12], [1.8, 2.8, .12]],
    'banner': [[-2.5, 0, -.04], [2.5, 1.6, .04]],
    'crate': [[-.8, 0, -.65], [.8, .9, .65]],
    'workLight': [[-.5, 0, -.5], [.5, 2.6, .5]],
    'bleachers': [[-3, 0, -1.3], [3, 2, 1.3]],
    'speakers': [[-.6, 0, -.5], [.6, 2.4, .5]],
    'chair': [[-.35, -.6, -.4], [.35, .65, .4]],
    'table': [[-1.5, -.9, -.65], [1.5, .065, .65]],
    'trash': [[-.46, -.59, -.46], [.46, .765, .46]],
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_glb(data):
    magic, version, size = struct.unpack_from('<III', data)
    assert magic == 0x46546C67 and version == 2 and size == len(data)
    length, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(data[20:20 + length])
    offset = 20 + length
    bin_length, kind = struct.unpack_from('<II', data, offset)
    assert kind == 0x004E4942
    return doc, data[offset + 8:offset + 8 + bin_length]


def write_glb(doc, binary):
    doc['buffers'] = [{'byteLength': len(binary)}]
    text = json.dumps(doc, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    binary += b'\0' * (-len(binary) % 4)
    return (struct.pack('<III', 0x46546C67, 2, 28 + len(text) + len(binary))
            + struct.pack('<II', len(text), 0x4E4F534A) + text
            + struct.pack('<II', len(binary), 0x004E4942) + binary)


def main(archive):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / 'textures').mkdir(exist_ok=True)
    assets = {}
    with zipfile.ZipFile(archive) as source:
        inventory = json.loads(source.read(PREFIX + 'evidence/new_inventory.json'))
        for key, asset_id in SELECTED.items():
            entry = next(a for a in inventory if a['id'] == asset_id)
            original = source.read(PREFIX + entry['path'])
            assert digest(original) == entry['sha256'], f'Source checksum mismatch: {asset_id}'
            doc, binary = read_glb(original)
            assert not doc.get('skins') and not doc.get('animations')
            image_views = {image['bufferView'] for image in doc['images']}
            for image in doc['images']:
                view = doc['bufferViews'][image.pop('bufferView')]
                start = view.get('byteOffset', 0)
                with Image.open(io.BytesIO(binary[start:start + view['byteLength']])) as texture:
                    texture.thumbnail((512, 512), Image.Resampling.LANCZOS)
                    encoded = io.BytesIO()
                    texture.save(encoded, format='PNG', optimize=True)
                    png = encoded.getvalue()
                uri = f'textures/{digest(png)[:20]}.png'
                (OUTPUT / uri).write_bytes(png)
                image['uri'] = uri
                image.pop('mimeType', None)
            # Remove embedded image payloads, maintaining accessor view indices.
            rebuilt = bytearray()
            views = []
            remap = {}
            for index, view in enumerate(doc['bufferViews']):
                if index in image_views:
                    continue
                remap[index] = len(views)
                start = view.get('byteOffset', 0)
                rebuilt.extend(b'\0' * (-len(rebuilt) % 4))
                views.append({**view, 'buffer': 0, 'byteOffset': len(rebuilt)})
                rebuilt.extend(binary[start:start + view['byteLength']])
            for accessor in doc['accessors']:
                assert 'sparse' not in accessor
                if 'bufferView' in accessor:
                    accessor['bufferView'] = remap[accessor['bufferView']]
            doc['bufferViews'] = views
            bounds = entry['bounds_m']
            target = TARGETS[key]
            scale = [(target[1][i] - target[0][i]) / (bounds[1][i] - bounds[0][i]) for i in range(3)]
            position = [target[0][i] - bounds[0][i] * scale[i] for i in range(3)]
            # Explicit simplified compound colliders, independent of async art loading.
            colliders = []
            for node in doc['nodes']:
                if 'mesh' not in node:
                    continue
                assert not any(k in node for k in ['matrix', 'translation', 'rotation', 'scale'])
                for primitive in doc['meshes'][node['mesh']]['primitives']:
                    accessor = doc['accessors'][primitive['attributes']['POSITION']]
                    lo, hi = accessor['min'], accessor['max']
                    colliders.append({
                        'center': [(lo[i] + hi[i]) * .5 * scale[i] + position[i] for i in range(3)],
                        'halfExtents': [max(.015, (hi[i] - lo[i]) * .5 * scale[i]) for i in range(3)]})
            optimized = write_glb(doc, bytes(rebuilt))
            name = f'{key}-{digest(optimized)[:12]}.glb'
            (OUTPUT / name).write_bytes(optimized)
            assets[key] = {'id': asset_id, 'url': f'/venue/completion/{name}', 'scale': scale,
                           'position': position, 'bounds': target, 'colliders': colliders,
                           'sourceSha256': digest(original), 'sha256': digest(optimized),
                           'sourceBytes': len(original), 'geometryBytes': len(optimized),
                           'triangles': entry['triangles'], 'warnings': entry['technical_warnings']}
        manifest = {'source': Path(archive).name, 'maxTextureSize': 512,
                    'riggedCharactersIncluded': False, 'assets': assets}
        (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({key: {'geometryBytes': a['geometryBytes'], 'triangles': a['triangles']} for key, a in assets.items()}, indent=2))


if __name__ == '__main__':
    main(sys.argv[1])
