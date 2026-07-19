# RINGFALL Mocap Capture Plan

**Status: PLANNING** — No live sessions have been conducted.

---

## Guiding Principle

> Capture movement intent with a trained athlete in a safe environment.  
> Physics validates consequence. Rules preserve playability.  
> Do not ask performers to create real impact for game data.

---

## Studio Requirements

- Volume with ≥ 12 cameras (optical preferred, inertial acceptable for locomotion)
- 6m × 6m clear capture zone
- Crash mats for falls
- Stunt coordinator for aerial/slam sequences
- Neutral costume (no metallic accents, no loose fabric)
- Matching costume for paired performer

---

## Capture Categories

### 1. Locomotion (solo)

| Clip ID             | Description                   | Loop |
|--------------------|-------------------------------|------|
| `idle_neutral`     | Standing, calm                | ✓    |
| `idle_combat`      | Crouched guard stance         | ✓    |
| `walk_forward`     | Slow approach                 | ✓    |
| `walk_backward`    | Step back                     | ✓    |
| `strafe_left`      | Lateral shuffle left          | ✓    |
| `strafe_right`     | Lateral shuffle right         | ✓    |
| `run_forward`      | Athletic sprint               | ✓    |
| `brake_stop`       | Deceleration stop             |      |
| `pivot_180`        | Fast 180° turn                |      |
| `limp`             | Fatigued walk                 | ✓    |
| `climb_lower`      | Step to second rope           |      |
| `climb_top`        | Reach top turnbuckle          |      |

### 2. Strikes (solo)

| Clip ID         | Description                           |
|----------------|---------------------------------------|
| `jab`          | Right jab                             |
| `cross`        | Left cross                            |
| `hook_right`   | Right hook                            |
| `hook_left`    | Left hook                             |
| `uppercut`     | Rising uppercut                       |
| `low_kick`     | Front leg low kick                    |
| `front_kick`   | Piston front kick                     |
| `high_kick`    | Sidekick to head height               |
| `roundhouse`   | Spinning roundhouse                   |
| `headbutt`     | Short-range headbutt                  |
| `ground_stomp` | Stomp on fallen opponent (mime)       |

### 3. Defense (solo)

| Clip ID       | Description                      |
|--------------|----------------------------------|
| `guard_up`   | Raise guard, hold                |
| `dodge_back` | Step back dodge                  |
| `dodge_left` | Slip left                        |
| `dodge_right`| Slip right                       |
| `counter`    | Parry + return shot              |

### 4. Grapple — **CAPTURE BOTH PERFORMERS SIMULTANEOUSLY**

| Clip ID              | Actor role          | Victim role         |
|---------------------|--------------------|--------------------|
| `collar_elbow`      | Initiates collar tie| Receives            |
| `arm_drag`          | Drags arm           | Steps through       |
| `trip_takedown`     | Trips leg           | Falls to mat        |
| `body_slam`         | Lifts, walks, drops | Protective bump     |
| `suplex_german`     | Grips, arches       | Back bump           |
| `powerbomb`         | Lifts overhead      | Upside-down bump    |
| `piledriver`        | Lifts inverted      | Head-first mime (MAT, NO IMPACT)  |
| `spinebuster`       | Drives into mat     | Back bump           |
| `irish_whip`        | Whips arm           | Runs to rope        |
| `rope_rebound`      | Catches return      | Rebounds            |
| `side_slam`         | Lifts, tosses       | Side bump           |

**Safety note for piledriver and powerbomb:**  
Capture the lift and inversion only. The final drop is physics-driven in-engine.  
Do not drop performers head-first or without full stunt coverage.

### 5. Downed and Recovery (solo)

| Clip ID         | Description                          |
|----------------|--------------------------------------|
| `fall_back`    | Controlled back bump                 |
| `fall_front`   | Controlled front fall                |
| `fall_side`    | Side fall                            |
| `getup_back`   | Rise from back                       |
| `getup_front`  | Rise from front                      |
| `kickup`       | Kip-up to standing                   |
| `struggle_pin` | Pinned — pushing, bridging           |
| `kickout`      | Bridge escape from pin               |
| `pin_cover`    | Cover opponent after slam (mime)     |

### 6. Showmanship (solo)

| Clip ID         | Description                    |
|----------------|--------------------------------|
| `taunt_atlas`  | Atlas signature taunt          |
| `taunt_vex`    | Vex signature taunt            |
| `taunt_nova`   | Nova signature taunt           |
| `taunt_brick`  | Brick signature taunt          |
| `taunt_chad`   | Chad signature taunt           |
| `victory`      | Celebration                    |
| `defeat`       | Slumped defeat                 |
| `crowd_point`  | Point to crowd                 |

---

## File Naming Convention

```
{fighter}_{clip-id}_{variant}_{role}_{take}_{fps}fps.{ext}
```

Examples:
```
atlas_body-slam_clean_attacker_01_60fps.fbx
atlas_body-slam_clean_victim_01_60fps.fbx
vex_roundhouse_clean_solo_01_60fps.fbx
```

Variants: `clean`, `fatigued`, `fast`, `slow`, `alt`

---

## Delivery Format

Preferred source: **FBX at 60 fps**, T-pose or A-pose first frame, in metres.  
Accepted: BVH, GLB/glTF.  
Runtime format after pipeline: optimized GLB.

---

## Revision

| Version | Date       | Change               |
|---------|-----------|----------------------|
| 0.1     | 2026-07-14 | Initial planning draft |
