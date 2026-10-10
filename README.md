<p align="center">
  <img src="labstock-a1-logo/png/yatay-rozet.png" alt="LabStock" width="320">
</p>

<p align="center"><b>English</b> · <a href="README.tr.md">Türkçe</a></p>

<h3 align="center">Never ask “which drawer was that resistor in?” again.</h3>

<p align="center">
  A free inventory app for electronic components — it knows which box every part
  is in and how many are left, prints QR labels, fills in part data from LCSC codes
  and shop links, counts parts with your phone camera, and answers questions about
  your stock with an AI assistant.
</p>

<p align="center">
  <a href="https://github.com/recepuysal/labstock/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/recepuysal/labstock?label=release&color=a3611f"></a>
  <a href="https://github.com/recepuysal/labstock/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/recepuysal/labstock/total?label=downloads&color=a3611f"></a>
  <img alt="Windows 10/11" src="https://img.shields.io/badge/Windows-10%2F11-0078D4?logo=windows">
  <img alt="Free to use" src="https://img.shields.io/badge/price-free-2ea44f">
  <img alt="English and Turkish" src="https://img.shields.io/badge/UI-English%20%7C%20T%C3%BCrk%C3%A7e-555">
</p>

<p align="center">
  <a href="https://github.com/recepuysal/labstock/releases/latest">
    <strong>⬇ Download for Windows (LabStock-Kurulum.exe)</strong>
  </a>
  ·
  <a href="#screenshots">Screenshots</a>
  ·
  <a href="#feedback--contact">Feedback</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/hero-koyu-en.png">
    <img src="docs/screenshots/hero-en.png" alt="LabStock: inventory list and part detail page" width="900">
  </picture>
</p>

## Why LabStock?

Anyone who does electronics as a hobby or runs a small production workshop ends
up asking the same question: *“Which drawer was that resistor in?”* LabStock
maps your parts to their physical locations (room › cabinet › drawer ›
compartment), then lets you search, filter, print QR labels and bulk-import from
Excel. After installation it updates itself silently on every launch — there's
nothing to maintain.

| | |
|---|---|
| 📦 **Location tree** — room › cabinet › drawer › bin | 🔎 **Instant search** — part, MPN, description |
| 🏷️ **QR labels** — print, stick, scan | ⚡ **Fetch from LCSC or a shop link** — the form fills itself |
| 💬 **Chat assistant** — ask “what do I have?” | 📱 **Count parts with your phone camera** — no app to install |
| 📊 **Excel import / export** | 👥 **Viewers** — share your inventory read-only |
| 🌙 **Dark / light theme** | 🔄 **Silent auto-update** |
| 🌍 **English and Turkish interface** | 🆓 **Free** |

## Screenshots

These screenshots come from a real R&D lab inventory with 265 part types and
more than 10,000 components. If you use GitHub in dark mode, you'll see the
dark-theme versions.

### Location tree and parts list
A hierarchical location tree (room › cabinet › drawer › compartment). Filter the
parts list by location, category, package, status and tag, and switch between
list and grid views. The status bar always shows the number of part types, total
quantity, critical items and the estimated inventory value.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/envanter-izgara-koyu-en.png">
    <img src="docs/screenshots/envanter-izgara-en.png" alt="Grid view" width="820">
  </picture>
</p>

Click a box to see only what's inside it:

<p align="center">
  <img src="docs/screenshots/konum-filtresi-en.png" alt="Parts inside the SMD capacitor box" width="820">
</p>

### Part details
MPN, manufacturer, parameters, movement history, location map, supplier info,
price and the projects a part is used in — on one page. Paste an LCSC code and
hit “Fetch” to fill in the manufacturer, description, category, parameters and
product photo automatically.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/parca-detay-koyu-en.png">
    <img src="docs/screenshots/parca-detay-en.png" alt="Part detail page" width="820">
  </picture>
</p>

