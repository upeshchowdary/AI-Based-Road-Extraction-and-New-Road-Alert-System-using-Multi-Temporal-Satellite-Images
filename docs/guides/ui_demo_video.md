# UI demo video guide

_Record the 2-minute RoadWatch demo video for free with OBS Studio._

## Setup

1. **Download OBS Studio** (free, open source): https://obsproject.com
2. Set recording settings:
   - Output format: **MP4** (Recording → Output → Recording Format)
   - Resolution: **1920×1080**
   - FPS: **60**
   - Encoder: Hardware (NVENC on RTX 4070) for smooth recording
3. Add a **Browser Source** pointing to `http://localhost:5173` at 1920×1080 — OR —  
   add a **Window Capture** source pointing to your Chrome window, also at 1920×1080.
4. Make sure the dev server is running (`pnpm dev` in `web/`).
5. Run `pnpm build && pnpm preview` instead if you want to record from the production build (smoother, no HMR flicker).

---

## Click path (≤ 2 minutes)

| Segment | Duration | What to do |
|---|---|---|
| **Cold open** | 0:00–0:08 | Load `http://localhost:5173`. The preloader ring draws; Earth appears. Say/caption: *"RoadWatch — every new road, seen first."* |
| **Hero scroll** | 0:08–0:35 | Scroll slowly through the hero: orbit → India → AP border draws → scan line sweeps → amber West Bypass road draws itself → alert card pops in. |
| **Why not just compare images** | 0:35–0:50 | Scroll to H4. Show the pixel-diff side (blobs flicker, 1,183 changes). Toggle to RoadWatch: one calm amber road. Say: *"Everything changes. Only roads matter."* |
| **Explore demo** | 0:50–1:20 | Click "Explore live demo". Map loads centred on Vijayawada. Click through 2–3 dates (e.g. 2022 pre-monsoon → 2024 post-monsoon). Drag the before/after slider. Click an alert marker — side panel opens. |
| **App — Alerts** | 1:20–1:45 | Navigate to `http://localhost:5173/app`. Open `/app/alerts`. Press `J` to move down, `A` to accept. Press `Ctrl+K` — command palette opens. |
| **Close** | 1:45–2:00 | Return to home. Scroll to the final CTA: *"Watch the map rewrite itself."* Click "Explore live demo" one more time. Fade out. |

---

## Tips

- **Cursor highlighting:** install a free cursor highlight tool (e.g. "Cursor Highlight" Windows tool) so clicks are visible.
- **No audio needed** — captions or a simple voiceover added in post (DaVinci Resolve free tier works).
- **Captions:** export the click path above as a `.srt` file or burn them in with DaVinci Resolve.
- **Trim aggressively:** cut any loading pauses; keep the edit snappy.
- **Target length:** 90–120 seconds. Judges do not watch longer demos.

---

## Export

OBS records to `C:\Users\<you>\Videos\` by default. Rename to `reports/ui/demo_video.mp4` and commit to the repo (or link from the README if it's large).

For YouTube / HF upload, re-encode to H.264 at 8 Mbps with DaVinci Resolve or HandBrake (free).
