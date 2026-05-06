# Dashboard Redesign — Codex Task Spec

> **How to use this file:**
> Read this before touching any screen file. Each section maps a design change to an exact file, describes the required behaviour, and references the visual prototype at `design/prototype.html` which you can open and inspect.  
> Work through sections in order. After every file change run `npm run build` and fix all TypeScript errors before moving on.

---

## 0. Reference Files

| File | Purpose |
|------|---------|
| `design/prototype.html` | Self-contained interactive HTML prototype — the visual source of truth |
| `src/screens/dashboard/DevicesScreen.tsx` | Profiles screen — largest change |
| `src/screens/dashboard/SettingsScreen.tsx` | Settings screen — GuardScreen & GuardHub Kids sections |
| `src/components/` | Shared UI components — add new ones here |

---

## 1. Design Tokens → Tailwind Mapping

The prototype uses CSS variables. Map them to the existing Tailwind / shared-class system already in `src/index.css`.

| Prototype CSS var | Tailwind equivalent |
|-------------------|---------------------|
| `--brand / #818cf8` | `brand-400` / `brand-500` (already used) |
| `--teal / #2dd4bf` | `teal-400` (`accent-teal` where it exists) |
| `--rose / #fb7185` | `rose-400` |
| `--amber / #fbbf24` | `amber-400` |
| `--green / #34d399` | `emerald-400` |
| `--bg-card` | `glass-panel` (existing shared class) |
| `--bg-surface` | `bg-slate-900/40` |
| `--bg-elevated` | `bg-slate-800/60` |
| `--border` | `border-white/10` |
| `--border-em` | `border-white/20` |
| `--text-s` | `text-slate-400` |
| `--text-m` | `text-slate-500` |
| Monospace code | `font-mono tracking-widest` |

---

## 2. DevicesScreen.tsx — Full Restructure

**File:** `src/screens/dashboard/DevicesScreen.tsx`

This is the main change. The screen currently shows a flat profiles list + a side panel. Replace it with a **three-state view** controlled by local state: `list | detail | kids-control | guardscreen-view`.

### 2a. State Shape

Add this local state at the top of the component:

```ts
type ScreenView =
  | { mode: 'list' }
  | { mode: 'detail'; profileId: string }
  | { mode: 'kids-control'; profileId: string; deviceId: string; deviceName: string }
  | { mode: 'guardscreen'; profileId: string; deviceId: string; deviceName: string };

const [view, setView] = useState<ScreenView>({ mode: 'list' });
```

---

### 2b. List View — Profile Cards Grid

Render the existing `profiles` (from `useQuery`) as a responsive card grid.

Each card shows:
- Avatar circle with initials (first letter of `profile.name`), gradient background per-profile (rotate through a set of 4–5 gradients by index)
- Profile name, age, active-since date
- Status badge: `active` → green, `paused` → amber, `archived` → slate
- Three stat pills at the bottom: **Devices** (count of `profile.devices`), **Apps** (sum of apps across devices), **Alerts** (from `profile` data if available, else omit)
- Clicking the card calls `setView({ mode: 'detail', profileId: profile.id })`

Add an **+ Add Profile** button in the page header row (keep existing modal/flow).

---

### 2c. Detail View — Profile Detail Page

Triggered when `view.mode === 'detail'`. Fetch the full profile with `useQuery(['profile', profileId])` → `GET /profiles/:profileId`.

**Layout at the top:**  
A card with the avatar, name, age + since date, and two action buttons: **⏸ Pause Profile** (existing API call) and **+ Link Device** (see pairing section below).

**Profile Policy card** (keep existing `<PolicyScopePanel>` component, it already does this correctly).

---

### 2d. Pairing Code Card

Still inside the detail view, below the policy card.

**Behaviour:**

1. Show a `<select>` populated from `useQuery(['app-catalog']) → GET /app-catalog`. Each `<option>` uses `catalog.id` as value and `catalog.displayName` as label. First option is a disabled placeholder: `"— Select app —"`.
2. A **Generate Code** button next to the select. Disabled and visually dimmed (`opacity-40 cursor-not-allowed`) until an app is selected.
3. On click, call `POST /profiles/:profileId/pairing-codes` with body `{ appCatalogId: selectedCatalogId }`. Use `useMutation`.
4. On success, show the generated code in a result block below:
   - "Generated for" label + badge showing the app display name
   - The 7-digit code in `font-mono text-3xl tracking-[0.6em]` in `text-brand-400`, formatted as `XXX XXXX` (insert a space after the 3rd digit for readability; strip it on copy)
   - "Expires in 24 hours · One-time use only" sub-label
   - **⎘ Copy** button (writes raw 7-digit string to clipboard, shows "✓ Copied!" for 2 s)
   - **↻ New Code** button (re-runs the mutation for the same selected app)
5. Changing the `<select>` hides the previous result immediately.
6. Existing active pairing codes for this profile (from `selectedProfile.activePairingCodes`) are shown in a separate read-only list below the generator, each showing: app name, masked display of the code, expiry time, copy button.

