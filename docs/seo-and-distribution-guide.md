# SEO & Organic Community Distribution Playbook

This playbook provides actionable copy, post templates, keyword lists, and submission guidelines to maximize organic discovery for **KSEB Electricity Bills & Energy Analytics**.

---

## 1. Primary Keyword Targets (Kerala & Global SERPs)

| Query Category | High-Intent Keywords | Intent |
|---|---|---|
| **Bill Calculation** | `kseb bill calculator`, `kseb electricity bill calculation online`, `kseb tariff slabs 2025 2026`, `kseb slab rates kerala` | Transactional / Tool |
| **Solar Net Metering** | `kseb solar net metering rules`, `kseb solar bill calculation`, `kseb banked units settlement`, `solar net metering kerala` | Informational / Utility |
| **Account & Portal** | `kseb 13 digit consumer number`, `kseb bill download pdf`, `kseb bill history check` | Navigation / Utility |
| **Malayalam Localized** | `കെ.എസ്.ഇ.ബി ബിൽ കണക്കാക്കാൻ`, `സോളാർ നെറ്റ് മീറ്ററിംഗ് കേരള`, `കെഎസ്ഇബി താരിഫ് സ്ലാബുകൾ` | Regional SERP Dominance |
| **Self-Hosted & Tech** | `kseb api python`, `kseb home assistant`, `self-hosted utility tracker`, `kseb bill scraper` | Developer / Homelab |

---

## 2. GitHub Repository Optimization

When mirroring or publishing to GitHub:

* **Repository Title:** `kseb-bill-stats`
* **Short Description:**
  > Self-hosted KSEB electricity bill analytics, rooftop solar net-metering tracker, bi-monthly tariff calculator, and PDF parser for Kerala households.
* **Website Field:** `https://kseb.akjohn.dev`
* **Repository Topics / Tags (Add all 15):**
  `kseb`, `kerala`, `electricity-bills`, `solar-energy`, `net-metering`, `fastapi`, `python`, `home-assistant`, `homelab`, `self-hosted`, `energy-analytics`, `echarts`, `docker`, `tariff-calculator`, `open-source`

---

## 3. Reddit Launch Templates

### Template A: `r/Kerala` (Target: Everyday Consumers & Solar Owners)

**Title:**
> I built a free, privacy-first tool to calculate KSEB electricity slabs and track solar net-metering bills (with exact breakdown of telescopic vs non-telescopic traps)

**Body:**
```markdown
Namaskaram r/Kerala,

Like many here, I noticed how hard it is to decipher bi-monthly KSEB electricity bills—especially why crossing 500 units suddenly causes a bill shock, or how rooftop solar banked units and net-metering actually offset grid usage.

I built **KSEB Energy Analytics** (open-source and free):
👉 Live Tool & Calculator: https://kseb.akjohn.dev
👉 Code & Self-Hosting: https://github.com/<your-username>/kseb-bill-stats

### What it does:
1. **Interactive Bi-Monthly Slab Calculator (Zero Login):** Input your units to see the exact KERC LT-1A telescopic breakdown (0-80, 81-160, etc.), fixed charges, fuel surcharge, and 10% statutory duty. It also highlights the dangerous 500-unit non-telescopic threshold where slab benefits disappear.
2. **Solar Net-Metering & Banked Units Tracker:** For on-grid solar owners (PM Surya Ghar / ANERT), it calculates solar self-consumption, grid exports, net units, and tracked banked energy carryover to the September settlement cycle.
3. **True Cost per Unit (₹/kWh):** Calculates your whole-home energy spend divided by true consumption (grid imports + solar self-used).
4. **Automated Sync & PDF Multi-Upload:** Optionally sync directly with your 13-digit consumer number via official KSEB portals, or drag-and-drop your e-bill PDFs.
5. **100% Privacy-First:** Credentials encrypted with Fernet AES keys at rest, no advertising, downloadable JSON exports, and 1-click account erasure.

There is also an **"Explore Live Demo"** button on the homepage if you want to preview the dashboard with sample data without logging in.

Would love feedback from fellow KSEB consumers and solar households in Kerala!
```

---

### Template B: `r/selfhosted` & `r/homelab`

**Title:**
> Show Self-Hosted: KSEB Bill Stats — Private utility expense analytics, rooftop solar net-metering, and PDF ingestion built with FastAPI & ECharts

