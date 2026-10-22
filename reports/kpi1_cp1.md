# KPI-1 — Road extraction accuracy (CP1)

_Generated 2026-10-22 by `scripts/kpi_report.py` from run outputs in `data_cache/runs/`. Pixel IoU / F1 / precision / recall pooled over images; 95% CI = percentile bootstrap over images (2000 resamples). Threshold 0.5._

## Baseline A — U-Net ResNet34

Data: DeepGlobe 0.5 m RGB · split: frozen hash split 80/10/10 · run `baseline_a_full_s0_cc3c8394675b` (config `cc3c8394675b`) · GPU wall time 2.46 h · stop: early_stop_epoch_5

| Split | n images | IoU | F1 | Precision | Recall |
|---|---|---|---|---|---|
| Test (holdout) | 640 | 0.501 [0.490, 0.513] | 0.668 [0.658, 0.678] | 0.628 [0.614, 0.642] | 0.713 [0.697, 0.726] |
| Validation | 614 | 0.496 [0.483, 0.508] | 0.663 [0.652, 0.674] | 0.617 [0.602, 0.632] | 0.716 [0.702, 0.731] |

## Reference B — frozen DINOv3-sat ViT-L/16 + light decoder

Data: DeepGlobe 0.5 m RGB · split: frozen hash split 80/10/10 (same as Baseline A) · run `reference_b_full_s0_59cc9ad8d0e9` (config `59cc9ad8d0e9`) · GPU wall time 3.95 h · stop: time_budget_5.0h

| Split | n images | IoU | F1 | Precision | Recall |
|---|---|---|---|---|---|
| Test (holdout) | 640 | 0.356 [0.343, 0.368] | 0.525 [0.511, 0.538] | 0.590 [0.573, 0.606] | 0.473 [0.454, 0.492] |
| Validation | 614 | 0.342 [0.330, 0.355] | 0.510 [0.496, 0.524] | 0.580 [0.565, 0.595] | 0.455 [0.436, 0.476] |

## Tier-1 S2 model — U-Net ResNet34 (4-band)

Data: AP Sentinel-2 10 m (B02 B03 B04 B08) · split: frozen AP spatial holdout + zones A–C · run `s2_model_full_s0_6e9081638291` (config `6e9081638291`) · GPU wall time 0.34 h · stop: early_stop_epoch_24

| Split | n images | IoU | F1 | Precision | Recall |
|---|---|---|---|---|---|
| Test (holdout) | 138 | 0.320 [0.300, 0.338] | 0.484 [0.462, 0.505] | 0.491 [0.456, 0.527] | 0.478 [0.454, 0.499] |
| Validation | 87 | 0.294 [0.274, 0.310] | 0.454 [0.431, 0.474] | 0.450 [0.411, 0.483] | 0.459 [0.441, 0.476] |
| Zone A · Vijayawada W. bypass | 60 | 0.296 [0.282, 0.312] | 0.457 [0.440, 0.475] | 0.572 [0.549, 0.593] | 0.380 [0.359, 0.402] |
| Zone B · Machilipatnam port | 75 | 0.332 [0.319, 0.345] | 0.499 [0.483, 0.513] | 0.535 [0.516, 0.553] | 0.468 [0.441, 0.492] |
| Zone C · Gannavaram–Nunna | 75 | 0.300 [0.287, 0.311] | 0.462 [0.446, 0.475] | 0.525 [0.500, 0.545] | 0.412 [0.392, 0.431] |

## Baseline A — seeds (test split, Section 7.5)

| Seed | Run | Test IoU [95% CI] | Test F1 [95% CI] | Best val IoU | Stop |
|---|---|---|---|---|---|
| 0 | `baseline_a_full_s0_cc3c8394675b` | 0.501 [0.490, 0.513] | 0.668 [0.658, 0.678] | 0.496 | early_stop_epoch_5 |
| 1 | `baseline_a_full_s1_c7b2d118d4ec` | 0.491 [0.478, 0.503] | 0.658 [0.647, 0.670] | 0.484 | time_budget_1.0h |
| 2 | `baseline_a_full_s2_a27585529233` | 0.490 [0.478, 0.501] | 0.658 [0.647, 0.668] | 0.484 | time_budget_1.0h |

**Across 3 seeds:** test IoU mean **0.494** (SD 0.006, range 0.490–0.501) · test F1 mean **0.661** (SD 0.006).

All three seeds use the same config; every seed's best checkpoint is from epoch 0 (seed 0 peaked at epoch 0 then overfit; seeds 1–2 stopped at the 1 GPU-h cap after epoch 0), so the seeds are comparable.

## Tier-1 S2 model — seeds (test split, Section 7.5)

| Seed | Run | Test IoU [95% CI] | Test F1 [95% CI] | Zone A IoU | Zone B IoU | Zone C IoU | Best val IoU | Stop |
|---|---|---|---|---|---|---|---|---|
| 0 | `s2_model_full_s0_6e9081638291` | 0.320 [0.300, 0.338] | 0.484 [0.462, 0.505] | 0.296 | 0.332 | 0.300 | 0.294 | early_stop_epoch_24 |
| 1 | `s2_model_full_s1_72bfc5104f22` | 0.313 [0.293, 0.331] | 0.476 [0.453, 0.498] | 0.268 | 0.322 | 0.293 | 0.291 | early_stop_epoch_15 |
| 2 | `s2_model_full_s2_a1374178f8fb` | 0.334 [0.313, 0.353] | 0.501 [0.477, 0.522] | 0.302 | 0.337 | 0.305 | 0.303 | early_stop_epoch_24 |

**Across 3 seeds:** test IoU mean **0.322** (SD 0.011, range 0.313–0.334) · test F1 mean **0.487** (SD 0.012).

Same config for every seed (25 epochs, early stopping on val IoU); seeds differ only in initialisation and data order.

## O2 comparison — Baseline A vs Reference B (DeepGlobe test split)

| Model | Test IoU [95% CI] | Test F1 [95% CI] | Precision | Recall | Epochs | min/epoch | Train h (T4×2) |
|---|---|---|---|---|---|---|---|
| Baseline A (seed 0) | 0.501 [0.490, 0.513] | 0.668 [0.658, 0.678] | 0.628 [0.614, 0.642] | 0.713 [0.697, 0.726] | 6 | 24 | 2.46 |
| Reference B | 0.356 [0.343, 0.368] | 0.525 [0.511, 0.538] | 0.590 [0.573, 0.606] | 0.473 [0.454, 0.492] | 5 | 47 | 3.95 |

Reference B val IoU per epoch: 0.144 → 0.219 → 0.275 → 0.259 → 0.342. It stopped at its 5 h budget after 5 of 8 planned epochs and was still improving; Baseline A peaked after epoch 0. With more GPU time it is still clearly below Baseline A (non-overlapping CIs), so **Baseline A stays the O2 reference** (ADR-018). Fine-tuning the backbone (LoRA, Enhancement Pack D) is the CP2 option if a foundation model is to be pursued.

## Reading these numbers honestly

- Baseline A IoU 0.50 is below the ~0.60–0.65 usually reported on DeepGlobe; it peaked after epoch 0 and then overfit (ADR-018). The 3-seed table above shows the result is stable across seeds.
- The S2 model is measured against OSM masks that include narrow residential streets that 10 m pixels cannot resolve, so recall is the weak side; precision is higher in every zone.
- No condition is averaged away: each holdout zone is reported separately (Section 8).
