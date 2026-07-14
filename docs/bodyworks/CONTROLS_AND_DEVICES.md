# Controls and device matrix

All devices produce the same `FrameInput`: camera-relative move vector, run, guard, and edge-triggered commands. Device code cannot bypass combat legality.

| Action | Keyboard | Gamepad | Touch | XR |
| --- | --- | --- | --- | --- |
| Move / choose direction | WASD | left stick / D-pad | left stick | left controller stick |
| Run | Shift | RT | Run modifier | left trigger |
| Quick / heavy / grapple | J / K / L | X / Y / B | Quick / Power / Lock | right controller buttons |
| Guard | I | LT | Guard hold | left squeeze |
| Dodge / counter / kick-up | Space | A | recovery button | right controller button |
| Jump | C | L3 | Jump | device mapping |
| Prop | E | LB | Prop | left controller button |
| Context / corner rail shot | F | R3 | Action | right controller button |
| Taunt | Q | RB | Taunt | left controller button |

Touch controls honor safe-area insets, remain visible in portrait and landscape, and use close-range braking to avoid overshoot. The live control deck and mobile labels name the move that will execute, including rebound stiff-arm, directional grapple, aerial choice, and nearby corner rail shot.

Automated evidence covers keyboard, 390×844 touch plus landscape rotation, standard gamepad axes/buttons, alternate XR thumbstick axes, and WebXR capability discovery. Physical-device latency, browser gesture policy, controller labels, haptics, and headset comfort remain device-required.

