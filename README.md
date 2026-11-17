# KSEB Bill Stats: Electricity Bills & Energy Analytics

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.12+](https://img.shields.io/badge/Python-3.12%2B-blue.svg?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Modern%20API-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose%20Ready-2496ED.svg?logo=docker)](https://www.docker.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/)

> **Private, self-hosted Kerala State Electricity Board (KSEB) electricity bill analytics, rooftop solar net-metering tracker, bi-monthly tariff calculator, and automated PDF parser for Kerala households.**

---

## 📸 Screenshots

### 1. Electricity Overview
Comprehensive dashboard showing monthly billed spend (₹), whole-home electricity demand (kWh), on-site solar generation, and month-on-month trend analytics.

![Overview Dashboard](dashboard/screenshots/overview.png)

### 2. Solar & Energy Mix
Energy flow analysis separating on-site solar self-consumption from grid import/export, alongside solar coverage percentage and effective cost per unit (₹/kWh).

![Solar & Energy Mix](dashboard/screenshots/energy.png)

### 3. Historical Bill Ledger
Searchable, itemized table of all parsed KSEB bills with breakdown of imported units, exported units, total consumption, and effective tariff rates.

![Historical Bill Ledger](dashboard/screenshots/ledger.png)

### 4. Interactive Tariff Calculator & Portal
Zero-auth public tools including a bi-monthly LT-1A slab calculator, solar net-metering estimator, and full Kerala tariff documentation.

![Sign In Screen](dashboard/screenshots/login.png)

### 5. Responsive Mobile View
Optimized for mobile viewports with sticky navigation, fluid metric cards, and responsive chart legends.

![Mobile Overview](dashboard/screenshots/mobile_overview.png)

---

## ⚡ Kerala Domestic Electricity Tariff (LT-1A Explained)

In Kerala, domestic energy consumers are billed **bi-monthly** (every two months) under the Kerala State Electricity Regulatory Commission (KERC) LT-1A schedule:

* **Telescopic Billing (≤ 500 units bi-monthly / ≤ 250 units/month):** Consumption is billed progressively across discounted slabs:
  * `0 - 80 units`: ₹3.50 / unit
  * `81 - 160 units`: ₹4.20 / unit
  * `161 - 200 units`: ₹4.80 / unit
  * `201 - 280 units`: ₹5.80 / unit
  * `281 - 300 units`: ₹6.60 / unit
  * `301 - 400 units`: ₹7.30 / unit
  * `401 - 500 units`: ₹8.40 / unit
* **Non-Telescopic Billing (> 500 units bi-monthly):** If consumption exceeds 500 units, **no telescopic slab benefits apply**. All units are charged at a flat rate (e.g. ₹6.60 to ₹9.50/unit), causing a sudden steep jump in total bill spend.
* **Additional Statutory Charges:** Fixed Charge (Single-phase vs Three-phase), 10% statutory Electricity Duty, notified Fuel Surcharge, and Meter Rent with GST.

---

## ☀️ Rooftop Solar Net-Metering & Banked Units

For households with grid-tied rooftop solar (PM Surya Ghar / ANERT):
* **Bidirectional Metering:** Automatically offsets energy imported from the grid against surplus solar exported.
* **Unit Banking:** When solar export exceeds grid import, surplus units are banked in KSEB's ledger and carried forward to offset future cycles.
* **Annual September Settlement:** Banked units are settled annually on September 30 at the KERC-notified Average Power Purchase Cost (APPC).
* **True Unit Cost (₹/kWh):** Calculates your actual cost per unit by factoring in both grid bills and on-site self-consumed solar energy.

---

## ✨ Features

- **Automated Bill Sync:** Direct encrypted sync with the KSEB Web Self-Service portal using your consumer number and registered mobile number.
- **Solar Net-Metering Intelligence:** Automatically calculates self-consumed solar energy vs. exported units, giving an accurate picture of total household power demand.
- **Real Unit Cost (₹/kWh):** Computes your true cost per unit by dividing total bill charges by whole-home consumption.
- **Multi-PDF Upload & Parsing:** Drag-and-drop multiple official KSEB e-bill PDFs for automated parsing and archive population.
- **Itemized Ledger with Live Search:** Quickly search and filter through historical bills by month, year, or amount.
- **Dynamic Timeframe Filters:** Seamlessly switch between `3M`, `6M`, `1Y`, `All Bills`, or a custom date range.
- **Web Push Alerts:** Optional browser push notifications when a new KSEB billing cycle is detected and parsed.
- **100% Privacy & Data Control:** Multi-tenant architecture with encrypted credentials at rest, downloadable JSON data exports, and 1-click permanent data erasure.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.12+, FastAPI, SQLAlchemy, Uvicorn, AsyncIO, PyPDF / PDF parsing
- **Frontend:** HTML5, CSS3 (Modern responsive theme), JavaScript (ES6+), Apache ECharts
- **Database:** PostgreSQL (production) / SQLite (testing & lightweight deployments)
- **Deployment:** Docker, Docker Compose, Nginx / Reverse Proxy with TLS

---

## 🚀 Quick Start

### Option A: Running with Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd kseb-bill-stats
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

3. Start services:
   ```bash
   docker compose up --build -d
   ```

4. Open [http://localhost:8000](http://localhost:8000) in your browser.

---

### Option B: Local Python Development Setup

1. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment:
   ```bash
   cp .env.example .env
   ```

4. Run database migrations / start application:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

5. Run test suite:
   ```bash
   pytest
   ```

---

## ⚙️ Configuration & Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `APP_SECRET_KEY` | Secret key used for cryptographic sessions | `dev-secret` |
| `FIELD_ENCRYPTION_KEY` | Fernet key for encrypting stored credentials at rest | - |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://kseb:kseb@postgres:5432/kseb` |
| `LOCAL_STORAGE_ROOT` | Directory for storing uploaded bill PDFs | `/data/storage` |
| `SESSION_COOKIE_SECURE` | Enforce HTTPS for session cookies (`true` in prod) | `false` |
| `VAPID_PUBLIC_KEY` | Public key for Web Push notifications | - |
| `VAPID_PRIVATE_KEY` | Private key for Web Push notifications | - |

---

## 📖 Documentation & Guides

- [Home Assistant Integration Guide](docs/home-assistant.md) — Monitor KSEB bills & solar sensors inside Home Assistant Energy Dashboard.
- [Community Growth & Distribution Playbook](docs/seo-and-distribution-guide.md) — Reddit showcase posts, WhatsApp/Telegram solar templates, and directory listings.
- [Deployment Checklist](docs/deployment-checklist.md) — Pre-launch checklist for production deployments.
- [Production Architecture](docs/production-architecture.md) — Detailed explanation of multi-tenant isolation, background workers, and security controls.

---

## 📄 License

MIT License. Designed and engineered for Kerala energy consumers.
