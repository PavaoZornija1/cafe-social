# Brawler arena backgrounds — implementation guide

How the arena backdrop works, how to author new art, and how to wire a new map.

---

## How it works (mental model)

The backdrop is **not one wide image**. It is **three square panels** placed side by side on the playable world:

```text
|  panel (left)  |  panel (center)  |  panel (right)  |
|<---------------------- worldW ---------------------->|
```

In code (`ArenaWorldView`):

- Each panel is stretched to **exactly ⅓ of `worldW`** and **full `worldH`**
- Panels sit on the **world layer** (they scroll with the camera)
- Order in `skyPanels` is always **left → center → right**

Current mossy cavern mapping (filenames vs on-screen slot):

| On-screen slot | File | Source art nickname |
|----------------|------|---------------------|
| Left | `panel_2.png` | bg2 |
| Center | `panel_1.png` | bg1 |
| Right | `panel_3.png` | bg3 |

Do **not** size panels from screen width alone. That makes the row wider than the world, hangs the left panel off-screen, and turns the visible crop into “blurry green mush”.

---

## Maps on disk

Each map is a folder under `app/assets/maps/brawlerHeroes/`:

| Map id | Folder | Status |
|--------|--------|--------|
| `mossy_cavern` | `mossy_cavern/` | Live |
| `desert_plains` | `desert_plains/` | Live |

### Required files per map

| Role | Filename | Native size |
|------|----------|-------------|
| Sky left | `panel_2.png` | **512×512** |
| Sky center | `panel_1.png` | **512×512** |
| Sky right | `panel_3.png` | **512×512** |
| Ground strip | `ground.webp` | 1920×64 |
| Small ledge | `ledge_s.webp` | 160×48 |
| Medium ledge | `ledge_m.webp` | 224×48 |

```text
app/assets/maps/brawlerHeroes/
  mossy_cavern/
    panel_1.png    # center
    panel_2.png    # left
    panel_3.png    # right
    ground.webp
    ledge_s.webp
    ledge_m.webp
  desert_plains/
    panel_1.png    # center
    panel_2.png    # left
    panel_3.png    # right
    ground.webp
    ledge_s.webp
    ledge_m.webp
```

Platform ledges / ground are separate from the 3-panel sky (see `ArenaPlatformArt`).

---

## 1. Create the art (PixelLab → Aseprite)

### Sky panels

PixelLab often caps generate size. Recommended pipeline:

1. Generate each panel at **256×256** (or the largest square the tool allows).
2. In Aseprite: **Sprite → Sprite Size**
   - Target **1024×1024** (or keep 512 if already sharp enough)
   - Method: **Nearest Neighbor** (preserves pixels)
3. Export a **static PNG** (current frame only).
4. Produce the game file at **512×512** nearest-neighbor → `panel_1.png` / `panel_2.png` / `panel_3.png`.

512×512 loads reliably in React Native and still looks sharp when stretched to a world third.

### Panel design tips

- Three scenes that **tile horizontally** (shared horizon, lighting, palette).
- Strong silhouettes; fine detail dies on device.
- Keep mid-air open so heroes and platforms stay readable.
- Paint the **full** square — in-game each panel is stretched to the full world height (not cropped to a mid band).

### Ground / ledges

| Piece | Canvas |
|-------|--------|
| Ground | 1920×64 |
| Small ledge | 160×48 |
| Medium ledge | 224×48 |

Export as **static WebP** (or PNG). Same “no animation” rule as sky panels.

---

## 2. Export rules (critical)

**Do**

- Static **PNG** for sky panels (preferred)
- One opaque image per panel
- Game sky files at **512×512** named `panel_1.png`, `panel_2.png`, `panel_3.png`

**Do not**

- Animated WebP / multi-frame Aseprite exports  
  RN `Image` often shows blank, cream, or **blurry green**
- Stretch one square across the entire world width in code  
  Always use **three** panels

If an export looks wrong in-game, open the file in Preview/Aseprite. If frame 0 is empty, re-export the real frame as a static PNG.