### Add parts from a link
Paste a product link into the “Add part” form and click **Fetch from link**: the
name, manufacturer, description, specifications, price and image are filled in
for you to review before saving. Direnç.net, Robotistan and Motorobit work out of
the box (free and fast). Add your own free
[Google Gemini API key](https://aistudio.google.com/apikey) in Settings and it
works on **any shop's product page**. The key is stored only in your own account and is never
shared; usage counts against your own free Google quota.

### Chat assistant
Open **Chat** from the top bar and ask about your inventory in plain language —
“Do I have something that steps 12 V down to 5 V?”. The assistant answers only
from your actual stock: it tells you where a part is and how many you have, or
suggests a functional alternative you do have. It replies in the language of the
interface.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/sohbet-asistani-koyu-en.png">
    <img src="docs/screenshots/sohbet-asistani-en.png" alt="The chat assistant answering a capacitor question" width="820">
  </picture>
</p>

### Printable QR labels
QR labels for every part and location, generated fully offline — print, cut,
stick them on the drawer. Scan one with a USB barcode reader (or paste it into the
search box) to jump straight to that part or location.

<p align="center">
  <img src="docs/screenshots/etiket-qr-en.png" alt="Location QR labels" width="820">
</p>

### Count parts with your phone camera (desktop app)
Open **Phone camera** in the bottom-left corner and scan the QR code on screen
with your phone — no app to install; the phone's camera connects to LabStock over
your Wi-Fi. Show the part's or drawer's QR label (or search by name), pour the
parts onto the table, and the camera counts them; “Write to LabStock” sets the
quantity and records a “Count” in the movement history. Scan the QR on an LCSC bag
to add its quantity to stock (the same label is never counted twice); if the part
doesn't exist yet, a new part form pre-filled from LCSC opens. For more accurate
counts, put a coin next to the parts as a scale reference. All image processing
runs on your computer; the server only runs while you have it open, and devices
without the pairing key from the QR code can't connect.

### Recent activity and shopping list
Every stock movement — camera counts, Excel imports, manual changes — on one
page. **To buy** is a simple shopping list with links, separate from the
inventory, so you don't forget what to order and where.

<p align="center">
  <img src="docs/screenshots/aktiviteler-en.png" alt="Recent activity" width="820">
</p>
<p align="center">
  <img src="docs/screenshots/alinacaklar-en.png" alt="Shopping list" width="820">
</p>

### Excel, viewers, weekly backup
- **Excel import/export:** import your existing inventory from a single
  `.xlsx`/`.csv` file (English or Turkish column headers); export everything to
  `.xlsx` at any time.
- **Viewers (read-only sharing):** generate an invite code in Settings to share
  your inventory read-only with a colleague or student; revoke access whenever
  you want.
- **Weekly summary + backup email:** every Monday you get critical stock, the
  total value and a CSV backup of the full list by email.

### Desktop app and automatic updates
Installs on Windows with a setup wizard (no admin rights needed) and checks for
updates in the background on every launch. New versions are downloaded and
installed from a quiet in-app notification — no extra windows.

### Settings
Interface language (English / Türkçe), dark/light theme, label (QR) appearance,
AI keys with a daily usage bar (free Gemini, Groq, Z.ai and OpenRouter keys plus paid Claude — tried in order, a key whose free quota runs out is skipped), weekly backup email,
import/export, viewer management and in-app feedback.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/ayarlar-koyu-en.png">
    <img src="docs/screenshots/ayarlar-en.png" alt="Settings page" width="560">
  </picture>
</p>

## Installation

1. Download `LabStock-Kurulum.exe` from the
   [Releases](https://github.com/recepuysal/labstock/releases/latest) page.
2. Run it and follow the wizard (no admin rights needed; it installs into your
   user folder). Windows may show a SmartScreen warning because the installer
   isn't code-signed yet — click **More info → Run anyway**.
3. The app opens when installation finishes. Use “Create account” to set up your
   own inventory — you'll get a 6-digit verification code by email (valid for
   10 minutes).
4. To view someone else's inventory (read-only), enter the **invite code** they
   generated in their Settings into the “Invite code” field when signing up — or
   later from your Profile page.

The interface language follows your Windows language on first launch; change it
any time in **Settings → Language**.

## Feedback & contact

Found a bug, missing a feature? Two ways:

- In the app: **Settings → Feedback** — write and send.
- Email: **labstockassistant@gmail.com**

See the [privacy policy](PRIVACY.md) for what data the app handles.

## License

LabStock is free — install and use it for personal or commercial purposes. You
may not redistribute or publish the source code or a modified version; the only
official distribution channel is the
[Releases](https://github.com/recepuysal/labstock/releases) page of this
repository. See [LICENSE](LICENSE) for the full terms.

---

## Development

For contributors, or if you want to run the project against your own Supabase
project. The detailed (Turkish) version of this section is in
[README.tr.md](README.tr.md#geliştirme).

### 1. Supabase project

1. Create a new project on [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run the files in `supabase/migrations/` in order
   (`0001_init.sql` sets up the schema, RLS policies, RPCs, the `envanter` view
   and the `handle_new_user()` trigger; the later files add AI keys and the
   weekly backup). Migrations are run by hand, not pushed by the CLI.
3. **Email verification (optional, recommended in production):** configure a
   custom SMTP provider under **Authentication → Emails → SMTP Settings**, enable
   **Confirm email**, and edit the **Confirm signup** template to show
   `{{ .Token }}` (the 6-digit code — the desktop app uses codes instead of links).
4. Copy the `Project URL` and `anon public` key from **Project Settings → API**.

### 2. Run the web app (for testing in a browser)

```bash
cp .env.example .env.local     # Windows: copy .env.example .env.local
# put your Supabase URL and anon key in .env.local

npm install
npm run dev
```

Open `http://localhost:3000` and create an account at `/kayit`.

### 3. Package the desktop app

```bash
npm run build:desktop          # Next.js standalone build, copied into electron-app/standalone
cd electron-app
npm install
npx electron-builder --win     # produces electron-app/dist/LabStock-Kurulum.exe
```

`electron-app/main.js` starts the standalone server invisibly in the background
on launch and opens it in an Electron window when it's ready.

### 4. Publish a release

1. Bump `version` in `electron-app/package.json`.
2. `git commit`, then `git tag vX.Y.Z` and `git push origin master vX.Y.Z`.
3. `.github/workflows/build-desktop.yml` builds on GitHub's servers and attaches
   the `.exe` and `latest.yml` to a GitHub Release.
4. Installed apps pick it up on their next launch.

`.github/workflows/keep-alive.yml` pings the Supabase project twice a week, so
free-plan projects aren't paused after 7 days of inactivity.

### Languages

The interface is available in Turkish and English. Strings live in
`src/lib/i18n/sozluk/*.ts` — each file exports a `tr` object and an `en` object of
the same shape (the TypeScript type enforces it). The language is stored in the
`labstock-dil` cookie; without it, the `Accept-Language` header decides. Server
components use `sozlukAl()` / `dilAl()` from `src/lib/i18n/sunucu.ts`; client
components use `useSozluk()` / `useDil()` from `src/lib/i18n/istemci.tsx`.
Category names are stored in Turkish and translated only for display
(`src/lib/i18n/kategori.ts`).

### Data model

The key design decision: **part definitions and stock are separate.**

| Table | Holds |
| --- | --- |
| `parts` | Shared catalog — MPN, manufacturer, category, package, datasheet, parameters. Not tied to a user. |
| `locations` | Each user's hierarchical location tree, with a `tip` (type) per node. |
| `stock_items` | A user's stock: part × location, quantity, min. level, supplier, purchase price. |
| `stock_movements` | Movement ledger — every +/- change, its reason and the resulting quantity. |
| `projects`, `project_bom` | Projects and bills of materials. |
| `tags`, `stock_item_tags` | Per-user free-form tags. |
| `profiles` | Name/company details, avatar, theme and viewer fields. |
| `feedback` | Messages from the in-app feedback form. |
| `alinacaklar` | The shopping list, separate from the inventory. |

Quantities are never written directly: the `stok_hareket()` RPC updates
`stock_items.adet` and records the movement together.
