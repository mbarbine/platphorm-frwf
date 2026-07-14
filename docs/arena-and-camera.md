# The Volt Dome level and camera director

## Playable map

The ring remains the combat center, but the playable map now continues to a 24.1 by 20.5 unit ringside floor inside expanded physical barricades. The north entrance lane, south commentary desk, east steel steps, four aprons, four turnbuckles, two Chaos props, reactive perimeter ribbon, crowd bowl, stage wall, and tunnel provide clear landmarks in every camera orientation.

The arena uses a strict physical/decorative split:

- Physical: ring deck, floor, ropes, posts, turnbuckle pads, commentary desk, steel steps, chair/sign props, table fragments, and barricades.
- Decorative: crowd instances, stage screens, entrance LEDs, truss, light fixtures, broadcast walls, and mat markings.

This keeps the larger level interactive without adding dozens of unnecessary rigid bodies. Fighter positions are bounded just inside the barricades, not at the old compact floor limits. After every fixed step, an intact rig that reaches an outer limit is translated as one mass so joint spacing is preserved. A separate containment counter reports boundary corrections and the rare human-scale rig reassembly safety path.

## Interaction beats

- Ropes deform from measured approach, stop normal sprint-through at a hard elastic tier, return the complete body inward, and open the stiff-arm window only after release.
- Center-rope context transitions move a wrestler between apron and ringside.
- Turnbuckles support lower, middle, and top stages plus climb-down, taunt, and three aerial choices.
- Steel steps and barricades are real collision surfaces.
- Chaos props create real hand joints and carry released hand velocity.
- A defender within the commentary-desk targeting envelope is driven toward the desk with a capped horizontal release; a measured whole-body landing can stress or collapse it even though the production character animation and hidden collision tree use different poses.

## Camera modes

| Mode | Trigger | Framing goal |
|---|---|---|
| Broadcast | Ordinary in-ring action | Familiar hard-camera view with both wrestlers readable |
| Wide | Large fighter separation | Preserve both characters and their route through the expanded map |
| Ringside X/Z | Midpoint outside an apron | View along the relevant barricade without hiding the ring relationship |
| Table | Action near the commentary desk or a table impact | Show attacker, defender, desk, and collapse path |
| Aerial | Climb, jump, airborne state, or aerial move | Hold turnbuckle, flight arc, and target in the same shot |
| Grapple | Two physical grips secure the defender | Show lock, load, lift, and landing continuously |
| Replay | Player-triggered replay | Slow orbit around the recorded action |

The director gives urgent story beats priority but holds non-urgent modes for at least 720 ms. It chooses a camera hemisphere at the cut and does not flip sides every frame. Position, look target, and FOV have independent damping. Motion prediction is clamped, and impact shake is short, capped, and disabled by Reduced Motion.

## Control safety

Keyboard, touch, gamepad, and XR movement are transformed through a stable camera basis. A held direction keeps the basis it began with. Grapple and other cinematic action states also hold that basis. Directional move selection therefore remains deterministic even when the camera changes modes. Close-range approach braking reduces touch-stick overshoot while retaining enough minimum speed to enter grapples.
