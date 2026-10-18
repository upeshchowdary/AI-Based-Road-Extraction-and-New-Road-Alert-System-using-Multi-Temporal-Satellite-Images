# CP1 slide outline (12 slides)

1. **Title** — AI-Based Road Extraction and New-Road Alert System using Multi-Temporal Satellite Images · team, guide, SIH1564 (NTRO), KL charter CLIMATE-06 · live link roadwatch-ap.onrender.com.
2. **Problem** — new roads appear unnoticed (security, PMGSY audit, planning); manual checks don't scale; clouds and seasons fool pixel differencing.
3. **Contract (O1)** — charter, requirements, architecture, risk register, source-to-claim map (`docs/charter/`); acceptance conditions AC-1…AC-4; KPI-1…KPI-6.
4. **Our approach** — two tiers (Sentinel-2 statewide, high-res zones); compare road *graphs* across dates, persistence + stability, abstain on unreliable tiles. Architecture diagram from `docs/charter/03_architecture.md`.
5. **Study area + evaluation** — AP, NTR + Krishna pilot, zones A/B/C; frozen spatial holdout (95/489 blocks + zones, sha256 8a9150a57d46); 95% bootstrap CIs.
6. **Data pipeline** — STAC → cloud-masked seasonal composites → QA gates → tile registry ("nothing cut is lost"); 630 + 1,122 composites; statewide: 6,790 tiles × 5 seasons built (2022 pre/post, 2023–2025 pre), 2026 rebuilding.
7. **Models (O2)** — Baseline A (U-Net R34) 3 seeds, Reference B (frozen DINOv3-sat ViT-L, 5 epochs), Tier-1 S2 model; Kaggle free GPU 30 h/week/account (8.73 h used).
8. **Results — KPI-1** — Baseline A 0.494 ± 0.006 (3 seeds); Reference B 0.356 [0.343, 0.368] at 1.6× the training time → Baseline A is the O2 reference; S2 model 0.320 [0.300, 0.338]; per zone A/B/C.
9. **Change detection (O3, early)** — 1,131 candidates → 413 alerts; before/after evidence for every alert; West Bypass sanity check 43%; precision not yet measured (said plainly).
10. **Robustness evidence** — KPI-6 registration median 0.071 px, 100% within 1 px; negative tests NT-1…NT-5, 14/14 pass, with residual risks.
11. **Live demo** — map → search → our seasons → extracted roads → an alert with before/after → reject with reason → Results (`docs/guides/cp1_demo_script.md`).
12. **Honest findings + CP2 plan** — overfitting, frozen foundation model below the CNN, 10 m recall limit, quota misreading, incidents (token leak, rate limit, labels-step crash, hung GPU run + watchdog); CP2: pixel-difference baseline + ablations, KPI-2/3, statewide results, SAR, acceptance harness, final report/paper.
