# 04 — Risk register

Version 1.0 (2026-10-18). Likelihood / impact: L = low, M = medium, H = high. Owner roles follow the
charter (evidence lead, model lead, GIS delivery lead, validation lead); names to be assigned.

| ID | Risk | L | I | Mitigation in place | Trigger / residual | Owner | Status |
|---|---|---|---|---|---|---|---|
| R1 | Not enough free GPU time for training and seeds | L | M | Quota is 30 h/week/account (measured 2026-10-18; ADR-013); hard `max_hours` per run; CPU sessions for data builds and statewide inference | Quota misread as 6 h earlier — corrected | Model lead | Controlled |
| R2 | Imagery service rate limits stop data builds | M | M | Worker retries with back-off, staggered starts, resumable builds (ADR-023) | Happened 2026-10-18 (5 builds × 8 workers); fixed | Evidence lead | Controlled |
| R3 | Cloud cover (monsoon, coastal) hides the ground | H | M | Seasonal median composites; cloud gate → abstain; pre-monsoon seasons for change | Post-monsoon coast often unusable; Sentinel-1 radar planned (CP2) | Evidence lead | Open |
| R4 | 10 m pixels miss narrow roads; OSM labels include them | H | M | Two tiers (0.5 m Baseline A, 10 m Tier-1); limitation reported; precision > recall | Recall is the weak side (S2 IoU 0.32) | Model lead | Accepted |
| R5 | Seasonal tracks / crop boundaries raise false alerts | M | H | Persistence (≥ 3 later dates), stability ≥ 0.75, ≥ 300 m statewide; human review loop | 3-of-4 seasonal track still alerts (NT-2 residual) | Validation lead | Open |
| R6 | Misregistration between dates creates fake change | L | H | Fixed tile grid; KPI-6 measured: median 0.071 px, 100% ≤ 1 px | Gate not yet enforced per tile in `s2-build` | GIS lead | Monitored |
| R7 | Test-set leakage inflates results | L | H | Frozen block holdout + buffer; zones evaluation-only; CI fails if holdout changes | — | Validation lead | Controlled |
| R8 | Model overfits / is weak on new geography | M | M | Early stopping; 3 seeds; statewide v2 training; per-zone reporting | Baseline A peaks at epoch 0 (ADR-018) | Model lead | Open |
| R9 | No labelled new-road ground truth → precision unknown | H | H | OSM edit history (planned); reviewed alerts exported as labels (ADR-022) | KPI-2/3 not measured yet | Validation lead | Open |
| R10 | Secrets leak into the public repo | L | H | `.env` only; stage named files only; history rebuilt after the 2026-10-14 token-screenshot incident (ADR-017) | Happened once; rule enforced | Lead | Controlled |
| R11 | Licence breach (Esri, EOX, ISRO imagery) | L | H | `LICENSES_DATA.md`; Esri visual-only; EOX non-commercial; no ISRO imagery published; data bundle = Copernicus-derived + own outputs | Review before any commercial use | Evidence lead | Controlled |
| R12 | Laptop memory (16 GB) crashes tools and runs | H | L | Heavy work on Kaggle; one heavy session; retry; logs to files | Frequent tool crashes; no data loss so far | Lead | Accepted |
| R13 | Free hosting limits (Render: 512 MB, sleeps, ephemeral disk) | M | L | Pre-rendered data bundle; read-only reviews on the public site; open the link before demos | Reviews not persisted online | GIS lead | Accepted |
| R14 | Teammate availability for Kaggle runs / evidence | M | M | Run cards with click-by-click steps; runs reassigned to the lead account when needed | Seeds 1–2 ran on the lead account (contribution evidence affected) | Lead | Open |
| R15 | Timeline: CP1 review 2026-10-20, CP2 scope large | M | H | CP1 slice first; CP2 features staged; statewide runs on free CPU | — | Lead | Open |
| R17 | A cloud run fails or hangs and wastes time / quota | M | M | Per-run `max_hours`; hard watchdog in the trainer (exits at 1.5× budget + 1 h); resumable builds; outputs checked by registry counts before use | 2026-10-18: S2 seed 1 hung ~10 h (cancelled, not charged); 2026 build crashed in labels step (fixed, rebuilt); crashed runs can't be attached as Kaggle inputs | Model lead | Controlled |
| R16 | Planetary Computer / Kaggle / Render terms or free tiers change | L | M | Alternatives recorded (Copernicus Data Space, Colab, HF Spaces) | — | Lead | Monitored |
