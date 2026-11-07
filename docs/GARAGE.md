# The garage scene: making the picture

The garage draws its panels and lights over a picture of a car in a workshop: the **plate**. Use your own render,
a photo, or an image you generate. It should be **unbranded**: no badges, no grille logos, no text, no UI.

## 1. The picture

- 16:9 or wider, at least 2560 px wide (3840 for a 4K screen). JPG, PNG or WebP.
- The car in the middle, front three-quarter view, with dark space at the top and on both sides: the panels sit there.
- Dark charcoal workshop, restrained red neon, a wet reflective floor. No people, no text, no logos.

A prompt that works with most image generators:

> Cinematic photo of an unbranded black sports coupe, front three-quarter view, parked in the center of a dark
> automotive workshop at night. Glossy black paint with deep red neon reflections, slim LED headlights on, red neon
> light strips outlining a bay on a wet reflective concrete floor. Left: a pegboard tool wall and a red tool chest.
> Right: a tall paneled window with a red sun over a snowy mountain. Back wall: an empty neon frame. Charcoal and
> near-black tones, crimson accents. Wide 21:9 composition with empty dark space on the left, right and top.
> No logos, no badges, no emblems, no text, no people, no UI.

## 2. Where the lights are: plate.json

Put a JSON file beside the picture, with the same name (`garage.jpg` -> `garage.json`). Every position is a fraction
of the picture's width and height (0 to 1, from the top left):

```json
{
  "headlights": [[0.30, 0.62, 30], [0.62, 0.62, 40]],
  "tail": [],
  "floor": [0.5, 0.88, 0.40, 0.07],
  "hood": [0.42, 0.58],
  "sign": [0.45, 0.17],
  "window": [0.63, 0.07, 0.99, 0.56],
  "focus": [0.5, 0.6],
  "place": null
}
```

| key | what | used for |
|---|---|---|
| `headlights` | `[x, y, size]` for each headlight (size in thousandths of the picture width) | running lights, the high-beam flash, the hazards |
| `tail` | the same for tail lights, if you can see them | tail lights, the hazards |
| `floor` | `[x, y, half width, half height]` of the glow under the car | the underglow (GPU, music) |
| `hood` | where the engine bay is | the red glow of a failed agent |
| `sign` | the neon sign on the wall | an alert flares it |
| `window` | `[left, top, right, bottom]` of the window | the real rain and snow |
| `focus` | the point that must stay on screen when the picture is cropped | fitting other screen shapes |
| `place` | `[x, y, width]` on the screen, for a picture that is only the car: the rest becomes its own blur | small or tight pictures |

Any key can be left out. Then point Pulse at it:

```toml
[garage]
plate = "~/Pictures/garage.jpg"
```

Preview it in a browser while you tune the numbers: `omarchy-pulse serve --demo`, then open the printed address with
`&scene=garage` at the end.
