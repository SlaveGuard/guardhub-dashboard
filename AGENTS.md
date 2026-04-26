# AGENTS.md

## Scope

Use this file for work inside `guardhub-dashboard/`.

## Stack and Layout

- Stack: React 19, Vite 8, TypeScript, Tailwind CSS v4, React Query, Zustand, Axios.
- Real app entry: `src/main.tsx`
- Router: `src/App.tsx`
- Shared API client: `src/api/client.ts`
- Auth store: `src/store/authStore.ts`
- Theme state: `src/context/ThemeContext.tsx`
- Screens: `src/screens/auth`, `src/screens/dashboard`
- Shared UI: `src/components`

Usually avoid `dist/`, `node_modules/`, and local `*.log` files unless the task requires them.

## Commands

- Install reproducibly: `npm ci`
- Install or update dependencies only when required: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

No committed lint, test, or format script was found.

## Conventions

- The actual boot path is `index.html -> src/main.tsx`; `src/main.ts`, `src/style.css`, and `src/counter.ts` are leftover Vite starter files.
- Routing lives in `src/App.tsx`.
- Remote data is fetched near screens with React Query.
- Auth/session state lives in the Zustand store and is persisted there.
- Shared HTTP behavior belongs in `src/api/client.ts`; preserve the existing token refresh and 401 handling there instead of duplicating it in screens.
- Theme changes flow through `ThemeContext`, which toggles the `.dark` class on `document.documentElement`.
- Styling uses Tailwind CSS v4 in `src/index.css`, with shared classes such as `glass-panel`, `glass-input`, `btn-primary`, and `btn-danger`.

## Workflow Rules

- Inspect the relevant screen plus any shared client/store/context files it depends on before editing.
- Prefer `npm ci` for setup unless dependency changes are required.
- Do not add new frontend dependencies unless the task clearly requires them.
- Do not redesign auth flow, API contract assumptions, or shared state shape unless the task explicitly requires it. Pause and explain the risk first.
- If a dashboard change depends on a backend contract change, verify the matching backend behavior instead of patching around the mismatch locally.

## Verification

- Run `npm run build`. This is the only committed compile check and includes `tsc`.
- No committed frontend lint or test script was found; say so explicitly if broader verification was not possible.
- For auth, routing, or API integration changes, manually sanity-check the affected flow when the task requires it.

## Project Notes

- `VITE_API_URL` is the frontend API base URL.
- Preserve the current visual language unless the task explicitly asks for a redesign.