**Cache bust:** after replacing art, prefer a **new filename** (or bump suffix) and update the `require(...)`. Metro often keeps stale bitmaps otherwise.

---

## 3. Wire a map in code

### Registry — `src/brawler/arena/arenaMaps.ts`

1. Add/update the asset pack with static `require()` paths (Metro needs string literals):

```ts
const DESERT_PLAINS_ASSETS: ArenaMapAssets = {
  // left → center → right
  skyPanels: [
    require('../../../assets/maps/brawlerHeroes/desert_plains/panel_2.png'),
    require('../../../assets/maps/brawlerHeroes/desert_plains/panel_1.png'),
    require('../../../assets/maps/brawlerHeroes/desert_plains/panel_3.png'),
  ],
  skyW: 512,
  skyH: 512,
  ground: require('../../../assets/maps/brawlerHeroes/desert_plains/ground.webp'),
  groundW: 1920,
  groundH: 64,
  ledgeBySize: {
    s: {
      source: require('../../../assets/maps/brawlerHeroes/desert_plains/ledge_s.webp'),
      w: 160,
      h: 48,
    },
    m: {
      source: require('../../../assets/maps/brawlerHeroes/desert_plains/ledge_m.webp'),
      w: 224,
      h: 48,
    },
  },
};
```

2. Register it on `ARENA_MAPS` and extend `ArenaMapId` if the id is new.
3. Add an i18n name under `brawlerLobby.maps.*` (see existing `mossyCavern` / `desertPlains`).

`skyPanels[0]` = left, `[1]` = center, `[2]` = right.  
For mossy cavern that is **bg2, bg1, bg3** — match that convention unless you intentionally change it.

### Rendering — `ArenaWorldView`

Already implemented: three equal strips across `worldW` × `worldH`, `resizeMode="stretch"`.  
Do not switch back to “one image covers the whole world” or “tile size = screen width” without re-checking alignment.

### Map selection

- Lobby picker (temporary): `BrawlerLobbyScreen` → `mapId` through `GameLaunch` → `BrawlerArena`
- Random: `resolveArenaMapId('random')` picks from `ARENA_MAP_IDS`

---

## 4. Checklist: adding a new map (e.g. desert plains)

1. Create `app/assets/maps/brawlerHeroes/<map_id>/`
2. Drop `panel_1.png`, `panel_2.png`, `panel_3.png` (512×512 static) plus ground/ledge webps
3. Confirm files open correctly outside the app (not animated / not blank frame 0)
4. Point `DESERT_PLAINS_ASSETS` (or a new pack) at that folder in `arenaMaps.ts`
5. Register id + i18n label
6. Restart Metro with a clean cache:

```bash
npx expo start -c
```

7. Fully reload the app, start a match, walk left and right — confirm all three panels and no cream/green mush

---

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Blurry green mush | One image stretched too wide, or panels sized from screen width so the row overhangs the world | Three panels as equal `worldW ÷ 3` strips, full `worldH` |
| Left panel missing; center/right shifted | Row wider than world (negative `left`) | Span exactly `worldW`; no screen-width-only fit |
| Cream / white / empty | Animated WebP or asset not in bundle | Static PNG; `npx expo start -c` |
| One side wrong | Bad export or Metro cache | Re-export; new filename + update `require` |
| Gaps when panning | Row shorter than world | Three panels must cover full `worldW` |
| New map looks like mossy | Requires still point at mossy | Update that map’s asset pack paths |

---

## Related code

| Piece | Path |
|-------|------|
| Map catalog + `require`s | `src/brawler/arena/arenaMaps.ts` |
| Sky strip layout | `src/brawler/arena/components/ArenaWorldView.tsx` |
| Ground / ledge art | `src/brawler/arena/components/ArenaPlatformArt.tsx` |
| Lobby map picker | `src/screens/BrawlerLobbyScreen.tsx` |
| Nav `mapId` | `src/navigation/type.ts` (`BrawlerArena` / `GameLaunch`) |
