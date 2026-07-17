# Ringfall Blockbuster move certification

Move manifest: `ringfall-moves-2.1.0`  
Current public move count: 38  
Status: baseline inventory complete; visual/device/human certification pending

The tables record the current runtime mapping. Shared animation, generic reaction, audio, VFX or camera entries are explicit gaps—not evidence of visual distinction.

## Definition and presentation mapping

| ID / display name | Input | Category | Attacker / defender presentation | Physical limb / target | Audio / VFX / camera | STA / DMG / MOM / HYPE | AI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `jab` Circuit Jab | neutral J | quick | `jab` / quick head sell | lead hand / head-chest | impact / light / strike | 5 / 5 / 7 / 3 | yes |
| `combo` Neon One-Two | repeat neutral J or left+J | quick | `jab` shared / quick sell | hands / head-chest | impact / light / strike | 8 / 7 / 9 / 4 | yes |
| `high_punch` Skyline Cross | forward or right+J | quick | `jab` shared / quick sell | rear hand / head | impact / light / strike | 7 / 7 / 9 / 5 | yes |
| `heavy` Fault Hook | neutral K | heavy | `heavyStrike` / torso-head sell | fist-forearm / torso-head | heavy / heavy / strike | 17 / 13 / 13 / 8 | yes |
| `uppercut` Voltage Uppercut | forward+J | heavy | rising punch / lift sell | fist / head | uppercut / heavy / strike | 15 / 15 / 15 / 11 | yes |
| `headbutt` Hardline Headbutt | back+J | quick | framed chamber and full-body drive / head sell | head / head | heavy / heavy / strike | 9 / 9 / 11 / 8 | yes |
| `low_kick` Circuit Low Kick | back+K | heavy | `kick` shared / leg sell | shin-boot / leg | kick / light / strike | 8 / 8 / 10 / 6 | yes |
| `high_kick` Halo High Kick | right+K | heavy | `kick` shared / head sell | boot / head | kick / heavy / strike | 16 / 16 / 16 / 13 | yes |
| `roundhouse` Arc Roundhouse | left+K | heavy | `kick` shared / rotation sell | shin-boot / head-torso | kick / heavy / strike | 19 / 18 / 18 / 16 | yes |
| `front_kick` Piston Boot | back+K | heavy | `kick` shared / torso sell | boot / torso | kick / heavy / strike | 14 / 14 / 14 / 11 | yes |
| `ground` Mat Quake | J near downed target | ground | `kick` shared / downed sell | boot / torso-leg | kick / light / strike | 10 / 8 / 8 / 5 | yes |
| `slam` Voltage Slam | clinch neutral/right+K or L | grapple | `slam` / paired victim | two hands-torso / back-shoulders | slam / major / grapple-slam | 19 / 16 / 17 / 11 | yes |
| `suplex` Arc Suplex | clinch right+L | grapple | `throw` / paired victim | two hands-waist / back-shoulders | slam / major / grapple-slam | 22 / 18 / 19 / 14 | yes |
| `takedown` Circuit Trip | clinch neutral/down+J | grapple | `grappleEntry` / paired victim | hands-leg / side-back | grapple / heavy / grapple | 13 / 11 / 14 / 8 | yes |
| `whip` Livewire Whip | clinch left+L | grapple | `throw` / paired victim | wrist-arm / locomotion | grapple-rope / heavy / grapple | 15 / 5 / 13 / 10 | yes |
| `arm_drag` Prism Arm Drag | clinch forward+J | grapple | `throw` / paired victim | wrist-upper arm / side-back | grapple / heavy / grapple | 11 / 9 / 12 / 8 | yes |
| `skyhook` Skyhook Suplex | clinch forward+K | grapple | `lift` / paired victim | hands-waist / back-shoulders | slam / major / grapple-slam | 24 / 20 / 21 / 16 | yes |
| `powerbomb` Dome Powerbomb | clinch forward+L | grapple | `slam` / paired victim | two hands-waist / back | slam / major / grapple-slam | 27 / 23 / 24 / 20 | yes |
| `clutch` Claw Choke | clinch left+J | grapple | `grappleEntry` / paired victim | forearm-hand / neck-torso | grapple / heavy / grapple | 14 / 12 / 15 / 13 | yes |
| `spinebuster` Gridline Spinebuster | clinch down/left+K | grapple | `slam` / paired victim | torso grip / back | slam / major / grapple-slam | 21 / 18 / 19 / 15 | yes |
| `side_toss` Sidewinder Toss | clinch right+J | grapple | `throw` / paired victim | arm-torso / side | slam / heavy / grapple | 16 / 14 / 16 / 12 | yes |
| `mountain_drop` Mountain Drop | clinch down+L | grapple | `lift` / paired victim | two hands-torso / back-shoulders | slam / major / grapple-slam | 25 / 21 / 22 / 18 | yes |
| `corner_smash` Turnbuckle Rail Shot | F while clinched near corner | grapple | `throw` / corner victim | two hands / back-turnbuckle | slam / major / corner | 18 / 18 / 20 / 19 | yes |
| `rebound` Rope-Line Rush | automatic rope-load path | heavy | `kick` shared / running sell | body-boot / torso | rope-heavy / heavy / strike | 8 / 15 / 15 / 13 | yes |
| `stiff_arm` Railway Stiff-Arm | K during rope rebound | heavy | `jab` shared / knockdown sell | forearm / chest-head | rope-heavy / heavy / running | 13 / 17 / 17 / 15 | yes |
| `spear` Circuit Breaker Spear | running L | heavy | `run` / knockdown sell | shoulder-torso / torso | heavy / major / running | 18 / 19 / 20 / 19 | yes |
| `aerial` Domefall Dive | top rope F | aerial | `aerial` / aerial sell | body / torso | finisher / major / aerial | 24 / 21 / 21 / 24 | yes |
| `aerial_elbow` Neon Drop Elbow | top rope J | aerial | `aerial` shared / aerial sell | elbow / torso | heavy / major / aerial | 19 / 19 / 19 / 21 | yes |
| `aerial_kick` Top-Rope Missile Kick | top rope K | aerial | `aerial` shared / aerial sell | boots / torso-head | kick-heavy / major / aerial | 22 / 22 / 22 / 25 | yes |
| `prop` Hardware Check | K with held prop | prop | `heavyStrike` / weapon sell | held prop / contacted region | prop / weapon / strike | 9 / 15 / 14 / 15 | yes |
| `prop_throw` Air Mail | E throw at range | prop | `heavyStrike` shared / weapon sell | thrown prop / contacted region | prop / weapon / wide | 8 / 14 / 17 / 18 | yes |
| `finisher` Signature Finisher | F at full Momentum and legal target | finisher | `finisher` / generic finisher victim | fighter-dependent / torso-back | finisher / finisher / finisher | 12 / 32 / 0 / 38 | yes |
| `counter` Flash Reversal | Space in counter window | utility | `counter` / stagger sell | hand-body / attacker | counter / counter / strike | 10 / 9 / 18 / 18 | yes |
| `kick_up` Livewire Kick-Up | Space while downed | utility | `recovery` / none | support hands-feet / self | step / recovery / neutral | 12 / 0 / 2 / 3 | legal runtime |
| `prop_pickup` Hardware Pickup | E near prop | utility | full crouch, reach, and lift / none | hands and full body / prop | prop / utility / neutral | 0 / 0 / 0 / 0 | legal runtime |
| `prop_drop` Hardware Drop | E while holding outside attack range | utility | lower, release, and recover / none | hand and full body / prop | prop / utility / neutral | 0 / 0 / 0 / 0 | legal runtime |
| `taunt` Signature Taunt | Q | utility | `taunt` shared / none | full body / crowd | cheer / accent / neutral-turnbuckle | 0 / 0 / 13 / 7 | yes |

