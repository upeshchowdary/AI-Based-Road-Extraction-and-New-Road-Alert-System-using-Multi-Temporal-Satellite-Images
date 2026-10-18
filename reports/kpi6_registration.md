# KPI-6 — Multi-date registration error (Sentinel-2 composites)

_Generated 2026-10-18 by `scripts/registration_report.py`. Each zone tile of every season is compared with the 2022_pre_monsoon composite: sub-pixel phase correlation on B08, over pixels valid in both; 95% CI = bootstrap over tile pairs. 1 px = 10 m._

**Result:** over 522 measurable tile pairs the shift is median **0.071 px** (0.7 m), P90 0.158 px, mean 0.079 px (95% CI [0.074, 0.084]); 100% are within the 1 px quality gate (`qa.max_registration_error_px`) and 100% within 0.5 px.

**Not measurable (26 pairs, listed below):** tiles that are mostly open water (> 50% of pixels with NIR < 30) or whose correlation peak lands > 5 px away - physically impossible for Sentinel-2 L2A, so a failed measurement, not a geometric error. Also skipped: 12 pairs with < 30% pixels valid in both (cloud).

## By zone

| Group | Tile pairs | Mean shift px [95% CI] | Median | P90 | Max | ≤ 0.5 px | ≤ gate |
|---|---|---|---|---|---|---|---|
| All zones | 522 | **0.079** [0.074, 0.084] | 0.071 | 0.158 | 0.27 | 100% | 100% |
| Zone A | 160 | **0.057** [0.051, 0.064] | 0.050 | 0.112 | 0.21 | 100% | 100% |
| Zone B | 162 | **0.121** [0.113, 0.131] | 0.112 | 0.180 | 0.27 | 100% | 100% |
| Zone C | 200 | **0.063** [0.057, 0.070] | 0.050 | 0.112 | 0.21 | 100% | 100% |

## By season (vs the 2022 pre-monsoon reference)

| Group | Tile pairs | Mean shift px [95% CI] | Median | P90 | Max | ≤ 0.5 px | ≤ gate |
|---|---|---|---|---|---|---|---|
| 2022 post monsoon | 66 | **0.115** [0.100, 0.131] | 0.112 | 0.206 | 0.27 | 100% | 100% |
| 2023 post monsoon | 63 | **0.101** [0.090, 0.113] | 0.112 | 0.156 | 0.21 | 100% | 100% |
| 2023 pre monsoon | 66 | **0.020** [0.014, 0.026] | 0.000 | 0.050 | 0.07 | 100% | 100% |
| 2024 post monsoon | 66 | **0.099** [0.090, 0.109] | 0.100 | 0.154 | 0.21 | 100% | 100% |
| 2024 pre monsoon | 66 | **0.074** [0.067, 0.081] | 0.071 | 0.112 | 0.15 | 100% | 100% |
| 2025 post monsoon | 63 | **0.084** [0.069, 0.099] | 0.071 | 0.158 | 0.22 | 100% | 100% |
| 2025 pre monsoon | 66 | **0.066** [0.056, 0.076] | 0.050 | 0.112 | 0.16 | 100% | 100% |
| 2026 pre monsoon | 66 | **0.077** [0.062, 0.092] | 0.050 | 0.180 | 0.21 | 100% | 100% |

## Not measurable

| Tile | Zone | Season | Correlation result px | Water fraction | Reason |
|---|---|---|---|---|---|
| `T32644_10m_512_101_347` | B | 2022_post_monsoon | 0.2 | 77% | mostly water |
| `T32644_10m_512_101_347` | B | 2023_pre_monsoon | 0.0 | 77% | mostly water |
| `T32644_10m_512_101_347` | B | 2024_pre_monsoon | 0.1 | 77% | mostly water |
| `T32644_10m_512_101_347` | B | 2024_post_monsoon | 0.1 | 77% | mostly water |
| `T32644_10m_512_101_347` | B | 2025_pre_monsoon | 0.1 | 77% | mostly water |
| `T32644_10m_512_101_347` | B | 2026_pre_monsoon | 0.2 | 77% | mostly water |
| `T32644_10m_512_102_347` | B | 2022_post_monsoon | 145.2 | 98% | mostly water |
| `T32644_10m_512_102_347` | B | 2023_pre_monsoon | 222.2 | 98% | mostly water |
| `T32644_10m_512_102_347` | B | 2024_pre_monsoon | 244.8 | 98% | mostly water |
| `T32644_10m_512_102_347` | B | 2024_post_monsoon | 268.4 | 98% | mostly water |
| `T32644_10m_512_102_347` | B | 2025_pre_monsoon | 0.0 | 98% | mostly water |
| `T32644_10m_512_102_347` | B | 2026_pre_monsoon | 171.6 | 98% | mostly water |
| `T32644_10m_512_102_348` | B | 2022_post_monsoon | 156.1 | 99% | mostly water |
| `T32644_10m_512_102_348` | B | 2023_pre_monsoon | 226.1 | 99% | mostly water |
| `T32644_10m_512_102_348` | B | 2024_pre_monsoon | 215.8 | 99% | mostly water |
| `T32644_10m_512_102_348` | B | 2024_post_monsoon | 262.2 | 99% | mostly water |
| `T32644_10m_512_102_348` | B | 2025_pre_monsoon | 215.4 | 99% | mostly water |
| `T32644_10m_512_102_348` | B | 2026_pre_monsoon | 225.8 | 99% | mostly water |
| `T32644_10m_512_102_349` | B | 2022_post_monsoon | 0.1 | 90% | mostly water |
| `T32644_10m_512_102_349` | B | 2023_pre_monsoon | 0.0 | 90% | mostly water |
| `T32644_10m_512_102_349` | B | 2023_post_monsoon | 0.1 | 90% | mostly water |
| `T32644_10m_512_102_349` | B | 2024_pre_monsoon | 0.1 | 90% | mostly water |
| `T32644_10m_512_102_349` | B | 2024_post_monsoon | 0.1 | 90% | mostly water |
| `T32644_10m_512_102_349` | B | 2025_pre_monsoon | 0.1 | 90% | mostly water |
| `T32644_10m_512_102_349` | B | 2025_post_monsoon | 0.1 | 90% | mostly water |
| `T32644_10m_512_102_349` | B | 2026_pre_monsoon | 0.1 | 90% | mostly water |

## Reading this honestly

- These shifts are an **upper bound**: crop cycles, water levels and construction between seasons also move the correlation peak, so not all of the measured shift is geometric error.
- No extra co-registration step exists yet: the composites rely on the Sentinel-2 L2A geolocation. The charter's KPI-6 target (≤ 0.80 × the O2 reference) therefore has no separate reference to beat yet - this table is that reference.
- The gate is tested (NT-4, `reports/negative_tests.md`) but not yet enforced per tile inside `s2-build`.