**Body:**
```markdown
Hey r/selfhosted,

I wanted to share a utility tracking application I built for my homelab to monitor electricity bills, solar generation, and tariff breakdowns for consumers of the Kerala State Electricity Board (KSEB).

### Tech Stack & Architecture:
- **Backend:** Python 3.12+, FastAPI, SQLAlchemy, AsyncIO, PyPDF.
- **Frontend:** Modern dark UI in vanilla HTML5/ES6+ with Apache ECharts and PWA push notifications.
- **Database:** PostgreSQL (production with CloudNativePG HA) / SQLite for local dev.
- **Security:** Credentials encrypted at rest using Fernet symmetric keys. Multi-tenant session cookies with SameSite strictness.
- **Integrations:** Zero-auth public tariff calculator, REST endpoints ready for Home Assistant Energy Dashboard.

GitHub: https://github.com/<your-username>/kseb-bill-stats
Live Instance & Demo: https://kseb.akjohn.dev

Feedback on the architecture and UI is very welcome!
```

---

## 4. WhatsApp & Telegram Community Templates (Kerala Solar Groups)

Targeting ANERT solar beneficiaries, PM Surya Ghar Kerala groups, and Residents Welfare Associations (RWAs):

**Malayalam Message:**
```text
⚡ കെ.എസ്.ഇ.ബി ബില്ലും സോളാർ നെറ്റ് മീറ്ററിംഗും കൃത്യമായി മനസ്സിലാക്കാൻ ഒരു സൗജന്യ ഓൺലൈൻ ടൂൾ!

കേരളത്തിലെ LT-1A ഗാർഹിക ഉപഭോക്താക്കൾക്കായി തയ്യാറാക്കിയ KSEB Bill Calculator & Solar Tracker:
👉 https://kseb.akjohn.dev

പ്രധാന സവിശേഷതകൾ:
✅ ലോഗിൻ ചെയ്യാതെ തന്നെ നിങ്ങളുടെ യൂണിറ്റുകൾ നൽകി ബിൽ തുക, ഫിക്സഡ് ചാർജ്, 10% ഡ്യൂട്ടി എന്നിവ കൃത്യമായി കണക്കാക്കാം.
✅ 500 യൂണിറ്റിന് മുകളിൽ പോകുമ്പോൾ വരുന്ന നോൺ-ടെലിസ്കോപ്പിക് താരിഫ് വ്യത്യാസം മനസ്സിലാക്കാം.
✅ റൂഫ്‌ടോപ്പ് സോളാർ ഉള്ളവർക്ക് ഇംപോർട്ട്, എക്സ്പോർട്ട്, ബാങ്ക്ഡ് യൂണിറ്റുകൾ എന്നിവ കണക്കുകൂട്ടാം.
✅ നിങ്ങളുടെ പഴയ KSEB PDF ബില്ലുകൾ അപ്‌ലോഡ് ചെയ്ത് വർഷങ്ങളിലെ ട്രെൻഡുകൾ പരിശോധിക്കാം.
✅ പൂർണ്ണമായും സുരക്ഷിതവും പരസ്യരഹിതവുമായ ഓപ്പൺ സോഴ്സ് പ്രൊജക്റ്റ്.

ലിങ്ക് സന്ദർശിച്ച് 'Live Demo' വഴി നേരിട്ട് കണ്ട് നോക്കാവുന്നതാണ്. ആവശ്യമുള്ള കൂട്ടുകാരുമായും ഗ്രൂപ്പുകളിലും ഷെയർ ചെയ്യുക!
```

---

## 5. Directory Submissions & Awesome-Lists

Submit Pull Requests to the following curated lists:

1. **`awesome-selfhosted`** (`github.com/awesome-selfhosted/awesome-selfhosted`):
   - Category: *Personal Finance / Expense Tracking* or *Energy Monitoring*
   - Entry: `[KSEB Bill Stats](https://github.com/<username>/kseb-bill-stats) - Self-hosted electricity bill analytics, rooftop solar net-metering tracker, and PDF parser for Kerala households. (Demo, Python)`
2. **`awesome-india`**:
   - Add under developer tools and civic tech.
3. **`selfh.st` Directory**:
   - Submit via their community app submission form.
