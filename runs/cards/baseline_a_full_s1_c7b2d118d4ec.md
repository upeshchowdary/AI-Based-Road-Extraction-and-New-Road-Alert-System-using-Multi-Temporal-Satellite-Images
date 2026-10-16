# Teammate Run Card — baseline_a_full_s1_c7b2d118d4ec

| | |
|---|---|
| Person | **A** (Spatial evidence & provenance lead) |
| Model / run | baseline_a / full_s1 (seed 1) |
| Config hash | `c7b2d118d4ec` |
| GPU time | about **1.0 h** of your weekly 6 h Kaggle GPU quota (hard stop built in) |
| Your time | ~10 min to start + ~5 min to download at the end. Laptop can be OFF while it runs. |

## A. Start the run (~10 min)

1. Download the notebook file: open
   https://github.com/upeshchowdary/AI-Based-Road-Extraction-and-New-Road-Alert-System-using-Multi-Temporal-Satellite-Images/blob/main/kaggle/cards/baseline_a_full_s1.ipynb
   → click the **Download raw file** button (down-arrow icon, top-right of the file view).
2. Open https://www.kaggle.com/code → click **+ New Notebook** (top-left).
3. In the notebook editor: menu **File → Import Notebook** → **Browse Files** → pick
   `baseline_a_full_s1.ipynb` → **Import**. (If asked "replace current notebook?" → yes.)
4. Right sidebar → **Input** section → **+ Add Input** → search `deepglobe road extraction`
   → pick **DeepGlobe Road Extraction Dataset** by *balraj98* → click the **+** → close.
5. Right sidebar → **Session options**:
   - **Accelerator** → **GPU T4 x2**
   - **Internet** → **On** (needs a phone-verified account)
6. Rename the notebook (top-left title) to: `roadwatch-baseline-a-full-s1`
7. Top-right **Save Version** → choose **Save & Run All (Commit)** → **Save**.
8. You should see "Version 1 · Running". You can close the browser and switch off the laptop.

## B. When it finishes (~1.0 h later)

1. Open https://www.kaggle.com/code → **Your Work** → `roadwatch-baseline-a-full-s1` → status **Succeeded**.
2. Click the **Output** tab → **Download All** (a zip, ~600 MB).
   Slow internet? Download only these small files instead (click each → download icon):
   `metrics.json`, `timing.json`, `train_log.csv`, `per_image_val.csv`, `per_image_test.csv`.
3. Upload the zip (or the small files) to your Google Drive → right-click → **Share** →
   **Anyone with the link** → **Copy link** → send the link to the project lead.
4. Reply in the group: `done baseline_a_full_s1_c7b2d118d4ec` + the **val IoU** printed at the end of the log
   (Logs tab → last lines contain `TEST:` and `best_val_iou`).

## If stuck
- "GPU quota exceeded" → you have used your 6 h this week; tell the lead (quota resets Saturday).
- "Internet must be verified" → Kaggle **Settings → Phone Verification** first.
- Red error in the log → screenshot the last 20 lines of the **Logs** tab and send it.
