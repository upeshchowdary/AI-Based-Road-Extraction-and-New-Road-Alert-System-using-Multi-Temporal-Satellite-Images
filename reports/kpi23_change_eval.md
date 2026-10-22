# KPI-2 / KPI-3 — New-road alerts vs dated OpenStreetMap history

_Generated 2026-10-22 by `scripts/change_eval_report.py`. Zones A–C (evaluation-only holdout), Tier-1 model `s2_model_full_s0_6e9081638291`, imagery 2022 → 2026 pre-monsoon. Ground truth from OSM history (ohsome API, © OpenStreetMap contributors, ODbL): roads mapped on 2026-06-01 lying > 25 m from every road mapped on 2022-01-01, pieces ≥ 100 m. 95% CIs = percentile bootstrap over alerts (2000 resamples)._

## How each alert is judged

- **confirmed** — ≥ 50% of the alert lies within 40 m of a road OSM mapped after the baseline;
- **known false** — ≥ 50% lies within 25 m of a road OSM already had before the baseline (so it is not new);
- **unverified** — neither: a real road OSM has not mapped yet, or a false alert. OSM cannot tell, so these are reported, not guessed.

**Precision (verifiable)** = confirmed / (confirmed + known false). **Known-false rate** = known false / all alerts (KPI-3 proxy). **Recall** = share of newly mapped road length within 40 m of an alert.

## Ground truth per zone

| Zone | OSM roads T0 (km) | OSM roads T1 (km) | Newly mapped (km) | Pieces |
|---|---|---|---|---|
| A_vijayawada_west_bypass | 2757.8 | 3306.4 | 390.0 | 1369 |
| B_machilipatnam_port | 1165.3 | 1478.6 | 222.9 | 688 |
| C_gannavaram_nunna | 1096.7 | 1948.1 | 615.1 | 2041 |

## All zones pooled

| Method | Alerts | Confirmed | Known false | Unverified | Precision (verifiable) [95% CI] | Known-false rate [95% CI] | Recall (length) |
|---|---|---|---|---|---|---|---|
| RoadWatch (graph change + persistence ≥ 3 + stability + abstain) | 413 | 87 | 152 | 174 | 0.364 [0.305, 0.427] | 0.368 [0.324, 0.412] | 0.062 |
| RoadWatch + hysteresis baseline (2022 roads at p ≥ 0.3) | 448 | 74 | 230 | 144 | 0.243 [0.194, 0.296] | 0.513 [0.466, 0.558] | 0.048 |
| Ablation: without the stability rule | 762 | 129 | 298 | 335 | 0.302 [0.260, 0.349] | 0.391 [0.356, 0.425] | 0.082 |
| Ablation: without abstain (cloudy tiles count as 'absent') | 394 | 84 | 144 | 166 | 0.368 [0.307, 0.430] | 0.365 [0.320, 0.414] | 0.062 |
| Ablation: graph difference, 2 dates only (2022 vs 2026, no persistence) | 1573 | 263 | 533 | 777 | 0.330 [0.299, 0.364] | 0.339 [0.315, 0.363] | 0.121 |
| Baseline: pixel difference with 30 m tolerance | 1820 | 343 | 370 | 1107 | 0.481 [0.446, 0.516] | 0.203 [0.185, 0.221] | 0.122 |
| Baseline: pixel difference (post-classification, same model) | 6826 | 763 | 3029 | 3034 | 0.201 [0.188, 0.214] | 0.444 [0.432, 0.455] | 0.205 |

**KPI-3 (false-alert rate vs pixel-difference baseline, target ≥ 5% relative gain):** +17.1% vs naive pixel difference, -81.0% vs pixel difference with 30 m tolerance (positive = fewer known-false alerts per alert).

## Per zone

### A_vijayawada_west_bypass

| Method | Alerts | Confirmed | Known false | Unverified | Precision (verifiable) | Known-false rate | Recall |
|---|---|---|---|---|---|---|---|
| RoadWatch (graph change + persistence ≥ 3 + stability + abstain) | 155 | 31 | 81 | 43 | 0.277 [0.196, 0.366] | 0.523 [0.445, 0.600] | 0.085 |
| RoadWatch + hysteresis baseline (2022 roads at p ≥ 0.3) | 195 | 23 | 139 | 33 | 0.142 [0.093, 0.198] | 0.713 [0.646, 0.774] | 0.063 |
| Ablation: without the stability rule | 284 | 41 | 163 | 80 | 0.201 [0.147, 0.255] | 0.574 [0.514, 0.630] | 0.101 |
| Ablation: without abstain (cloudy tiles count as 'absent') | 155 | 31 | 81 | 43 | 0.277 [0.196, 0.366] | 0.523 [0.445, 0.600] | 0.085 |
| Ablation: graph difference, 2 dates only (2022 vs 2026, no persistence) | 547 | 78 | 276 | 193 | 0.220 [0.178, 0.266] | 0.505 [0.466, 0.547] | 0.146 |
| Baseline: pixel difference (post-classification, same model) | 2167 | 201 | 1314 | 652 | 0.133 [0.116, 0.150] | 0.606 [0.586, 0.629] | 0.227 |
| Baseline: pixel difference with 30 m tolerance | 539 | 119 | 166 | 254 | 0.418 [0.361, 0.474] | 0.308 [0.269, 0.345] | 0.157 |

