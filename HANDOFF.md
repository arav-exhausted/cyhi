# Handoff - lifecooked

> Updated 2026-09-12T14:05:22+00:00 by aravprajapat1102 (session 0912-1053, track 3)
> Read this first. The full log is cyhi-logs/session.md.

## Current state
Working on Track 3: AI-powered wellbeing layer with browser extension feed filtering. Data preprocessed and cleaned in model/model.ipynb (159,571 comments from Jigsaw benchmark). Investigating class imbalance and sampling strategies before TF-IDF vectorization and model training.

## Works
- Cleaned text preprocessing pipeline (HTML entity decoding, URL stripping, IP and header removal).
- Label verification and null handling across all 6 toxic target classes.
- Full dataset integrity checked with 15,294 toxic comments preserved.

## Broken
- Nothing broken. Clarifying class imbalance distribution and sampling vs balanced loss weighting.

## Next 3 things
1. Address user question on class imbalance: Explain natural real-world prevalence vs balanced loss weighting / stratified re-sampling.
2. Run TF-IDF vectorization (word + char n-grams) on balanced or class-weighted training split.
3. Train multi-output logistic regression classifiers with sensitivity scoring (Levels 1-4) and export joblib artifacts.

## Decisions (and why)
- Train on full comments rather than pre-chunked sentences: Prevents label noise where neutral sentences inside toxic comments get falsely labeled toxic.
- Use Dual TF-IDF (word (1,2) + char (2,6)) + LogisticRegression: Optimal for CPU execution (<50s train, <2ms inference per sentence), critical for real-time browser extension filtering.

## Don't retry
- Don't download more raw data; 160k rows is already substantial.
- Don't use heavy Transformer fine-tuning on CPU without GPU (would take >12h and introduce high inference latency).
