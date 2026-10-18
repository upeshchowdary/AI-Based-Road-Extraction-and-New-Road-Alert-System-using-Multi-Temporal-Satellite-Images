# CP1 slide outline (10 slides)

1. **Title** — AI-Based Road Extraction and New-Road Alert System using Multi-Temporal Satellite Images · team, guide, SIH1564.
2. **Problem** — new roads appear unnoticed (security, PMGSY audit, planning); manual checks don't scale; clouds and seasons fool pixel differencing.
3. **Our approach** — two tiers (Sentinel-2 statewide, high-res zones); compare road *graphs*, persistence, abstain mode.
4. **Study area** — AP, NTR + Krishna pilot, zones A/B/C map; frozen spatial holdout (95/489 blocks + zones).
5. **Data pipeline** — STAC → cloud-masked seasonal composites → QA gates → tile registry ("nothing cut is lost"); numbers: 630 + 1,122 composites, 25 abstained tiles.
6. **Models** — Baseline A (U-Net R34), Reference B (frozen DINOv3-sat), Tier-1 S2 model; Kaggle free GPU (30 h/week/account) and how we budget it.
7. **Results (KPI-1)** — table with 95% CIs per zone (from `reports/kpi1_cp1.md`); O2 reference choice.
8. **Honest findings** — overfitting, Ref B cost, 10 m recall limit, engineering incidents and fixes.
9. **Live demo** — web map + app (see `docs/guides/cp1_demo_script.md`).
10. **CP2 plan** — change detection (O3), SAR, alert scoring, PMGSY audit, statewide AP, India-ready design, enhancement packs.
