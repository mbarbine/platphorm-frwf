# MPFB character integration

FRWF is a wrestling simulator. Character detail must preserve readable contact, grounded motion, and controllable recovery.

## Current status

MPFB 2.0.17 is an authoring candidate, not a browser runtime dependency. The official release describes seeded generation, body-part and material support, and game-engine material fixes: https://static.makehumancommunity.org/mpfb/releases/release_2017.html . Blender was not found on this workstation during this pass. No MPFB character has been exported or integrated.

The current generated humans use MakeHuman source geometry. They are fitted to the physics body schema. The renderer now converts solved world poses to bone-local transforms, including parent rotation and translation. Tests cover flat rigs, transformed parents, nested bones, and the existing shipping assets. This is compatibility groundwork; it does not make an arbitrary MPFB skeleton compatible.

## Required export contract

- Metres, +Y up, +Z facing forward; apply object transforms before export.
- Map the 16 physics segment IDs from `src/game/physics/bodySchema.ts` exactly. Their transforms describe segment centres, not conventional joint pivots. A raw Blender armature needs an explicit bind-offset adapter or rebaking onto this skeleton.
- Process mapped parents before children. Retain unmapped detail bones only with deliberately authored inherited/rest poses; do not let another animation mixer overwrite solved contact poses.
- Use an upright rest pose with `head`, `leftFoot`, and `rightFoot` landmarks. The fitter measures their world-space span. Uniform scale is covered; nonuniform scale and sheared hierarchies are not supported by the quaternion pose adapter.
- Bake skin, normal, roughness, and beard detail for glTF materials. Keep original high-detail source files outside runtime bundles. Record source provenance and redistribution terms for each asset.
- Preserve authored Dale height (6 ft 4 in), weight (225 lb), beard and identity, and Chad likeness. Fit appearance to physical dimensions rather than enlarging the render mesh independently of contact.

## Next acceptance sequence

1. Export one clothed wrestler, verify axis, bind offsets, proportions and material loading in a neutral viewer.
2. Compare rest, backward walk, guard, uppercut, kick extension, paired lift, slam landing and get-up against the same physics snapshots. Require visible contact alignment and no persistent penetration or distorted limbs.
3. Produce lower-detail meshes/materials from the accepted source. Measure actual frame time and memory in a full Battle Royale on desktop and mobile before choosing budgets.
4. Replace additional wrestlers only after the first model passes the ordinary-control match and recovery scenarios. Keep the existing working asset available until then.

The underground v4 venue audit is recorded in `docs/assets/underground-v4-audit.json`. Its ring size/deck height differs from the current venue; collision and navigation must be aligned before runtime activation. It is inspected, not integrated.
