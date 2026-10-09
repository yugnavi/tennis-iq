# Tennis IQ — Original Pixel Art Pack v3

**Purpose:** Individually reusable, original pixel-rendered art for the Tennis IQ browser game. Inspired by cozy 16-bit farming-game aesthetics, without copying any specific game's art.

## Assets
- `characters/`: Six color-coordinated character skins; eight poses × left/right (each transparent 192 × 256 PNG).
- `spritesheets/`: One fixed-grid spritesheet per character (8 columns × 2 rows, cell 192 × 256 px). Each is a **pose sheet**, not guaranteed fluid sequential animation; animation should be authored between these poses.
- `courts/`: Four full-length court layouts, portrait 720 × 1200 pixels. Court lines drawn consistently.
- `arenas/`: Three vertical stadium background illustrations (720 × 1280 PNG).
- `backgrounds/`: Three full-screen backgrounds (720 × 1280 PNG), good for layered UI.
- `equipment/`, `effects/`, `icons/`, `badges/`: Independent transparent pixel-art PNGs; avoid cropping a concept collage.
- `ui/`: Blank pixel-art UI panels and buttons; place all accessible text as native HTML.
- `branding/`: Tennis IQ logo and app icon symbol.
- `previews/`: Compact portrait layout illustration.
- `assets-manifest.json`: Manifest of all source assets with dimensions.
- `brand-tokens.json`: Palette for CSS theme.

## Rendering / production notes
- Sprites are rendered from clean, integer-aligned geometry with nearest-neighbor scaling. No AI-extracted halos or non-transparent rectangular backgrounds around sprites.
- Use `image-rendering: pixelated` for character art; use transparent PNGs as textures in Phaser or regular `<img>` in React.
- Fit court to available width, preserving aspect ratio and reserving accessible space for question and answers. Do **not** stretch court geometry.
- `ui` panel assets are blank, not 9-slice metadata files. If doing actual 9-slicing, define margins (suggest 20 exported pixels) in game UI code.
- Gameplay player markers use a side-facing 3/4 perspective while courts are top-down; for perfect tactical coordinates you may prefer simple circular markers until you commission true top-down movement animations.
- These are **fresh mathematically generated prototype/game assets**, not quality-assured professional hand-pixelled production artwork. Check visual fit on target devices before shipping.
- The rank symbols are thematic, not official ATP/WTA insignia.
