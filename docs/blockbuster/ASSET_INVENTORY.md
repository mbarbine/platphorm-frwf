# Ringfall Blockbuster asset inventory

Inventory version: `ringfall-assets-1.1.0`  
Audited source: `public/`, runtime procedural consumers, and the optimized Vite graph  
Baseline production: `dpl_HrVffReG45hfrGuYgsMNhovp27L2`

There are no hidden model, texture, animation, font, or audio files. Every current public file is listed below. `Build` means the file is present in the optimized output; `Live` remains pending for new release-identity assets until the next immutable deployment is browser-verified.

| Path | Type / dimensions | Bytes | Intended and actual use | Consumer / phase | Critical / fallback | Build / live | Flags |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| `public/favicon.svg` | SVG / scalable | 297 | Browser icon and identity mark; used by `index.html` | Browser / startup | optional / browser default | yes / prior version | no duplicate; not orphaned |
| `public/api/health` | JSON | 930 baseline | Full public static health plus build-injected release identity | Operators and agents / request | critical / none | yes / prior version | generated release fields replace development placeholders |
| `public/api/v1/health` | JSON | 230 baseline | Compact versioned health plus release identity | Operators and agents / request | critical / `/api/health` | yes / prior version | intentional variant |
| `public/api/docs` | JSON | 1,548 | Product/API documentation metadata | Agents / request | critical platform surface / README | yes / prior version | not orphaned |
| `public/api/release` | JSON | new | Clean-URL release identity | Release automation / request | critical release surface / `/release.json` | yes / pending | build-generated from real environment |
| `public/release.json` | JSON | new | Public-safe version, SHA, timestamp, manifests, counts, environment | UI, tests, operators / request | critical release surface / `/api/release` | yes / pending | build-generated from real environment |
| `public/openapi.yaml` | OpenAPI YAML | 788 | Static read-only API contract | API tooling / request | critical platform surface / docs | yes / prior version | not orphaned |
| `public/llms.txt` | text | 392 | Concise game discovery | Agents / request | critical discovery / `llms-full.txt` | yes / prior version | not orphaned |
| `public/llms-full.txt` | text | 2,375 | Complete game capability and limitation discovery | Agents / request | critical discovery / docs | yes / prior version | not orphaned |
| `public/llms-index.json` | JSON | 803 | Machine-readable capabilities | Agents / request | critical discovery / `llms.txt` | yes / prior version | not orphaned |
| `public/robots.txt` | text | 75 | Crawler policy and sitemap pointer | Crawlers / request | critical discovery / none | yes / prior version | not orphaned |
| `public/sitemap.xml` | XML | 218 | Canonical public URL list | Crawlers / request | critical discovery / none | yes / prior version | not orphaned |
| `public/sitemap-index.xml` | XML | 193 | Sitemap index compatibility surface | Crawlers / request | applicable platform route / `sitemap.xml` | yes / prior version | intentional overlap |
| `public/rss.xml` | RSS XML | 726 | Release feed | Readers and agents / request | critical discovery / `feed.xml` | yes / prior version | intentional RSS variant |
| `public/feed.xml` | Atom XML | 644 | Atom-compatible release feed | Readers and agents / request | applicable platform route / `rss.xml` | yes / prior version | intentional feed variant |
| `public/manifest.webmanifest` | web manifest | 371 | Install metadata and theme identity | Browser / install | critical PWA metadata / favicon | yes / prior version | no service worker claimed |
| `public/.well-known/agents.json` | JSON | 730 | Agent discovery and product boundaries | Agents / request | critical discovery / `llms-index.json` | yes / prior version | not orphaned |
| `public/.well-known/ai-plugin.json` | JSON | 409 | Compatibility discovery only | Agents / request | applicable / OpenAPI | yes / prior version | no callable plugin claimed |
| `public/.well-known/mcp.json` | JSON | 196 | Honest MCP unsupported metadata | Agents / request | critical trust surface / none | yes / prior version | no fake tool registry |
| `public/.well-known/security.txt` | text | 160 | Security contact/policy | Operators / request | critical trust surface / none | yes / prior version | not orphaned |
| `public/.well-known/trust.json` | JSON | 928 | Public/protected boundary and shared-auth policy | Agents and operators / request | critical trust surface / none | yes / prior version | not orphaned |

## Runtime-generated asset records

| Asset family | Type | Intended / actual use | Consumer / phase | Critical / fallback | Production state |
| --- | --- | --- | --- | --- | --- |
| Fighter presentation | Procedural Three geometry/materials | Player-facing wrestlers; currently primitive fallback-quality | `FighterModel.tsx` / selection and match | critical / physical debug rig | wired, visually insufficient |
| Physical fighter rig | Rapier bodies/colliders/joints plus optional debug meshes | Authoritative contact, balance, grips, landing | `PhysicalFighterRig.tsx` / match | critical / no substitute | wired and preserved |
| Volt Dome | Procedural Three geometry/materials | Ring, ropes, posts, floor, crowd, table, props, background | `Arena.tsx` / match | critical / simplified quality tier | wired, presentation upgrade required |
| Impact effects | Pooled procedural meshes/materials | Contact feedback | `ImpactEffects.tsx` / combat | important / no particle | wired, move-specific certification pending |
| Replay presentation | In-memory bounded transforms | Major-impact replay | `ReplayFighter.tsx` / conditional | optional / continue live camera | wired and bounded |
| Procedural audio | Web Audio oscillators/noise/panners | UI, movement, strikes, ropes, props, crowd | `audioEngine.ts` / on demand | important / silent gameplay plus text cues | wired; transient nodes now explicitly disconnected |

## Missing asset classes

- shared mature humanoid mesh/skeleton;
- fighter-specific modular anatomy, heads, hair, faces and attire;
- authored animation clips or an equivalent higher-order procedural motion library;
- arena material/texture set;
- detailed chair, trash-can, table, steps and production-equipment assets;
- move-specific local audio layers;
- final OpenGraph and visual-regression release images.

These are release gaps, not deferred assets silently counted as wired. Every future binary asset must be added to the versioned manifest with a fallback and a production-resolution test.