## Device and visual certification

`P` means pending release-candidate evidence. No move is certified by existence in the registry or by a Physics Lab trigger alone.

| Move ID | Keyboard | Gamepad | Touch | Browser | Readable without HUD | No clipping | No teleport | No stuck state | Rematch-safe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `jab` | P | P | P | P | P | P | P | P | P |
| `combo` | P | P | P | P | P | P | P | P | P |
| `high_punch` | P | P | P | P | P | P | P | P | P |
| `heavy` | P | P | P | P | P | P | P | P | P |
| `uppercut` | P | P | P | P | P | P | P | P | P |
| `headbutt` | P | P | P | P | P | P | P | P | P |
| `low_kick` | P | P | P | P | P | P | P | P | P |
| `high_kick` | P | P | P | P | P | P | P | P | P |
| `roundhouse` | P | P | P | P | P | P | P | P | P |
| `front_kick` | P | P | P | P | P | P | P | P | P |
| `ground` | P | P | P | P | P | P | P | P | P |
| `slam` | P | P | P | P | P | P | P | P | P |
| `suplex` | P | P | P | P | P | P | P | P | P |
| `takedown` | P | P | P | P | P | P | P | P | P |
| `whip` | P | P | P | P | P | P | P | P | P |
| `arm_drag` | P | P | P | P | P | P | P | P | P |
| `skyhook` | P | P | P | P | P | P | P | P | P |
| `powerbomb` | P | P | P | P | P | P | P | P | P |
| `clutch` | P | P | P | P | P | P | P | P | P |
| `spinebuster` | P | P | P | P | P | P | P | P | P |
| `side_toss` | P | P | P | P | P | P | P | P | P |
| `mountain_drop` | P | P | P | P | P | P | P | P | P |
| `corner_smash` | P | P | P | P | P | P | P | P | P |
| `rebound` | P | P | P | P | P | P | P | P | P |
| `stiff_arm` | P | P | P | P | P | P | P | P | P |
| `spear` | P | P | P | P | P | P | P | P | P |
| `aerial` | P | P | P | P | P | P | P | P | P |
| `aerial_elbow` | P | P | P | P | P | P | P | P | P |
| `aerial_kick` | P | P | P | P | P | P | P | P | P |
| `prop` | P | P | P | P | P | P | P | P | P |
| `prop_throw` | P | P | P | P | P | P | P | P | P |
| `finisher` | P | P | P | P | P | P | P | P | P |
| `counter` | P | P | P | P | P | P | P | P | P |
| `kick_up` | P | P | P | P | P | P | P | P | P |
| `prop_pickup` | P | P | P | P | P | P | P | P | P |
| `prop_drop` | P | P | P | P | P | P | P | P | P |
| `taunt` | P | P | P | P | P | P | P | P | P |

Release fails while any public move remains pending in readable visual identity, browser path, or safety columns.
