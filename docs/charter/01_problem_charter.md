# 01 — Problem charter

**Project:** AI-Based Road Extraction and New-Road Alert System using Multi-Temporal Satellite Images (code name *RoadWatch AP*)
**Catalogue record:** KL Capstone Framework **CLIMATE-06** — *Automatic Road Extraction and New-Road Change Alerting from Satellite Imagery* (AI Systems for Visual Intelligence)
**Problem source:** Smart India Hackathon **SIH1564** — *Automatic Road Extraction and Alert Generation for New Roads*; problem issuer **NTRO**
**Version:** 1.0 (2026-10-18) · living document, changes logged in `DECISIONS.md`

## 1. Problem

Road networks change constantly, and keeping maps current by hand is slow and incomplete — yet new
roads matter for planning, logistics, rural-road monitoring and security. Today a spatial decision is
often made from misaligned, incomplete or weakly validated evidence (charter CLIMATE-06).

## 2. Goal (final achievement)

A road-extraction and new-road change-alerting system that flags **genuine** new roads accurately,
with a confidence score, before/after evidence, and few false alerts — as a working, operable system
(not a notebook), validated on spatially independent areas across time.

## 3. Beneficiaries and ownership

| Role | Who | Status |
|---|---|---|
| Problem issuer / upstream custodian | NTRO (via SIH1564) | Stated in the source; NTRO is **not** the KL deployment owner |
| Primary beneficiaries | Analysts monitoring infrastructure change; PMGSY / NRIDA rural-road monitoring; state PWDs; planners; mapping and logistics teams | From the problem statement |
| **KL deployment stakeholder / operational decision owner** | **To be confirmed** (faculty guide or named reviewer) | 🔴 open — required before approval (charter) |
| Project lead / model engineering lead | Upesh Chowdary (lead) | Confirmed |
| Team roles (charter: evidence & provenance · model engineering · GIS workflow & delivery · registration, uncertainty & field validation) | Teammates A, B, C, D | 🔴 role-to-person mapping to be confirmed |

## 4. Scope

**Included (CP1 + CP2)**
- O2 reference: robust road extraction (Baseline A U-Net R34 at 0.5 m; Tier-1 Sentinel-2 U-Net at 10 m; Reference B frozen DINOv3).
- O3 contribution: graph-level change detection across seasons (persistence, stability, abstain on unreliable tiles).
- O4 system: alert layer with score and evidence, web map, alert review, exports, API, deployment.
- O5 acceptance: AC-1…AC-4, KPI-1…6, negative tests NT-1…NT-5, independent review.
- Area: Andhra Pradesh (pilot NTR/Krishna + 3 high-resolution zones; statewide Tier-1 screening). India-ready design is documented, not run.

**Excluded**
- A notebook, isolated model, dashboard-only demo or unvalidated library integration as "the result".
- Production certification, universal generalisation, unattended high-stakes operation outside the validated envelope.
- Statewide high-resolution imagery (not free); narrow village tracks at 10 m (documented limitation).
- Redistribution of restricted imagery (ISRO / Bhoonidhi) or of Esri imagery (visual reference only).

## 5. Objectives and gates (charter roadmap)

| Objective | What | Gate | Status (2026-10-18) |
|---|---|---|---|
| O1 | Validate the problem, freeze the engineering contract | CP1 Gate 1 | Contract, holdout, evidence manifest ✅ · these charter documents ✅ · KL stakeholder + team roles 🔴 |
| O2 | Reproducible reference + vertical slice | CP1 Gate 2 | Baseline A (3 seeds) ✅ · S2 Tier-1 ✅ · Reference B full run in progress · per-condition robustness 🟡 |
| O3 | Differentiating contribution: change detection over time | CP2 Gate 3 | v1 working (413 pilot alerts) · pixel-difference baseline + ablations ❌ |
| O4 | Integrated operable system | CP2 Gate 4 | Web app + API + live deployment + review loop ✅ · telemetry, recovery procedure 🟡 |
| O5 | Independent acceptance and impact validation | CP2 Final | Negative tests NT-1…5 ✅ (14/14) · AC harness, precision/recall, independent review ❌ |

## 6. Acceptance conditions (from the charter)

- **AC-1 Representative operation** — extraction accuracy and new-road alert precision/recall on labelled imagery across time.
- **AC-2 Boundary and failure** — occlusion (trees/shadows), seasonal appearance, change vs noise (NT-1…NT-3, `reports/negative_tests.md`).
- **AC-3 Independent evidence** — spatially disjoint areas (frozen holdout, sha256 8a9150a57d46, 95 of 489 blocks + 3 zones), verified CRS.
- **AC-4 Frozen resource envelope** — same versions, data and GPU budget for reference vs final (Kaggle T4×2, 30 GPU-h/week/account).

## 7. KPIs (baseline → target → current)

| KPI | Target (charter) | Current evidence |
|---|---|---|
| KPI-1 road-extraction accuracy | ≥ O2 reference + 3 pts (or within 1 pt with ≥ 20% resource gain) | Baseline A test IoU 0.494 ± 0.006 (3 seeds); S2 model 0.320 [0.300, 0.338] — `reports/kpi1_cp1.md` |
| KPI-2 new-road precision / recall | ≥ O2 reference + 3 pts | Recall 43% on the Vijayawada West Bypass (one road); precision not yet measured |
| KPI-3 false-alert rate | ≥ 5% relative improvement or non-inferior with ≥ 20% resource gain | Not yet measured (needs the pixel-difference baseline) |
| KPI-4 independent-area validation coverage | ≥ 95% | Holdout frozen; coverage % not yet computed |
| KPI-5 cross-region gap | ≤ 0.80 × O2 reference | Zones A/B/C IoU 0.296 / 0.332 / 0.300; gap vs reference not yet computed |
| KPI-6 registration error | ≤ 0.80 × O2 reference | Median 0.071 px (0.7 m), P90 0.158 px, 100% ≤ 1 px gate — `reports/kpi6_registration.md` |

## 8. Constraints

Free tools only; laptop with 16 GB RAM and limited disk (training on Kaggle); spatial test set never
changes; nothing cut from the lean build is lost (reserve registry); secrets only in `.env`; licences in
`LICENSES_DATA.md`. Full list: `PROJECT_PROMPT.md` Section 2.

## 9. Related documents

`02_requirements.md` · `03_architecture.md` · `04_risk_register.md` · `05_source_to_claim.md` ·
`DECISIONS.md` (ADR-001…023) · `PROGRESS.md` · `reports/CP1_report.md`
