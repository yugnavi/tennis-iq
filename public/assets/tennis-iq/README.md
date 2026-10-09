# Tennis IQ — Portrait Sprite Pack v2

Designed for mobile portrait browser gameplay (starting at 360×780 CSS pixels).

## Contents

- `characters/`: individual transparent RGBA PNGs, padded to a consistent **128×128** canvas; feet are approximately at y=120, aligned for Phaser.
- `spritesheets/`: **640×128** horizontal strips, 4–5 frames each (as available in the source), frame dimensions 128×128.
- `courts/gameplay/`: clean **360×580 SVG** court graphics for responsive tactical interactions, in four surface colors. These are preferable for gameplay because court geometry remains legible.
- `courts/illustrated/` and `arenas/`: portrait background illustrations cropped from the artwork; relatively low resolution, use as decorative cards rather than full-resolution gameplay backgrounds.
- `effects/`, `items/`, `icons/`: individually extracted visual elements.
- `reference/portrait_gameplay_mockup.png`: preview, **not** a sprite.
- `assets-manifest.json`: exact filenames and dimensions.

## Phaser example

```js
this.load.spritesheet('male-run', '/assets/spritesheets/male_run.png', { frameWidth: 128, frameHeight: 128 });
this.load.image('court', '/assets/courts/gameplay/hard.svg');
this.anims.create({ key: 'male-run', frames: this.anims.generateFrameNumbers('male-run', { start: 0, end: 4 }), frameRate: 8, repeat: -1 });
```

## Quality notes

Source is AI-generated **composite concept art**. Individual PNGs are extracted by image processing; some frames can have uneven pixel details, cut-off racket/ball edges, or inconsistent animation poses. These are **prototype assets**, not fully hand-cleaned pixel-perfect production animations. Character sprites are side-on perspective while court views are top-down; review the visual mismatch before production. Illustrated backgrounds are small crops and should not be enlarged beyond their native resolution without visible pixelation. SVG court diagrams are generated separately for readability.

No app UI text is baked into the functional SVG courts. Credit or clearance should be determined before commercial distribution.
