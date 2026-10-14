# Train on Kaggle

Two ways: **A** (lead, from the laptop, one command) and **B** (teammates, in the browser, no code).
Free GPU quota: **6 h per week per account** (resets Saturday 05:30 IST). Check yours:
`uv run --extra kaggle --env-file .env kaggle quota`.

## A. Lead — from the laptop

```powershell
# 0. never spend GPU on a crash: CPU smoke test first (once per code change)
data_cache\smoke_venv\Scripts\python.exe scripts\smoke_train.py baseline_a

# 1. push a run defined in kaggle/<model>/runs.yaml (config is injected + hashed, row added to runs/RUN_LOG.csv)
uv run --extra kaggle --env-file .env python scripts/kaggle_push.py baseline_a full_s0

# 2. check progress (laptop can be off meanwhile — it runs in Kaggle commit mode)
uv run --extra kaggle --env-file .env python scripts/kaggle_push.py baseline_a full_s0 --status

# 3. when COMPLETE: download outputs to data_cache/runs/<model>_<run>/
uv run --extra kaggle --env-file .env python scripts/kaggle_push.py baseline_a full_s0 --fetch
```

You can also watch it in the browser: https://www.kaggle.com/code → **Your Work** → the run →
**Logs** tab (shows lines only after the run finishes) / **Output** tab.

## B. Teammates — in the browser

The lead generates a card: `uv run python scripts/make_run_card.py baseline_a full_s1 --person A`.
That writes `runs/cards/<run_id>.md` (the steps) and `kaggle/cards/<model>_<run>.ipynb` (the notebook).
Send the teammate the link to their card on GitHub; the card has every click.

## Upload a checkpoint to Hugging Face (lead)

```powershell
uv run --extra kaggle --env-file .env huggingface-cli upload roadwatch-ap/baseline-a data_cache/runs/baseline_a_full_s0/ckpt_best.pt full_s0/ckpt_best.pt --repo-type model --private
```
Then paste the link into the `checkpoint_link` column of `runs/RUN_LOG.csv`.

## Rules (PROJECT_PROMPT.md 7.5, ADR-013)
- First run of a new model = 1-epoch timing run → estimate hours → ask before > 8 h in one run.
- Every GPU run has `max_hours` (hard, resumable stop). Re-push with `resume_dir` to continue.
- 3 seeds for final numbers, split across team accounts.
