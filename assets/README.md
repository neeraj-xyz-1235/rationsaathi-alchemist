# RationSaathi — Frontend Step 1: Landing Page

This local workspace implements the landing page described in `plans/plan_frontend.txt`. The original team blueprint is included at `frontend/src/assets/rationsaathi-blueprint.png`.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

## Scope of this step

- Shared responsive header and English / Hindi / Marathi language switch
- Landing hero and three action cards
- Four-step “How it works” section
- Nearest ration shop banner marked as coming soon (no fabricated shop locations)
- Neutral information notice and shared footer
- Accessible Help dialog, keyboard focus styling, reduced-motion support
- Router stubs for `/check`, `/shops`, `/help` so the landing actions have safe destinations while those pages are built in their planned steps

Calculation stays in the backend; this landing page does not calculate entitlements. No existing backend files are changed.

## Collaboration note

The connected GitHub token currently reports read-only permissions (`push: false`). This package was prepared locally; no GitHub branch or commits were created. Once write access is available, place `frontend/` into the repository and open a pull request from a feature branch rather than pushing directly to `main`.
