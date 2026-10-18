# Teammate Run Card — template

Cards are generated, not hand-written: `uv run python scripts/make_run_card.py <model> <run> --person <A|B|C|D>`.
The generator fills this structure (see `scripts/make_run_card.py::CARD`):

1. Header table — person + role, model/run/seed, config hash, GPU hours from *their* 30 h/week, their own time.
2. **A. Start the run** — download the notebook from GitHub → Kaggle **+ New Notebook** → **File → Import
   Notebook** → **+ Add Input** (dataset) → **Session options** (GPU T4 x2, Internet On) → rename →
   **Save Version → Save & Run All (Commit)**.
3. **B. When it finishes** — **Output → Download All** → send Drive link → reply `done <run_id>` + val IoU.
4. **If stuck** — quota exceeded, phone verification, red error → screenshot last 20 log lines.

Each issued card adds a `card_issued` row to `runs/RUN_LOG.csv`; the lead fills end time, GPU hours,
result and checkpoint link when the output arrives. That row is the teammate's contribution evidence.
