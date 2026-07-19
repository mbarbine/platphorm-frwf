# RINGFALL Canonical Skeleton — Wrestling Humanoid

**Status: DRAFT** — Finalize before any mocap capture or character rigging.

## Overview

All RINGFALL wrestlers share one canonical humanoid skeleton.
Character differences are expressed through mesh, proportions, skinning, and materials.
Do not use an incompatible hierarchy for any fighter.

---

## Coordinate System

| Axis | Direction        |
|------|-----------------|
| Y    | Up              |
| -Z   | Forward (character faces -Z at rest) |
| X    | Right           |

- Unit scale: **1 unit = 1 metre**
- Reference pose: **A-Pose** (arms at ~45° abduction, palms down)

---

## Joint Hierarchy

```
Root (world anchor, translate + rotate)
└── Hips
    ├── Spine
    │   ├── Spine1
    │   │   └── Spine2
    │   │       ├── Neck
    │   │       │   └── Head
    │   │       ├── LeftShoulder
    │   │       │   └── LeftUpperArm
    │   │       │       └── LeftForeArm
    │   │       │           └── LeftHand
    │   │       └── RightShoulder
    │   │           └── RightUpperArm
    │   │               └── RightForeArm
    │   │                   └── RightHand
    ├── LeftUpLeg
    │   └── LeftLeg
    │       └── LeftFoot
    │           └── LeftToeBase
    └── RightUpLeg
        └── RightLeg
            └── RightFoot
                └── RightToeBase
```

Optional twist bones (for skinning quality):
- `LeftUpperArmRoll`, `RightUpperArmRoll`
- `LeftForeArmRoll`, `RightForeArmRoll`
- `LeftUpLegRoll`, `RightUpLegRoll`

---

## Bone Count Budget

| Region        | Bones |
|--------------|-------|
| Spine chain  | 5     |
| Head/neck    | 2     |
| Arms (each)  | 5     |
| Legs (each)  | 4     |
| **Total**    | **25 (+ optional twists)** |

---

## Prop Sockets

| Socket name   | Bone parent  | Offset       |
|--------------|-------------|-------------|
| `prop_right` | RightHand   | palm centre  |
| `prop_left`  | LeftHand    | palm centre  |

---

## Fighter Proportions

Fighter differences are achieved through:
1. Non-uniform bone scale on the mesh skeleton
2. Separate physics profile (mass, reach, etc.) in `fighters.ts`
3. Per-fighter animation offsets where motion-matching weight differs

Do **not** add or remove bones per fighter.

---

## Rapier Body Mapping

| Rapier body segment  | Skeleton bone     |
|--------------------|------------------|
| `pelvis`           | Hips              |
| `abdomen`          | Spine1            |
| `chest`            | Spine2            |
| `head`             | Head              |
| `leftUpperArm`     | LeftUpperArm      |
| `rightUpperArm`    | RightUpperArm     |
| `leftForearm`      | LeftForeArm       |
| `rightForearm`     | RightForeArm      |
| `leftHand`         | LeftHand          |
| `rightHand`        | RightHand         |
| `leftThigh`        | LeftUpLeg         |
| `rightThigh`       | RightUpLeg        |
| `leftShin`         | LeftLeg           |
| `rightShin`        | RightLeg          |
| `leftFoot`         | LeftFoot          |
| `rightFoot`        | RightFoot         |

---

## Retargeting Requirements

When retargeting external mocap onto this skeleton:
1. Validate unit scale (source must be in metres or rescaled)
2. Validate axis alignment (-Z forward, Y up)
3. Apply reference-pose correction matrix per bone
4. Verify feet land at Y=0 in neutral stand
5. Verify hands reach each other at neutral grip distance
6. Run the retargeting validation suite: `pnpm mocap:validate`

---

## Revision

| Version | Date       | Change               |
|---------|-----------|----------------------|
| 0.1     | 2026-07-14 | Initial draft        |
