# Combat motion assets

FRWF is an open-world wrestling game. These assets improve the physical wrestlers' movement; they do not replace the game with a video or a separately animated presentation rig.

The user supplied eleven FBX files in `Downloads/Combat` on September 8, 2026. The filenames identify Mixamo. The importer records each source filename, SHA-256, byte size, selected time interval and sample rate. It does not infer a capture performer, creator, or additional licensing terms from those filenames.

| Source | Used in the game |
| --- | --- |
| FightingIdle_mixamo.fbx | A three-second fighting stance, blended into supported idle |
| Boxing_mixamo.fbx | Separate right-hand and left-hand attack beats for jab and combination |
| BigFrontKick_mixamo.fbx | The chamber, extension and retraction of the front kick |
| RoundHouseKick_mixamo.fbx | The roundhouse's hip, shoulder and limb motion |
| ShadowBoxing_mixamo.fbx | Catalogued; not enabled |
| KnockOut_Loser_mixamo.fbx | Catalogued; not enabled |
| KnockOut_Winner_mixamo.fbx | Catalogued; not enabled |
| KnifeFight_mixamo.fbx, SwordFight_mixamo.fbx, SwordIdleLight_mixamo.fbx, SwordIdleMedium_mixamo.fbx | Catalogued; not enabled in unarmed wrestling |

Run `node tools/animations/import-combat.mjs /path/to/Combat` from the repository to regenerate `src/game/animation/generated/combat-motions.json`. Raw FBX files and their source meshes are not shipped to the browser. `inspect-combat.mjs` samples the source skeleton into a temporary JSON file for motion review.

The conversion excludes the source T-pose, extracts limb directions and bend planes, corrects source handedness, and projects elbows and knees onto the rig's legal hinge axes. Each attack's source contact beat is mapped to the game's anticipation, active and recovery windows. Shoulder rotations interpolate along quaternion arcs to avoid Euler wrap snaps. Captured translation is stripped; Rapier retains root movement, support, constraints and collision authority. The active attack blend is 65 percent, with a smaller blend on the support leg. These are retargeted physical pose targets, not lossless playback of the source animation.

The stance preserves planted legs and eases out of the starting pose. Throws and get-up motions still use the wrestling-specific controller; the knockout files are not being passed off as paired throws or recoveries. Further source clips need the same contact, stability and visual review before activation.

Validation includes source provenance, finite samples, hinge limits, neutral recovery, real solved strike contacts, closed-fist skin measurements, standing stability, and visible browser control journeys. Those checks are regression evidence, not a claim of finished animation quality or captured paired wrestling.