### B_machilipatnam_port

| Method | Alerts | Confirmed | Known false | Unverified | Precision (verifiable) | Known-false rate | Recall |
|---|---|---|---|---|---|---|---|
| RoadWatch (graph change + persistence ≥ 3 + stability + abstain) | 99 | 13 | 38 | 48 | 0.255 [0.137, 0.392] | 0.384 [0.293, 0.485] | 0.022 |
| RoadWatch + hysteresis baseline (2022 roads at p ≥ 0.3) | 76 | 10 | 41 | 25 | 0.196 [0.098, 0.314] | 0.539 [0.434, 0.645] | 0.015 |
| Ablation: without the stability rule | 194 | 22 | 67 | 105 | 0.247 [0.157, 0.337] | 0.345 [0.278, 0.418] | 0.033 |
| Ablation: without abstain (cloudy tiles count as 'absent') | 80 | 10 | 30 | 40 | 0.250 [0.125, 0.376] | 0.375 [0.275, 0.487] | 0.020 |
| Ablation: graph difference, 2 dates only (2022 vs 2026, no persistence) | 443 | 51 | 130 | 262 | 0.282 [0.221, 0.348] | 0.293 [0.251, 0.336] | 0.070 |
| Baseline: pixel difference (post-classification, same model) | 2100 | 120 | 956 | 1024 | 0.112 [0.093, 0.131] | 0.455 [0.435, 0.477] | 0.143 |
| Baseline: pixel difference with 30 m tolerance | 524 | 50 | 94 | 380 | 0.347 [0.271, 0.424] | 0.179 [0.147, 0.212] | 0.072 |

### C_gannavaram_nunna

| Method | Alerts | Confirmed | Known false | Unverified | Precision (verifiable) | Known-false rate | Recall |
|---|---|---|---|---|---|---|---|
| RoadWatch (graph change + persistence ≥ 3 + stability + abstain) | 159 | 43 | 33 | 83 | 0.566 [0.461, 0.684] | 0.208 [0.145, 0.270] | 0.063 |
| RoadWatch + hysteresis baseline (2022 roads at p ≥ 0.3) | 177 | 41 | 50 | 86 | 0.451 [0.352, 0.549] | 0.282 [0.220, 0.350] | 0.051 |
| Ablation: without the stability rule | 284 | 66 | 68 | 150 | 0.493 [0.403, 0.575] | 0.239 [0.190, 0.289] | 0.088 |
| Ablation: without abstain (cloudy tiles count as 'absent') | 159 | 43 | 33 | 83 | 0.566 [0.461, 0.684] | 0.208 [0.145, 0.270] | 0.063 |
| Ablation: graph difference, 2 dates only (2022 vs 2026, no persistence) | 583 | 134 | 127 | 322 | 0.513 [0.452, 0.575] | 0.218 [0.185, 0.252] | 0.123 |
| Baseline: pixel difference (post-classification, same model) | 2559 | 442 | 759 | 1358 | 0.368 [0.339, 0.396] | 0.297 [0.279, 0.314] | 0.214 |
| Baseline: pixel difference with 30 m tolerance | 757 | 174 | 110 | 473 | 0.613 [0.556, 0.669] | 0.145 [0.122, 0.170] | 0.118 |

## Reading these numbers honestly

- **Newly mapped ≠ newly built.** Old village roads mapped after 2022 count as 'new' ground truth: precision is optimistic for alerts on them, and recall is pessimistic (we should not alert on roads that already existed).
- **OSM is incomplete**, especially for village and layout roads, so many alerts stay unverified; the review loop (accept / reject in the app) is the way to resolve them.
- Pixel-difference alerts are blobs, line alerts are road segments; counts are compared as 'things an analyst must check', the known-false rate as a share of them.
- Same model, same imagery, same zones for every method: differences come from the change logic alone (ablation).
