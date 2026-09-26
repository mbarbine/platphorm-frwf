# Remaining asset import

The supplied FRWF_Remaining_Assets_Complete.zip contains 45 GLBs, with no skins or animations. It supplies venue/prop art, not replacement wrestler models or mocap. Large scene files were not imported wholesale.

`tools/venue/import-completion.py` validates source hashes and imports the folding chair, wooden table and trash can. Shared external PNG maps are bounded to 512 pixels. The three GLBs and shared textures total approximately 3.8 MB. The manifest records bounds, hashes, provenance and compound collider shapes.

`VenueAsset` loads shared assets with per-instance scene graphs and a local fallback. Loose props and replays use the same prop visual. Backyard/backstage tables retain their existing landing surfaces and break behavior. The dome commentary desk remains separate.

Validation: three binary/texture/collider tests pass. An isolated Three preview rendered all three materials. In-game weapon grip, swings, table break visuals and physical-device performance still require acceptance; asset ingestion alone does not establish these. The original chair inventory reports collapsed UV edges, which remain an authoring limitation.