> **Do not remove** the existing active-pairing-codes list — it shows codes that were already generated and not yet used. The generator above only creates new ones.

---

### 2e. Linked Devices — Grouped by Physical Device

Below the pairing section. Replace the current flat list with a **device-first grouped layout**.

**Structure per device:**

```
┌─ Device group card ──────────────────────────────┐
│  [icon]  Pixel 7                  ● Online        │
│          Android · Last seen 2 min ago            │
├──────────────────────────────────────────────────┤
│    → GuardHub Kids   Screen time & app mgmt  ›   │
│    → GuardScreen     Content protection      ›   │
└──────────────────────────────────────────────────┘
```

- **Device header row**: device icon, `device.deviceName`, platform/type, last-seen, online badge (green) or offline badge (amber). Not clickable itself.
- **App rows** (indented, inside the card): one row per `appInstallation` on that device. Show the app icon (brand colour from `appCatalog.slug`), `appCatalog.displayName`, a one-line sub-description, and a right-pointing chevron.
- Clicking an app row routes based on `appCatalog.slug`:
  - `guardhub-kids-android` → `setView({ mode: 'kids-control', profileId, deviceId: device.id, deviceName: device.deviceName })`
  - `guardscreen-android` (or any GuardScreen slug) → `setView({ mode: 'guardscreen', profileId, deviceId: device.id, deviceName: device.deviceName })`
  - Any other slug → navigate to a generic app detail page or do nothing for now (add a TODO comment)

**Data shape:** `selectedProfile.devices` is an array of devices, each with an `appInstallations` array. Use this directly — no extra API call needed.

---

### 2f. Breadcrumb Component

Create `src/components/Breadcrumb.tsx`. Accepts an array of `{ label: string; onClick?: () => void }`. Renders them separated by `›`. Last item has no `onClick` and is styled `text-slate-100 font-medium`. Previous items are `text-slate-400 hover:text-slate-200 cursor-pointer`.

Use this in the detail, kids-control, and guardscreen views.

---

### 2g. GuardScreen View (mode: `guardscreen`)

A minimal dedicated view — **not** the Kids Control Center.

```
Breadcrumb: Profiles › [Child Name] › [Device Name] › GuardScreen

┌─ Header card ──────────────────────────────────────┐
│  [shield icon]  Pixel 7 — GuardScreen              │
│                 Android · Last seen 2 min ago       │
│                 ● Protection Active          [Sync] │
└────────────────────────────────────────────────────┘

┌─ Controls card ────────────────────────────────────┐
│  GuardScreen Controls                               │
│                                                     │
│  Protection Active                           [●──]  │
│  Remotely enable or disable content                 │
│  protection on this device                          │
│  ─────────────────────────────────────────────────  │
│  Lock Settings                               [●──]  │
│  Prevent child from disabling or                    │
│  uninstalling GuardScreen                           │
│                                                     │
│  ℹ  Advanced settings are managed in               │
│     Settings → GuardScreen.                         │
└────────────────────────────────────────────────────┘
```

- Read toggle states from `GET /apps/:installationId/effective-policy` (use `useQuery`).
- Write toggle changes via `PATCH /apps/:installationId/policy` (use `useMutation`), debounced or on-change.
- The **Sync** button calls `POST /devices/:deviceId/sync` if that endpoint exists, otherwise show a toast "Sync requested" without an API call and add a TODO comment.
- Max width: `max-w-xl`.

---

### 2h. GuardHub Kids Control Center (mode: `kids-control`)

This is the largest new component. Create it as **`src/components/KidsControlCenter.tsx`** and import it into `DevicesScreen.tsx`.

```
Breadcrumb: Profiles › [Child Name] › [Device Name] (GuardHub Kids)

┌─ Header ───────────────────────────────────────────┐
│  [Avatar]  Emma's Device                            │
│            Pixel 7 · GuardHub Kids · Android        │
│            ● Online · Last seen 15 min ago          │
│                              [Pause] [Lock] [Sync]  │
└────────────────────────────────────────────────────┘

[Overview] [Screen Time] [Apps] [Web Filter] [Bedtime] [Reports]
```

**Tab definitions:**

#### Overview tab
- Today's usage bar: total time used vs daily limit (fetch from activity/policy)
- 2×2 stat grid: Apps Opened, Apps Blocked, Sites Blocked, Alerts Today
- Top apps today: emoji icon, app name, mini horizontal bar, time used
- Recent Alerts list (last 5)

#### Screen Time tab
- Total daily limit slider (`0`–`12h`, step `1h`, `0` = "No limit")
- Per-app time limits list: app icon, name, category, time-limit pill (editable)
- Scheduled blocks list: name, time range, days, toggle (School Hours / Homework / Dinner + `+ Add Schedule`)

#### Apps tab
- Search bar
- Apps grouped by category (Social Media, Games, Education, …)
- Each app: icon, name, toggle (allowed/blocked), time-limit pill, "Blocked"/"Allowed" badge

