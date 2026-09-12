# Original roster and supplied assets

## Roster assignment policy

Use FRWF IDs and player-facing identities from `src/game/data/fighters.ts`. Guide performer names identify reference move families only. Do not import that roster or arbitrarily rename FRWF originals. Keep the four existing fictional fighters available as legacy opponents; moving them out of the default lineup is a separate product choice, not a destructive rename.

The following are **proposed gameplay assignments**, not claims of the real people's abilities or newly implemented moves. Existing signature labels are retained; mechanical variants still require animation/contact certification. Dale's Welcome to the Jungle and Thomas's Spine Buster preserve the user's explicit direction.

| Fighter ID / identity | Proposed basic chain and style | Grapple / signature direction | Art acceptance focus |
| --- | --- | --- | --- |
| chad · Chad “The Claw” Kinsey | Compact jab–cross–body kick; stocky pressure | Close control/claw-themed finish; preserve current label during implementation review | Short dark hair, facial hair, white claw shirt, substantial arms |
| dale · Dale Damage | Heavy straight–forearm–low boot | Power clinch; Welcome to the Jungle | User specification 6'4", 225 lb; beard, long hair and supplied attire |
| thomas · Thomas “Double H” Morse | Long jab–uppercut–big boot | Spine Buster, tall power leverage | Tall muscular frame, long blond hair/beard; written reference, no invented photo |
| sonny · Sonny Sixxshot | Quick jab–cross–high kick; counter branches | Agile throws and Sixxshot Fallout | Bandana, slimmer athletic silhouette and reference hair |
| wrecking_ball · The Wrecking Ball | Short body punch–club–stomp | Heavy body slam / Wrecking Ball Crush | Tall fat body including neck, upper arms and thighs; glasses, cream garment, no balloon mesh |
| steve · Steve “Striking Lightning” LewBallin | Precision jab–cross–uppercut | Counter clinch / Lightning Driver | Glasses, jacket, reference face and correct sleeves |
| john · John “The Train” Thundas | Straight–body shot–running forearm | Ringside power / Thunder Rail | Long hair, goatee, shades, black attire |
| justin · Justin “The Chef” Cook | Jab–body punch–low kick; deliberate setup | Technical control / The Main Course | Chef hat, glasses/goatee, actual apron mesh and prop accessories |
| mondo · Mondo | Club–body shot–body kick | Heavy opportunistic throw / Mondo Meltdown | Mask/head wrap, tie-dye garment, heavy silhouette |
| gil · G.I. Jil | Jab–low kick–counter straight | Agile counter throws / Field Maneuver | Preserve spelling; long hair, cap, black top, denim shorts and boots |
| josh · Josh “The Enforcer” | Jab–cross–low kick; timed counter straight | Proposed Enforcer Slam using the existing slam family | Supplied September 12 photo: tan cap, brown hair, mustache/goatee, black sleeveless shirt; final rig pending |
| atlas · Atlas Rex | Power jab–cross–boot | Existing power kit | Legacy fictional profile; same anatomical gates |
| vex · Vex Volt | Fast straight–low kick–uppercut | Existing technical kit | Distinct silhouette, not a recolor-only variation |
| nova · Nova Fang | Jab–body kick–high kick | Existing aerial kit | Stable support and readable aerial landings |
| brick · Brick Mercy | Body shot–club–stomp | Existing heavyweight kit | Weight carried through body and movement |

For each profile author weak/strong standing attacks, front/back directional grapples, downed head/side/feet actions, running moves, corner/aerial options, taunt, finisher, prop grips and recovery variants. Share compatible clips; do not give every character every move. Keep stable move IDs separate from display names and character-specific variants. Preserve save/replay ID migrations when changing assignments.

## Human asset pipeline

Review reference → neutral mesh → canonical skeleton/rest axes → skin weights → clothing/hair/accessories → animation markers → physical collider/joint alignment → representative motion → ordinary bout. A PNG-to-GLB conversion can supply geometry; it does not prove rigging, skinning, mocap or gameplay compatibility. Do not upload reference imagery to a generator merely because the service exists.

Pilot Chad, Wrecking Ball and G.I. Jil, then Dale and Thomas; validate extreme body types before all fifteen. Clothing must deform with a real garment boundary. Inspect hands, neck, armpits, crotch, knees and boot soles under motion. Preserve source/license/provenance, exporter version, units, skeleton version, texture budgets and fallback. Real footage guides timing and personality; captured animation remains separate from reference video.

## Completion pack register

[asset-register.csv](asset-register.csv) enumerates **all 45 GLBs directly from the supplied ZIP**, with exact source path, hash, bytes, batch, disposition and acceptance work. It is an inventory, not runtime certification. Three are imported/unaccepted for the full interaction lifecycle; 42 require integration or an explicit reference-only disposition. The archive has no supplied human skins/animations according to the prior audit.

| Batch | Delivery window | Use and acceptance |
| --- | --- | --- |
| A · chair/table/trash | Months 1–2 | Finish grip/carry/swing/throw/break acceptance of imported assets |
| B · five ring components | Months 2–3 | Posts, rope, apron, canvas, steps; match gameplay dimensions and continuous contacts, camera clearances |
| C · fourteen remaining props | Months 3–4 | Assign interactive, breakable or fixed dressing per object; authored colliders, mass, sockets, break states only where applicable |
| D · sixteen architecture modules | Months 4–5 | Modular underground/backstage assembly, door/stair clearances, floors, collision deck and occlusion |
| E · five hero pieces | Months 4–5 | Functional doorway/curtain/gate where appropriate, pipe/banners as safe dressing; interaction prompts only for working actions |
| F · two assembled scenes | Months 5–6 | Layout/reference and selective decomposition; do not load giant duplicate scenes wholesale |

Missing sequence numbers are not missing files to invent. Recover desired lockers/turnbuckles/full ring from scene sources or author them as separate tracked derivatives; register provenance and cost before runtime use. Texture families, decals, previews and profiles are companions to these meshes, not extra certified gameplay props.

Also reconcile the underground living-v4 kit against [its audit](../assets/underground-v4-audit.json): choose one source for duplicate geometry; validate supplied LOD content and colliders rather than assuming interchangeability. Retain FRWF branding, original photos/footage and supplied Combat clips in a companion manifest with actual consumers. Motion clips need skeleton/axes/scale, trimming, foot/grip/contact/release markers and paired retarget review. Never mark all assets integrated just because files were copied into public.

## Per-asset closure

Record source hash → derived manifest → consumer → collision/interaction policy → LOD/texture budget → load fallback → replay use → local visual evidence → deployed hash. Repair the chair's known UV degeneracies or document their accepted visual limitation. Verify ring collision dimensions before replacing procedural surfaces. Measure memory after repeated match/rematch and world transitions; dispose instances without destroying shared resources. All unused files get a stated reference-only, duplicate, repair-needed or deferred disposition by month six.

## Josh addition — September 12

Josh is added as the fifteenth selectable fighter with his supplied portrait, a counter-brawler profile and guard taunt. His height, weight, statistics and Enforcer Slam label are provisional game-design choices, not biographical claims. His temporary skinned asset and materials explicitly reuse Sonny's compatible rig and are labelled provisional in selection; they do not reproduce his cap, sleeveless shirt or facial hair. Author the actual likeness in the early roster pass. Preserve the photo as reference, not as a texture stretched across a generic head. The historical fourteen-fighter production baseline remains unchanged until this addition is deployed.
