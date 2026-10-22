# KPI-1 graph metric — APLS on holdout zones A–C

_Generated 2026-10-22 by `scripts/apls_report.py`. Model `s2_model_full_s0_6e9081638291`, season 2026_pre_monsoon. Reference = OpenStreetMap roads in the zone (© OpenStreetMap contributors, ODbL). APLS = harmonic mean of both directions; control points every 25 m, snap ≤ 25 m, 1000 pairs per direction, paths ≥ 200 m (`src/roadwatch/qa/apls.py`)._

| Zone | Reference | OSM km | Our km | APLS | ref → ours | ours → ref |
|---|---|---|---|---|---|---|
| A_vijayawada_west_bypass | all roads | 3303.9 | 786.3 | **0.004** | 0.002 | 0.625 |
| A_vijayawada_west_bypass | all roads + gap closing | 3303.9 | 786.3 | **0.004** | 0.002 | 0.669 |
| A_vijayawada_west_bypass | major roads | 722.5 | 786.3 | **0.008** | 0.004 | 0.096 |
| A_vijayawada_west_bypass | major roads + gap closing | 722.5 | 786.3 | **0.008** | 0.004 | 0.127 |
| B_machilipatnam_port | all roads | 1480.8 | 631.8 | **0.040** | 0.021 | 0.507 |
| B_machilipatnam_port | all roads + gap closing | 1480.8 | 631.8 | **0.040** | 0.021 | 0.536 |
| B_machilipatnam_port | major roads | 327.6 | 631.8 | **0.053** | 0.035 | 0.110 |
| B_machilipatnam_port | major roads + gap closing | 327.6 | 631.8 | **0.053** | 0.035 | 0.106 |
| C_gannavaram_nunna | all roads | 1965.7 | 683.4 | **0.004** | 0.002 | 0.628 |
| C_gannavaram_nunna | all roads + gap closing | 1965.7 | 683.4 | **0.004** | 0.002 | 0.618 |
| C_gannavaram_nunna | major roads | 423.7 | 683.4 | **0.024** | 0.013 | 0.157 |
| C_gannavaram_nunna | major roads + gap closing | 423.7 | 683.4 | **0.024** | 0.013 | 0.140 |

Gap closing (ADR-028): links added per zone — A_vijayawada_west_bypass 16, B_machilipatnam_port 7, C_gannavaram_nunna 19.

**Reading it:** *ref → ours* asks whether routes on the real network can be driven on our map (low = missing or broken roads); *ours → ref* asks whether routes on our map exist for real (low = false or wrongly connected roads). Against all OSM roads the score is held down by residential lanes that 10 m pixels cannot resolve; the major-road row is the fairer reading for a Sentinel-2 model.