#### Web Filter tab
- 3-column grid of content category tiles
- Each tile: emoji icon, category name, state indicator (✕ Blocked in rose / ✓ Allowed in teal)
- Tapping a tile toggles state
- Categories: Adult Content, Gambling, Drugs & Alcohol, Violence, Gaming, Social Media, News, Education, Chat / Dating

#### Bedtime tab
- Enable bedtime toggle
- Start time + wake time selectors (enabled only when bedtime is on)
- Day-of-week pill picker (M T W T F S S), multi-select
- Exceptions list (Phone Calls, Clock always on) as read-only info

#### Reports tab
- Weekly bar chart (7 bars for Mon–Sun, bars coloured brand-400, over-limit bars coloured rose-400)
- Most-used apps this week list
- Weekly events summary: content blocked, limit reached days, app blocks, policy syncs

**Data sources:**

| Data | Endpoint |
|------|---------|
| Policy (limits, bedtime, app rules) | `GET /apps/:installationId/effective-policy` |
| Policy mutations | `PATCH /apps/:installationId/policy` |
| Activity / usage stats | `GET /apps/:installationId/activity` |
| Alerts | `GET /apps/:installationId/alerts` |

**For now, if an endpoint returns no data for a given tab, render a sensible empty state rather than crashing.** Add TODO comments where the data shape is uncertain.

---

## 3. SettingsScreen.tsx — Simplify GuardScreen Section

**File:** `src/screens/dashboard/SettingsScreen.tsx`

### GuardScreen section

Keep only two toggles. Remove everything else (sensitivity sliders, detection mode pickers, etc.).

```
GuardScreen (Android App)
  [shield icon]  GuardScreen · Explicit content protection

  Protection Active                          [toggle]
  Remotely enable content protection

  Lock Settings                              [toggle]
  Prevent child from disabling or
  uninstalling GuardScreen

  ℹ  Advanced settings (sensitivity, per-app overrides)
     are configured per-device inside each child's profile.
```

- These are **family-level** global defaults, not per-device overrides.
- Read/write via `GET/PATCH` family-level settings if that endpoint exists, or mark with a TODO if the endpoint is not yet available.

### GuardHub Kids section

Replace any controls with a redirect card:

```
GuardHub Kids
  [phone icon]  GuardHub Kids · Screen time & app management

  ┌─ teal info box ──────────────────────────────────┐
  │  GuardHub Kids is configured per-child device.   │
  │  Go to Profiles → select a child → select their  │
  │  GuardHub Kids device to manage:                 │
  │                                                  │
  │  ✓ Screen Time Limits   ✓ App Management         │
  │  ✓ Web Filtering        ✓ Bedtime Schedule       │
  │  ✓ Scheduled Blocks     ✓ Usage Reports          │
  │                                                  │
  │  [Go to Profiles →]                              │
  └──────────────────────────────────────────────────┘
```

The button navigates to `/profiles` (or equivalent route).

---

## 4. New Files Checklist

| File | Purpose |
|------|---------|
| `src/components/Breadcrumb.tsx` | Shared breadcrumb nav |
| `src/components/KidsControlCenter.tsx` | 6-tab GuardHub Kids management UI |
| `src/components/GuardScreenDeviceView.tsx` | 2-toggle GuardScreen view |
| `src/components/PairingCodeGenerator.tsx` | App dropdown + generate + result block |
| `src/components/LinkedDeviceGroup.tsx` | Single device group card (header + app rows) |

Splitting into these components keeps `DevicesScreen.tsx` readable and lets each piece be tested or replaced independently.

---

## 5. Do-Not-Change List

- `src/api/client.ts` — token refresh and 401 handling, do not touch
- `src/store/authStore.ts` — auth state shape, do not touch
- `src/context/ThemeContext.tsx` — theme toggle, do not touch
- `src/screens/auth/` — entire auth flow, do not touch
- `src/App.tsx` routing — only add new nested routes if essential; prefer local state navigation inside `DevicesScreen`
- `PolicyScopePanel` component — keep as-is, it is already correct
- `ScopeInsightsPanel` component — keep as-is

---

## 6. Verification Checklist

After all changes, confirm:

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] Profiles list renders cards with avatar, name, status badge, stat pills
- [ ] Clicking a profile card opens the detail view with breadcrumb
- [ ] Pairing code: selecting an app from the catalog dropdown enables the Generate button
- [ ] Pairing code: Generate calls `POST /profiles/:profileId/pairing-codes` and shows a 7-digit numeric code
- [ ] Pairing code: Copy strips the space and writes the raw 7-digit string to clipboard
- [ ] Linked devices: each physical device is a grouped card; apps inside it are clickable rows
- [ ] GuardHub Kids app row → opens KidsControlCenter with 6 tabs
- [ ] GuardScreen app row → opens GuardScreenDeviceView with exactly 2 toggles
- [ ] Breadcrumb works in all three sub-views, navigating back correctly
- [ ] Settings → GuardScreen shows only 2 toggles
- [ ] Settings → GuardHub Kids shows only the redirect card
- [ ] Dark theme is intact everywhere
