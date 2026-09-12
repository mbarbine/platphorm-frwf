# MPFB character integration

FRWF is a wrestling simulator. Character detail must preserve contact, grounded movement and controllable recovery.

## Implemented authoring path

MPFB **2.0.17** ran in isolated **Blender 4.5.9 LTS** during the September 12, 2026 pass. The exported roster now uses MPFB macro and muscle targets, fitted MPFB hair, MakeHuman skin UVs, and baked clothing materials. Twelve additional bodies were generated with MPFB's seeded randomization service and decimated into an instanced crowd library. MPFB is an offline authoring tool, not a browser dependency.

- Recipes: `tools/characters/phenotypes.json`.
- Exported, compressed source coordinates and provenance: `assets/characters/mpfb/`.
- Runtime geometry, content hashes, authoring versions and crowd budgets: `public/characters/manifest.json`.
- Baked skin/hair texture URLs and hashes: `public/characters/materials.json`.
- User-provided reference photographs: `assets/references/frwf-originals/`.
- Display copies of individual wrestler photographs: `public/portraits/`.

The source revision is `80919fa4682335c41847f761a4d79dcad4124732` from the official MPFB 2.0.17 tag. The body coordinates preserve MakeHuman vertex indices so the exporter can transfer the canonical source weights. This is an executed pipeline, replacing the earlier authoring proposal.

## Rebuild

Install Blender 4.5 LTS, Node 26, Python with numpy/Pillow, and the official MPFB 2.0.17 source. Set `BLENDER_USER_RESOURCES` to a temporary directory so authoring does not change the artist's Blender preferences. From the repository root:

```sh
"$FRWF_BLENDER" --background --factory-startup --python-exit-code 1 --python tools/characters/export-mpfb.py -- "$FRWF_MPFB_SOURCE/src"
node tools/characters/build-human-assets.mjs
"$FRWF_BLENDER" --background --factory-startup --python-exit-code 1 --python tools/characters/optimize-crowd.py
python tools/characters/bake-materials.py
pnpm verify
```

`bake-materials.py --fighter justin` rebuilds one wrestler's material. Full source export produces 14 wrestler bodies and 12 crowd variants. The deterministic crowd seed starts at 9122026; each variant advances by 7919. Runtime population groups contain 3–6 fans, with gaps and bounded seeded variation in scale, facing and reaction timing. Crowd population is capped at 320; meshes use roughly 2,200 triangles per variant. This is standing audience variation, not autonomous navigation or articulated crowd mocap.

## Runtime contract

- Metres, +Y up, +Z forward. Blender OBJ import rotation is explicitly reversed before binding.
- Sixteen physical segment-centre bones plus thirty finger bones. The physics solver owns contact poses. A raw MPFB armature still needs conversion; arbitrary imported rigs are not supported automatically.
- Hair uses the exported head landmark and inherits the same solved head bone.
- Source UVs are split at seams. Clothing is baked in anatomical coordinates, preserving the skin material elsewhere. Instance geometry and material ownership are isolated; cached textures are shared.
- Dale retains the user-provided 6′4″ / 225 lb dimensions. Other newly authored physical dimensions are gameplay estimates, not verified biographies.
- Portraits use one live renderer alongside original photos. The four fictional wrestlers and Thomas have no supplied individual photo; the selection UI does not invent one.

## Sources and limitations

Official release: https://static.makehumancommunity.org/mpfb/releases/release_2017.html
Body parts: https://static.makehumancommunity.org/mpfb/docs/characters/bodyparts.html
Batch randomization: https://static.makehumancommunity.org/mpfb/docs/randomization/batch.html
System assets and CC0 terms: https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html

The real photographs guide body build, hair, facial hair, glasses, masks, headwear and clothing. These are authored interpretations, not facial scans or exact likeness certification. Clothing currently follows the body skin; loose jackets, apron drape, hair simulation, fine facial sculpting, dedicated normal/roughness maps and production art review remain unfinished. Thomas's Spine Buster uses the paired spine-buster choreography. Additional invented game finisher names are not claims about real historical signatures. Motion capture is not included.

Acceptance still requires normal-speed bouts, backward/sideways travel, uppercuts, kicks, paired lift/landing/get-up review, and actual mobile/XR performance measurements. The underground v4 venue remains an inspected asset with different collision dimensions; this pass does not activate it.
