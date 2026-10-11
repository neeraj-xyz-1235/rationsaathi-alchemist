<div align="center">

# 🌾 RationSaathi

### Your ration entitlement companion

**Know what your household is owed. Record what you actually received. Keep the receipts.**
In English, हिन्दी and मराठी.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Postgres](https://img.shields.io/badge/Postgres-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech)
[![Tests](https://img.shields.io/badge/backend%20tests-442%20passing-2ea44f)](#-testing)
[![Languages](https://img.shields.io/badge/languages-EN%20%C2%B7%20HI%20%C2%B7%20MR-orange)](#-three-languages)

[**Live app**](https://rationsaathi-alchemist-frontend.vercel.app) · [**API health**](https://rationsaathi-alchemist.onrender.com/api/health)

</div>

---

## 🤔 The problem

Millions of households collect subsidised grain from a ration shop every month. Most of them have no easy way to answer three simple questions:

1. **How much should we get this month?**
2. **How much did we actually get?**
3. **Can we prove it?**

RationSaathi answers all three, privately, on a phone, in the family's own language.

> ℹ️ RationSaathi is an **independent information tool, not a government service**. It never contacts a government portal and never files anything for you.

---

## ✨ What it does

| | Feature | What you get |
|---|---|---|
| 🏠 | **Household setup** | Head of family, members, state, district and ration-card category, saved once. |
| 🪪 | **Eligibility proof** | Upload a photo of the ration card. A vision AI transcribes it, and plain rules compare it with what you typed. |
| 🧮 | **Monthly entitlement** | Your allocation, worked out from card category and household size. |
| 📦 | **Withdrawals** | Record each collection. Over-collecting is blocked, and the balance is exact to the gram. |
| 🧾 | **Receipt photo → auto-fill** | Photograph the shop receipt. The item, quantity, date and receipt number are **read from it and filled into the form for you**. |
| 📄 | **Downloadable PDFs** | A receipt for every withdrawal and a monthly report. |
| ✉️ | **Email the report** | Sends the PDF to your own account email, never to anyone else. |
| 🔎 | **Verify a receipt** | Anyone can check a receipt ID or verification code. Only item, quantity and date are shown. |
| 🗓️ | **Monthly tracker** | A calendar of every day you collected ration. |
| 🔔 | **Live notifications** | "Rice is running low", "month ending soon", "calculate this month's allocation", and so on. Worked out from real data, with nothing faked. |
| 🗺️ | **Ration-shop map** | Nearby shops from OpenStreetMap, plus a **tap-to-pin** map for the shops you know. |
| 🌐 | **Three languages** | The whole workspace in English, Hindi and Marathi. |

---

## 🧠 How the AI is used (and how it isn't)

This project treats AI as a **reader, never a judge**.

```
   photo ──► vision AI ──► raw text only ──► plain Python rules ──► verified / mismatch
            (transcribes)   "Wheat", "2", "kg"   exact integer maths      + the real outcome is kept
```

- The model only **transcribes** what is printed. It never converts a unit, adds a number or decides anything.
- Every comparison is **exact integer arithmetic** on grams and millilitres. There are no floats and no rounding.
- If the AI is down, slow or wrong, the app **keeps working**. The form just stays manual.
- Photos are **never stored**. Only the result and a SHA-256 hash are kept, to stop one photo proving two withdrawals.
- Any AI failure falls back to a regex reader, or to a "could not be read" message. It never invents values.

Works with **any OpenAI-compatible API**: Groq, Gemini, OpenRouter or a local Ollama.

---

## 🏗️ Architecture

```
 ┌────────────────────┐     /api/*      ┌──────────────────────┐      ┌──────────────┐
 │  React 19 + Vite   │ ──────────────► │   FastAPI backend    │ ───► │   Postgres   │
 │  Tailwind 4, i18n  │  same-origin    │  server-side sessions│      │ (Neon / SQLite│
 │  Leaflet map       │  (cookie stays  │  exact-integer engine│      │  for dev)    │
 │   on Vercel        │   first-party)  │   on Render          │      └──────────────┘
 └────────────────────┘                 └───────┬──────────────┘
                                                │
                       ┌────────────────────────┼─────────────────────────┐
                       ▼                        ▼                         ▼
              Vision / text AI           Resend / Brevo              OpenStreetMap
              (Groq, Gemini, …)          (HTTPS email API)           (Overpass)
```

The browser only ever talks to **its own origin**. Vercel rewrites `/api/*` to Render, so the session cookie stays first-party and CSRF is checked on `Origin`.

---

## 🧰 Tech stack

| Layer | Choices |
|---|---|
| **Frontend** | React 19, Vite 7, react-router 7, Tailwind 4, Leaflet, lucide-react |
| **Backend** | FastAPI, Pydantic v2 (strict, `extra="forbid"`), SQLAlchemy 2 |
| **Database** | SQLite for local dev, Postgres (Neon) in production |
| **Auth** | argon2id passwords, server-side sessions, HttpOnly `SameSite=Lax` cookie |
| **PDF / email** | fpdf2, Jinja2, Resend or Brevo over HTTPS |
| **AI** | Any OpenAI-compatible chat API, with an optional vision model |
| **Tests** | pytest (backend), Playwright-driven browser runs |

---

## 🚀 Run it locally

You need **Python 3.11+** and **Node 20+**.

```bash
git clone https://github.com/neeraj-xyz-1235/rationsaathi-alchemist.git
cd rationsaathi-alchemist
```

**1. Backend** (http://127.0.0.1:8000)

```bash
cd backend
python -m venv venv && source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                  # the defaults work as they are
uvicorn app.main:app --reload --port 8000
```

**2. Frontend** (http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to the backend. Open the site, create an account, and you are in.

**Check it is alive**

```bash
curl http://127.0.0.1:8000/api/health
# {"status":"ok","db":"ok","llm":"not_configured","vision":"not_configured","email":"not_configured"}
```

The optional AI and email features switch on as you add their keys (below). **Nothing breaks without them.**

---

## ⚙️ Configuration

Everything is an environment variable (`backend/.env` locally, the host's settings in production).

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Postgres URL, or empty for local SQLite | `sqlite:///./dev.db` |
| `APP_ORIGIN` | Allowed site origin(s), comma separated (CSRF check) | `http://localhost:5173` |
| `COOKIE_SECURE` | `true` in production (HTTPS) | `false` |
| `ENABLE_DOCS` | Serve `/docs` | `true` (set `false` in production) |
| `LLM_BASE_URL` · `LLM_API_KEY` · `LLM_MODEL` | Text AI for pasted receipt text | empty = regex reader |
| `LLM_VISION_MODEL` | **Vision model** for card and receipt photos | empty = photos are not read |
| `EMAIL_PROVIDER` · `EMAIL_API_KEY` · `EMAIL_FROM` | `brevo` or `resend` | empty = email off |
| `PROOF_AUTO_ACCEPT` | Accept every household proof (hackathon switch) | `true` |
| `RECEIPT_PROOF_AUTO_ACCEPT` | Report every receipt photo as verified (hackathon switch) | `true` |

Groq example:

```env
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=<your key>
LLM_MODEL=llama-3.3-70b-versatile
LLM_VISION_MODEL=<a vision-capable model id from your provider>
```

> 🔐 **Never commit keys.** `.env` is git-ignored. If a key ever leaks, delete it and create a new one.

---

## 🌍 Deployment

| Piece | Where | Notes |
|---|---|---|
| Frontend | **Vercel** | `frontend/vercel.json` rewrites `/api/*` to the backend and sets the security headers. **Do not delete it**, or every API call 404s. |
| Backend | **Render** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Database | **Neon** | Tables are created automatically on start-up. |
| Email | Resend or Brevo | Render's free tier blocks SMTP, so email goes over HTTPS. |

---

## 🗂️ Project layout

```
rationsaathi-alchemist/
├── frontend/                 React app (pages, i18n, Leaflet map)
│   ├── src/pages/            Setup, entitlement, withdrawals, tracker, reports, shops …
│   ├── src/i18n/             English · Hindi · Marathi strings
│   └── vercel.json           API rewrite + security headers
├── backend/
│   ├── app/
│   │   ├── engine/           exact-integer units, calculator, labels, balance
│   │   ├── proof/            vision reader + deterministic matching rules
│   │   ├── parser/           receipt-text normaliser (regex + LLM)
│   │   ├── documents/        PDF receipt and report
│   │   ├── routers/          auth, household, entitlements, withdrawals, shops, …
│   │   ├── security/         CSRF, rate limits, body-size limits
│   │   └── email/            templates (en / hi / mr) and sender
│   ├── scripts/              smoke test, dev helpers, try_receipt.py
│   └── tests/                442 tests
└── plans/                    the original design documents
```

---

## 🛡️ Security and privacy

- **argon2id** password hashing and **server-side sessions**, so there is no JWT in the browser.
- **CSRF** protection by `Origin`/`Referer`, and JSON-only request bodies. The two upload routes are the only multipart exceptions.
- **Rate limits** on login, signup, parsing, uploads, receipt checks, shop lookups and email, with the strict ones stored in the database.
- **Request size limits**, and file type is judged by the file's **own bytes**, not its name.
- **One error shape** everywhere, and no stack traces ever reach the client.
- **Your data stays yours.** Everything is scoped to the signed-in account. Reports email only to your own address.
- Your **exact location is never stored or logged**, and the shop lookup rounds it to about 1 km before asking a third party.

---

## 🧪 Testing

```bash
cd backend
python -m pytest -q          # 442 tests, about a minute
python scripts/smoke.py      # end-to-end against a running server
```

Try the receipt reader on any photo, with every step printed:

```bash
python scripts/try_receipt.py path/to/receipt.jpg
```

---

## ⚠️ Honest limitations

This began as a hackathon project, so here is what is real and what is not.

- **Allocation numbers are an assumption.** They use the central NFSA headline figures (5 kg per person for Priority Households, 35 kg per household for AAY) with a fixed rice and wheat split. States set their own, so replace the table in `backend/app/entitlements/rules.py` before real use.
- **Proof checks are in "accept everything" mode.** `PROOF_AUTO_ACCEPT` and `RECEIPT_PROOF_AUTO_ACCEPT` default to `true`. The real result is still saved in each record, and setting both to `false` enforces the checks.
- **The AI accuracy on real receipts is untested.** The checks were developed against mocked and sample receipts.
- **OpenStreetMap has very few ration shops.** That is why the tap-to-pin map exists. The public Overpass servers are also sometimes busy.
- **PDFs print English text only.** Hindi and Marathi names show as `?` until a Devanagari font is embedded.
- **The Hindi and Marathi translations are a first draft** and need a native-speaker review. The Privacy, Terms and Cookies pages are English only.
- Withdrawals are not locked against two simultaneous requests, so a very quick double-submit could slightly exceed a balance.

---

## 🗺️ What could come next

- Embed a Devanagari font for PDFs and emails
- State-wise allocation rules and a verified shop directory (state ePDS data)
- A human review queue for proofs that don't match
- Offline-friendly installable PWA
- QR code on receipts for one-tap verification

---

<div align="center">

**Built with care for the families who stand in the queue.** 🌾

*RationSaathi is an independent tool. Official scheme rules and the competent authority are always the source of truth.*

</div>
