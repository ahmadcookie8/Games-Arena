# Games Arena — Complete Design System & Implementation Guide

> **Document purpose**: This is a complete visual design specification for an AI implementation agent. It covers every rule, token, component, and page needed to fully revamp the Games Arena multiplayer platform. Follow every section precisely. When in doubt, prefer consistency with the tokens defined here over any prior styling.

---

## 0. Project Context

**Games Arena** is a real-time multiplayer gaming platform. It currently supports Tic Tac Toe and Wisecracker (a fill-in-the-blank party game) with Chess, Checkers, Uno, and President partially implemented. The platform has:

- 4 pages: Auth, Dashboard, GameBoard, GameHistory
- 10 components: TicTacToeBoard, WisecrackerBoard, ChessBoard, CheckersBoard, UnoTable, PresidentTable, PlayerCard, MoveHistory, GameInvite, Leaderboard
- Stack: React 18 + TypeScript + Vite + Socket.io + Zustand

**Design direction**: Premium, energetic gaming aesthetic. Dark by default (matching most gamers' preference), clean and readable during active gameplay, and fully functional in light mode. The name "Games Arena" evokes competition and excitement — the design should feel alive and distinct, not generic.

---

## 1. Scope of Changes

### Files to modify
- `frontend/package.json` — update Tailwind to v4
- `frontend/vite.config.ts` — use `@tailwindcss/vite` plugin
- `frontend/postcss.config.js` — update for Tailwind 4
- `frontend/tailwind.config.js` — delete this file (Tailwind 4 moves config to CSS)
- `frontend/index.html` — add Google Fonts CDN, dark mode init script
- `frontend/src/index.css` — full rewrite with Tailwind 4, CSS variables, theme tokens

### Pages to restyle (full rewrite of JSX/className)
- `frontend/src/pages/Auth.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/GameBoard.tsx`
- `frontend/src/pages/GameHistory.tsx`

### Components to restyle (full rewrite of JSX/className)
- All files in `frontend/src/components/`

### New files to create
- `frontend/src/components/ThemeToggle.tsx`
- `frontend/src/components/Header.tsx` (shared top navigation)

### Do NOT change
- Any TypeScript logic, state management, hooks, socket events, or backend code
- `frontend/src/hooks/`, `frontend/src/lib/`, `frontend/src/types/`, `frontend/src/App.tsx` routing logic
- All backend files

---

## 2. Tailwind 4 Setup

### 2.1 Package changes

Install Tailwind 4 and its Vite plugin. Remove the old packages:

```bash
npm uninstall tailwindcss postcss autoprefixer
npm install tailwindcss@^4.0.0 @tailwindcss/vite
```

No separate PostCSS config is needed when using the Vite plugin.

### 2.2 `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
})
```

### 2.3 `postcss.config.js`

Delete this file. The Vite plugin handles PostCSS automatically.

### 2.4 `tailwind.config.js`

Delete this file. All configuration moves to `index.css`.

### 2.5 `frontend/src/index.css` (full replacement)

This file is the heart of the design system. Write it exactly as shown in Section 4.

---

## 3. Typography

### 3.1 Fonts

**UI font**: `Inter` (Google Fonts)
**Monospace font**: `JetBrains Mono` (Google Fonts)

Add to `frontend/index.html` inside `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### 3.2 Font scale

Use standard Tailwind size utilities. The key mappings to use throughout the app:

| Class | Size | Line Height | Use case |
|-------|------|-------------|----------|
| `text-xs` | 12px | 16px | Metadata, timestamps, labels, win-rate percentages |
| `text-sm` | 14px | 20px | Body small, captions, form helper text, move history |
| `text-base` | 16px | 24px | Default body text, paragraphs |
| `text-lg` | 18px | 28px | Card titles, section headers |
| `text-xl` | 20px | 28px | Subsection titles, game name on GameBoard |
| `text-2xl` | 24px | 32px | Page section titles |
| `text-3xl` | 30px | 36px | Page titles (Dashboard "Games Arena") |
| `text-4xl` | 36px | 40px | Auth hero title |
| `text-5xl` | 48px | 1 | Not currently used, reserved for landing |

### 3.3 Font weight usage rules

- `font-normal` (400): Body text, descriptions, secondary labels
- `font-medium` (500): UI labels, button text, player names, nav items
- `font-semibold` (600): Section titles, card headers, tab labels
- `font-bold` (700): Page titles, game piece symbols (X/O), game codes
- `font-extrabold` (800): Reserved for hero/display text only

### 3.4 Monospace usage

Apply `font-mono` (JetBrains Mono) to:
- 6-character game codes (e.g., `ABC123`)
- Move history notation
- Score displays in Wisecracker
- Any numeric counter that needs tabular alignment

---

## 4. `index.css` — Full Design Token System

Replace `frontend/src/index.css` entirely with the following. Every CSS custom property here is referenced throughout the component specs in this document.

```css
@import "tailwindcss";

/* ─── Dark mode: activated by .dark class on <html> ─── */
@variant dark (&:where(.dark, .dark *));

/* ─── Light mode defaults ─── */
:root {
  /* Backgrounds */
  --bg-page:      oklch(97.5% 0.006 256);   /* slate-50 equivalent */
  --bg-surface:   oklch(100% 0 0);           /* pure white */
  --bg-elevated:  oklch(96% 0.008 256);      /* slate-100 */
  --bg-overlay:   oklch(93% 0.010 256);      /* slate-200 — inputs, hover */
  --bg-sunken:    oklch(89% 0.012 256);      /* slate-300 — pressed states */

  /* Borders */
  --border:         oklch(89% 0.012 256);    /* slate-200 */
  --border-strong:  oklch(83% 0.016 256);    /* slate-300 */
  --border-focus:   oklch(56% 0.20 245);     /* brand blue */

  /* Text */
  --text-primary:   oklch(13% 0.02 256);     /* slate-900 */
  --text-secondary: oklch(43% 0.03 256);     /* slate-600 */
  --text-muted:     oklch(62% 0.025 256);    /* slate-500 */
  --text-disabled:  oklch(75% 0.015 256);    /* slate-400 */
  --text-on-accent: oklch(100% 0 0);         /* white — text on colored buttons */

  /* Accent — Violet */
  --accent:         oklch(52% 0.20 245);     /* brand blue */
  --accent-hover:   oklch(46% 0.20 245);     /* deeper brand blue */
  --accent-subtle:  oklch(93% 0.045 245);    /* pale blue tint */
  --accent-muted:   oklch(78% 0.12 245);     /* soft blue outline */

  /* Semantic — Status */
  --success:        oklch(55% 0.18 160);     /* emerald-600 */
  --success-subtle: oklch(95% 0.05 160);     /* emerald-50 */
  --success-text:   oklch(30% 0.12 160);     /* emerald-900 */

  --danger:         oklch(53% 0.22 27);      /* red-600 */
  --danger-subtle:  oklch(97% 0.04 27);      /* red-50 */
  --danger-text:    oklch(30% 0.14 27);      /* red-900 */

  --warning:        oklch(66% 0.2 78);       /* amber-500 */
  --warning-subtle: oklch(97% 0.05 95);      /* amber-50 */
  --warning-text:   oklch(35% 0.12 78);      /* amber-900 */

  --info:           oklch(57% 0.2 231);      /* sky-500 */
  --info-subtle:    oklch(96% 0.04 231);     /* sky-50 */

  /* Shadows (light mode uses them, dark mode uses glow) */
  --shadow-sm:  0 1px 3px oklch(0% 0 0 / 0.08), 0 1px 2px oklch(0% 0 0 / 0.06);
  --shadow-md:  0 4px 12px oklch(0% 0 0 / 0.10), 0 2px 4px oklch(0% 0 0 / 0.06);
  --shadow-lg:  0 10px 30px oklch(0% 0 0 / 0.12), 0 4px 8px oklch(0% 0 0 / 0.08);
  --shadow-accent: 0 0 20px oklch(52% 0.20 245 / 0.25);
  --glow-hero: 0 0 60px oklch(52% 0.20 245 / 0.22), 0 0 120px oklch(52% 0.20 245 / 0.10);
}

/* ─── Dark mode overrides ─── */
.dark {
  /* Backgrounds — soft navy-slate tones, NOT pure gray or near-black */
  --bg-page:      oklch(13% 0.024 262);      /* soft navy page */
  --bg-surface:   oklch(17% 0.026 262);      /* card bg */
  --bg-elevated:  oklch(21% 0.028 262);      /* elevated card */
  --bg-overlay:   oklch(26% 0.030 262);      /* inputs, hover */
  --bg-sunken:    oklch(31% 0.030 262);      /* pressed states */

  /* Borders */
  --border:         oklch(33% 0.032 262);    /* subtle border */
  --border-strong:  oklch(41% 0.032 262);    /* emphasized */
  --border-focus:   oklch(72% 0.18 252);     /* bright brand blue */

  /* Text */
  --text-primary:   oklch(91% 0.008 256);    /* calm off-white */
  --text-secondary: oklch(72% 0.02 256);     /* light gray */
  --text-muted:     oklch(58% 0.018 256);    /* muted gray */
  --text-disabled:  oklch(45% 0.014 256);    /* disabled gray */
  --text-on-accent: oklch(100% 0 0);

  /* Accent — Violet (slightly brighter in dark) */
  --accent:         oklch(68% 0.18 252);     /* brand blue */
  --accent-hover:   oklch(74% 0.17 252);     /* brighter brand blue */
  --accent-subtle:  oklch(18% 0.055 252);    /* dark blue tint */
  --accent-muted:   oklch(44% 0.16 252);     /* blue outline */

  /* Semantic */
  --success:        oklch(72% 0.18 160);     /* emerald-400 */
  --success-subtle: oklch(16% 0.06 160);
  --success-text:   oklch(85% 0.14 160);

  --danger:         oklch(68% 0.22 27);      /* red-400 */
  --danger-subtle:  oklch(16% 0.07 27);
  --danger-text:    oklch(82% 0.16 27);

  --warning:        oklch(80% 0.18 78);      /* amber-400 */
  --warning-subtle: oklch(18% 0.06 78);
  --warning-text:   oklch(90% 0.14 78);

  --info:           oklch(72% 0.18 231);     /* sky-400 */
  --info-subtle:    oklch(16% 0.06 231);

  /* Shadows — use glow instead of shadow in dark mode */
  --shadow-sm:  0 0 0 1px oklch(100% 0 0 / 0.035);
  --shadow-md:  0 4px 18px oklch(0% 0 0 / 0.30), 0 0 0 1px oklch(100% 0 0 / 0.035);
  --shadow-lg:  0 8px 34px oklch(0% 0 0 / 0.38), 0 0 0 1px oklch(100% 0 0 / 0.05);
  --shadow-accent: 0 0 22px oklch(68% 0.18 252 / 0.30);
  --glow-hero: 0 0 80px oklch(68% 0.18 252 / 0.24), 0 0 160px oklch(68% 0.18 252 / 0.10);
}

/* ─── Tailwind 4 theme bridge (makes CSS vars usable as Tailwind utilities) ─── */
@theme inline {
  --color-page:          var(--bg-page);
  --color-surface:       var(--bg-surface);
  --color-elevated:      var(--bg-elevated);
  --color-overlay:       var(--bg-overlay);
  --color-sunken:        var(--bg-sunken);

  --color-border:        var(--border);
  --color-border-strong: var(--border-strong);
  --color-border-focus:  var(--border-focus);

  --color-text-primary:   var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-muted:     var(--text-muted);
  --color-text-disabled:  var(--text-disabled);
  --color-text-on-accent: var(--text-on-accent);

  --color-accent:         var(--accent);
  --color-accent-hover:   var(--accent-hover);
  --color-accent-subtle:  var(--accent-subtle);
  --color-accent-muted:   var(--accent-muted);

  --color-success:        var(--success);
  --color-success-subtle: var(--success-subtle);
  --color-success-text:   var(--success-text);
  --color-danger:         var(--danger);
  --color-danger-subtle:  var(--danger-subtle);
  --color-danger-text:    var(--danger-text);
  --color-warning:        var(--warning);
  --color-warning-subtle: var(--warning-subtle);
  --color-warning-text:   var(--warning-text);
  --color-info:           var(--info);
  --color-info-subtle:    var(--info-subtle);

  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;

  --shadow-sm:     var(--shadow-sm);
  --shadow-md:     var(--shadow-md);
  --shadow-lg:     var(--shadow-lg);
  --shadow-accent: var(--shadow-accent);
  --shadow-hero:   var(--glow-hero);

  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg:  12px;
  --radius-xl:  16px;
  --radius-2xl: 20px;
  --radius-full: 9999px;

  --animate-fade-in:     fade-in 150ms ease-out;
  --animate-slide-up:    slide-up 200ms ease-out;
  --animate-scale-in:    scale-in 150ms ease-out;
  --animate-pulse-once:  pulse-once 400ms ease-out;
  --animate-float:       float 4s ease-in-out infinite;
  --animate-twinkle:     twinkle 3s ease-in-out infinite;
  --animate-gradient-x:  gradient-x 6s ease infinite;
}

/* ─── Base reset ─── */
*, *::before, *::after { box-sizing: border-box; }

html, body, #root {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background-color: var(--bg-page);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ─── Custom scrollbar (dark-mode aware) ─── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* ─── Focus visible ring ─── */
:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

/* ─── Animations ─── */
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes pulse-once {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.12); }
  70%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-12px); }
}

@keyframes twinkle {
  0%, 100% { opacity: 0.08; }
  50%      { opacity: 0.55; }
}

@keyframes gradient-x {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}

.text-gradient {
  background: linear-gradient(135deg, oklch(38% 0.18 240), oklch(52% 0.20 245), oklch(68% 0.16 252));
  background-size: 200% 200%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradient-x 6s ease infinite;
}

.arena-overlay {
  background:
    radial-gradient(ellipse 68% 42% at 50% 0%, oklch(52% 0.20 245 / 0.14) 0%, transparent 60%),
    radial-gradient(ellipse 44% 30% at 85% 18%, oklch(68% 0.16 252 / 0.12) 0%, transparent 68%),
    linear-gradient(180deg, oklch(100% 0 0 / 0.64), var(--bg-page) 74%);
}

.arena-grid {
  background-image:
    linear-gradient(oklch(30% 0.045 265 / 0.035) 1px, transparent 1px),
    linear-gradient(90deg, oklch(30% 0.045 265 / 0.035) 1px, transparent 1px);
  background-size: 60px 60px;
}

.card-glow {
  transition: border-color 200ms ease, box-shadow 200ms ease, transform 200ms ease, background-color 200ms ease;
}

.card-glow:hover {
  border-color: var(--accent-muted);
  box-shadow: var(--shadow-accent);
  transform: translateY(-3px);
}

.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 560ms ease, transform 560ms ease;
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

---

## 5. Dark Mode Toggle Implementation

### 5.1 Init script in `index.html`

Add this script **before** the `</head>` tag in `frontend/index.html`, after the font links. It reads saved preference or falls back to OS preference, and applies the `dark` class instantly (before React hydrates) to prevent flash:

```html
<script>
  (function () {
    try {
      var saved = localStorage.getItem('ga-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (saved === 'dark' || (!saved && prefersDark)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
</script>
```

### 5.2 `ThemeToggle.tsx` component

Create `frontend/src/components/ThemeToggle.tsx`:

```tsx
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ga-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ga-theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(d => !d)}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-overlay hover:text-text-primary"
    >
      {isDark ? (
        /* Sun icon */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        /* Moon icon */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}
```

---

## 6. Component Library Specifications

All components use semantic CSS variable–based Tailwind utilities (e.g., `bg-surface`, `text-text-primary`, `border-border`). These map to `--color-*` in `@theme inline` from index.css.

### 6.1 Buttons

There are 5 button variants. Apply transition-colors duration-150 and disabled states to all.

#### Primary
```
bg-accent text-text-on-accent hover:bg-accent-hover
font-medium rounded-lg transition-colors duration-150
disabled:opacity-50 disabled:cursor-not-allowed
```
Sizes:
- `sm`: `px-3 py-1.5 text-sm`
- `md` (default): `px-4 py-2 text-sm`
- `lg`: `px-5 py-2.5 text-base`

#### Secondary
```
bg-elevated text-text-primary border border-border
hover:bg-overlay hover:border-border-strong
font-medium rounded-lg transition-colors duration-150
disabled:opacity-50 disabled:cursor-not-allowed
```

#### Ghost
```
text-text-secondary hover:bg-overlay hover:text-text-primary
font-medium rounded-lg transition-colors duration-150
disabled:opacity-40 disabled:cursor-not-allowed
```

#### Danger
```
bg-danger text-text-on-accent hover:opacity-90
font-medium rounded-lg transition-colors duration-150
disabled:opacity-50 disabled:cursor-not-allowed
```

#### Success
```
bg-success text-text-on-accent hover:opacity-90
font-medium rounded-lg transition-colors duration-150
disabled:opacity-50 disabled:cursor-not-allowed
```

**Loading state** (all buttons): When loading, show an inline spinner (animate-spin, 16px) and set `disabled`. The button must keep its width — use `flex items-center gap-2 justify-center`.

**Full-width buttons**: Add `w-full` — used on Auth page and inside cards.

### 6.2 Inputs & Form Controls

#### Text Input / Textarea
```
w-full bg-overlay text-text-primary placeholder:text-text-muted
border border-border rounded-lg px-3 py-2
focus:outline-none focus:border-border-focus focus:ring-2 focus:ring-[var(--border-focus)]/20
transition-colors duration-150
```

**Error state**: Replace `border-border` with `border-danger` and ring with `ring-[var(--danger)]/20`.

**Disabled state**: `opacity-60 cursor-not-allowed`

**Label**: `block text-sm font-medium text-text-secondary mb-1`

**Helper text**: `mt-1.5 text-xs text-text-muted`

**Error text**: `mt-1.5 text-xs text-danger`

#### Textarea additions
```
resize-none min-h-[80px]
```

### 6.3 Cards & Surfaces

#### Standard Card
```
bg-surface rounded-2xl border border-border shadow-sm
```
Padding: `p-4` (compact), `p-5` (default), `p-6` (roomy)

#### Elevated Card (modals, popovers)
```
bg-elevated rounded-2xl border border-border-strong shadow-lg
```

#### Interactive Card (hover effect for lists)
```
bg-surface rounded-xl border border-border
hover:border-border-strong hover:bg-elevated
transition-all duration-150 cursor-pointer
```

#### Inset / Sunken Card (used inside cards)
```
bg-page rounded-lg border border-border
```

### 6.4 Modal Dialogs

Use the shared `Modal` component for blocked actions, game join failures, move failures, confirmations, and non-field errors. Do not use browser `alert()`, `confirm()`, or `prompt()`.

**Overlay**:
```
fixed inset-0 z-50 flex items-center justify-center px-4 py-6
```
Backdrop: `absolute inset-0 bg-black/60`

**Panel**:
```
relative w-full max-w-md animate-scale-in rounded-2xl border border-border bg-surface p-4 shadow-lg sm:p-5
```

**Header**:
- Icon well: `h-10 w-10 rounded-xl`
- Title: `text-lg font-semibold text-text-primary`
- Body: `mt-1 text-sm leading-6 text-text-secondary`
- Close button: icon-only, `aria-label="Close"`, `h-9 w-9 rounded-lg text-text-secondary hover:bg-overlay hover:text-text-primary`

**Variants**:
- Info: `bg-info-subtle text-info`
- Warning: `bg-warning-subtle text-warning-text`
- Danger: `bg-danger-subtle text-danger-text`
- Success: `bg-success-subtle text-success-text`

**Actions**:
- Action row: `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`
- Primary action: Primary button style.
- Secondary action: Secondary button style.
- If no primary action is supplied, the modal shows a single `Close` primary action.

**Accessibility**:
- Use `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
- Move focus into the modal when opened and restore focus when closed.
- Close on Escape and backdrop click.
- All modal buttons must be keyboard reachable.

**Game error usage**:
- `Game is full`: warning modal explaining Tic Tac Toe only supports two players.
- `Already in this game`: info modal explaining the game may already be open in another tab, browser, or device; if the game can be found locally by code, primary action is `Resume here`.
- `Game is not active`: warning modal explaining the room cannot be joined or acted on.
- `Game not found`: danger modal asking the user to check the game code.
- Move failures such as `Waiting for another player`, `It is not your turn`, `You are not in this game`, and invalid moves use specific modal copy.
- Auth form errors remain inline near the fields, not modalized.

### 6.5 Badges & Chips

Shape: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium`

Variants (fill background with subtle tint, colored text):
- Default: `bg-overlay text-text-secondary`
- Accent: `bg-accent-subtle text-accent`
- Success: `bg-success-subtle text-success-text`
- Danger: `bg-danger-subtle text-danger-text`
- Warning: `bg-warning-subtle text-warning-text`
- Info: `bg-info-subtle text-info`

**With dot**: Add a `w-1.5 h-1.5 rounded-full bg-current` before the text.

### 6.6 Status Dot

```
w-2 h-2 rounded-full flex-shrink-0
```
- Online: `bg-success`
- Offline: `bg-text-disabled`
- Away: `bg-warning`

### 6.7 Dividers

Horizontal: `<hr className="border-0 border-t border-border" />`

### 6.8 Skeleton / Loading Placeholders

```
animate-pulse rounded bg-overlay
```
Use as placeholder blocks while data loads.

### 6.9 Avatar

Shape: `w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0`

Default background (based on first char hash, cycles through):
```
bg-accent, bg-sky-600, bg-emerald-600, bg-amber-600, bg-rose-600
```
Text: `text-white`

Sizes: `w-6 h-6 text-xs` (sm), `w-8 h-8 text-sm` (md), `w-10 h-10 text-base` (lg)

### 6.10 Tooltips (if needed)

```
absolute z-50 px-2 py-1 text-xs font-medium
bg-elevated border border-border-strong rounded-md shadow-md text-text-primary
pointer-events-none
```

---

## 7. Layout System

### 7.1 Breakpoints (Tailwind defaults, use these throughout)

| Breakpoint | Prefix | Min width |
|------------|--------|-----------|
| Mobile | (none) | 0px |
| Small | `sm:` | 640px |
| Medium | `md:` | 768px |
| Large | `lg:` | 1024px |
| XL | `xl:` | 1280px |

**Mobile-first**: All base styles are for mobile. Use `sm:`, `md:`, `lg:` to override upward.

### 7.2 Page Shell

Every page (except Auth) shares this outer structure:

```
min-h-screen bg-page text-text-primary flex flex-col
```

Containing:
1. `<Header />` component — fixed height, `h-14` (56px), sticky
2. Main content: `flex-1 overflow-auto`
3. No footer needed currently

### 7.3 Content Container

Inside main content, wrap page content in:
```
max-w-7xl mx-auto px-4 sm:px-6 py-6
```

### 7.4 Header Component (`Header.tsx`)

The shared top header used on all authenticated pages. Structure:

```
sticky top-0 z-30 h-14 bg-surface/80 backdrop-blur-sm border-b border-border
flex items-center justify-between px-4 sm:px-6
```

Left: Logo — "Games Arena" in `text-lg font-bold text-text-primary` with a small accent mark or icon before it.
Center (desktop only): Nav links — Dashboard, History. `hidden md:flex items-center gap-1`
Right: ThemeToggle + user dropdown trigger

**User dropdown trigger**: `flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-overlay transition-colors`
- Avatar (sm)
- Username `text-sm font-medium text-text-primary hidden sm:block`
- Chevron-down icon `text-text-muted`

**User dropdown menu** (positioned absolute below trigger):
```
absolute right-0 top-full mt-1 w-44 bg-elevated border border-border-strong rounded-xl shadow-lg py-1 z-50
```
Items: `w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-overlay hover:text-text-primary transition-colors`
Items: "My Profile" (future), "History", divider, "Sign out" (danger color)

**Mobile nav**: On mobile, hamburger button appears. Tapping opens a full-width slide-down menu.

---

## 8. Page Specifications

### 8.1 Auth Page (`Auth.tsx`)

**Layout**: Full viewport, centered, `min-h-screen bg-page flex items-center justify-center p-4`

**Background treatment**: The page background uses the `--bg-page` color. If an AI agent with image-generation capability is available, add a subtle radial gradient overlay using the accent color at very low opacity (5-8%) to add depth. See Section 12 for image generation details.

**Card**: `w-full max-w-sm bg-surface rounded-2xl border border-border shadow-lg p-8`

**Logo area** (top of card):
```
mb-8 text-center
```
- "Games Arena" in `text-3xl font-extrabold text-text-primary`
- Subtitle: "Play with friends, anywhere." in `text-sm text-text-muted mt-1`
- If a logo image is provided: `<img src="/logo.svg" alt="Games Arena" className="h-10 w-auto mx-auto mb-3" />`

**Tab switcher** (Login / Sign Up):
```
flex rounded-xl bg-elevated border border-border p-1 mb-6
```
Each tab: `flex-1 py-2 text-sm font-medium rounded-lg text-center transition-colors duration-150`
- Active: `bg-surface text-text-primary shadow-sm`
- Inactive: `text-text-muted hover:text-text-secondary`

**Form fields**: Full `space-y-4`. Use the Input spec from 6.2. Labels above each input.

**Error banner** (shown above submit button):
```
flex items-start gap-2 rounded-lg bg-danger-subtle border border-danger/20 px-3 py-2 text-sm text-danger-text
```
Prepend a small warning icon.

**Submit button**: Primary button, `w-full`, `lg` size.

**Auth footer text** (below card):
```
mt-6 text-center text-xs text-text-muted
```
e.g., "By signing in you agree to our Terms."

**Responsive**: The card is naturally full-width on mobile (max-w-sm constrains it on desktop). No changes needed.

---

### 8.2 Dashboard Page (`Dashboard.tsx`)

**Layout** (uses page shell + Header):
```
Page shell → Header → main content area
```

Main content: `max-w-7xl mx-auto px-4 sm:px-6 py-6`

**Grid layout**:
```
grid grid-cols-1 lg:grid-cols-3 gap-6
```
- Left/main column: `lg:col-span-2 space-y-6`
- Right sidebar: `lg:col-span-1` (Leaderboard)

On mobile: single column, leaderboard appears below main content.

#### Section: Create & Join Game

Card with title "Play Now":
```
bg-surface rounded-2xl border border-border p-5 space-y-4
```

**Section title pattern** (reused throughout Dashboard):
```
text-lg font-semibold text-text-primary mb-4
```

**Game type selector**: A flex-wrap row of game type pills:
```
flex flex-wrap gap-2
```
Each pill: Secondary button (`sm` size) with a game-specific icon or emoji prefix. Active/selected game type pill: replace `bg-elevated` with `bg-accent-subtle border-accent-muted text-accent`.

Game type labels and emoji: 
- `ticTacToe` → ❌ "Tic Tac Toe"
- `wisecracker` → 😄 "Wisecracker"  
- `chess` → ♟️ "Chess" (disabled until implemented)
- `checkers` → 🔴 "Checkers" (disabled)
- `uno` → 🃏 "Uno" (disabled)
- `president` → 👑 "President" (disabled)

Disabled games show with `opacity-40 cursor-not-allowed` and a `coming soon` badge.

**Create button**: Primary `md` size — "Create Game"

**Divider**: `<hr />` between create and join.

**Join game row**:
```
flex gap-2 items-end
```
Input (`flex-1`): label "Game Code", placeholder "ABC123", `uppercase tracking-widest font-mono`
Button: Secondary, "Join"

#### Section: Active Games

Card title "Active Games" + count badge.

**Empty state**:
```
text-center py-8 text-text-muted
```
Small "No active games" text with a play icon above it.

**Game list**: `space-y-2`

Each game row (Interactive Card variant):
```
flex items-center gap-3 px-4 py-3 bg-surface rounded-xl border border-border
hover:border-border-strong hover:bg-elevated transition-all duration-150 cursor-pointer
```
- Game icon/emoji (left, flex-shrink-0)
- Game info (flex-1):
  - Game name: `text-sm font-medium text-text-primary`
  - Players: `text-xs text-text-muted` ("2/2 players")
- Game code: `text-xs font-mono text-text-muted`
- Arrow icon: `text-text-disabled`

#### Section: Completed Games

Card title "Recent Games" + "View all →" link (text-accent text-sm).

**Empty state**: Same pattern as active games.

**Games table** (`space-y-2`):

Each row:
```
flex items-center gap-3 px-4 py-3 bg-elevated rounded-xl
```
- Game name: `text-sm font-medium text-text-primary flex-1`
- Opponent name: `text-sm text-text-secondary`
- Result badge: badge variant (Success/Danger/Warning for Win/Loss/Draw)
- Date: `text-xs text-text-muted`

#### Section: Leaderboard Sidebar

Card: full height on desktop, below main on mobile.

Spec in Section 9.5 (Leaderboard component).

---

### 8.3 GameBoard Page (`GameBoard.tsx`)

**Layout** (page shell + Header):

Main content is two-pane on desktop, stacked on mobile:
```
flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto px-4 sm:px-6 py-6
```

Left pane (game area): `flex-1 min-w-0`
Right pane (sidebar): `lg:w-72 lg:flex-shrink-0 space-y-4`

On mobile: sidebar appears below the game board.

#### Left pane structure

**Game header** (inside left pane, above board):
```
flex items-center gap-3 mb-4
```
- Back button: Ghost button `← Back`
- Game title: `text-xl font-semibold text-text-primary flex-1`
- Game code: `font-mono text-sm text-text-muted`
- Status badge: See badge spec. Use Success for "Your Turn", default for "Waiting", Warning for "Paused"

**Waiting message**:
```
rounded-xl bg-elevated border border-border p-8 text-center
```
Animated waiting dots or spinner. Text: "Waiting for opponent..." `text-text-muted`.

**GameInvite component** (appears while waiting for opponent): See Section 9.4.

**Completion message**:
```
rounded-xl border p-6 text-center animate-slide-up
```
Win: `border-success/30 bg-success-subtle` — "You won! 🎉" in `text-xl font-bold text-success-text`
Loss: `border-danger/30 bg-danger-subtle` — "You lost." in `text-xl font-bold text-danger-text`
Draw: `border-warning/30 bg-warning-subtle` — "It's a draw." in `text-xl font-bold text-warning-text`

Add a "Play Again" primary button and "Back to Dashboard" ghost button below the message.

**Game board area**: Renders the game-specific board component. See Section 10 for each board.

#### Right pane structure

**Players card**: Standard card, title "Players", `space-y-2`. Each player: PlayerCard component (Section 9.3).

**Move History card**: Standard card, title "Move History". MoveHistory component (Section 9.6).

---

### 8.4 GameHistory Page (`GameHistory.tsx`)

**Layout**: Standard page shell + Header.

**Page title**: `text-3xl font-bold text-text-primary mb-6`

**Filter tabs**:
```
flex gap-1.5 flex-wrap mb-6
```
Each filter tab: pill button — when active: `bg-accent-subtle text-accent border-accent-muted`, when inactive: `bg-elevated text-text-secondary border-border hover:bg-overlay`. Apply border to all tabs.

Labels: "All", "Tic Tac Toe", "Chess", "Checkers", "Uno", "President", "Wisecracker"

**Empty state**: Centered card `py-16 text-text-muted text-center`.

**Games list**: `space-y-2`

Each game row (same as Dashboard recent games but wider):
```
flex items-center gap-4 px-5 py-4 bg-surface rounded-xl border border-border
hover:bg-elevated transition-colors duration-150
```
- Game icon/emoji: flex-shrink-0
- Info block (flex-1):
  - Top row: `text-sm font-medium text-text-primary` (game name) + result badge
  - Bottom row: `text-xs text-text-muted` (players, date)
- Actions area:
  - Active games: "Resume" primary `sm` button
  - Completed: no button

**Pagination** (if needed): Simple prev/next ghost buttons with page count `text-sm text-text-muted`.

---

## 9. Component Specifications

### 9.1 Header (`Header.tsx`)

Defined fully in Section 7.4. Key notes:
- Always includes ThemeToggle on the right.
- Logo text color: `text-text-primary`. Accent the "Arena" word with `text-accent`.
- Mobile navigation is a hamburger menu that reveals nav links.
- The backdrop-blur on the header creates a frosted-glass effect when content scrolls beneath it.

### 9.2 ThemeToggle (`ThemeToggle.tsx`)

Defined fully in Section 5.2. Display: icon-only button, 36×36px touch target.

### 9.3 PlayerCard (`PlayerCard.tsx`)

```
flex items-center gap-3 p-3 rounded-xl border transition-all duration-150
```

States:
- Default (waiting): `bg-elevated border-border`
- Current turn: `bg-accent-subtle border-accent-muted` + subtle `shadow-accent`
- Winner: `bg-success-subtle border-success/40`

Contents:
- Avatar (md, 32px)
- Player info column (`flex flex-col min-w-0`):
  - Username: `text-sm font-medium text-text-primary truncate`
  - Connection: `flex items-center gap-1.5 text-xs text-text-muted`
    - Status dot (online/offline)
    - "Online" or "Offline"
- Right side (ml-auto):
  - If current turn: `text-xs font-medium text-accent` "Your turn" / "Playing"
  - If you: `text-xs text-text-muted` "(You)"

### 9.4 GameInvite (`GameInvite.tsx`)

Card shown to the game creator while waiting for an opponent.

```
bg-elevated rounded-2xl border border-border p-5 text-center
```

- Label: `text-sm text-text-muted mb-2` "Share this code with a friend"
- Code display:
  ```
  flex items-center justify-center gap-3 mb-4
  ```
  Code span: `text-3xl font-mono font-bold tracking-widest text-text-primary`
- Copy button: Secondary `sm` button "Copy Code". On copy: transitions to "Copied! ✓" with success color for 2 seconds.
- OR share a full URL: small ghost button "Share Link" below (optional).

### 9.5 Leaderboard (`Leaderboard.tsx`)

Standard card, full height.

**Header**:
```
flex items-center justify-between mb-4
```
- Title: `text-lg font-semibold text-text-primary`
- Game type filter: a small select or tabs for switching leaderboard by game type

**Top 3 (Podium)** — Optional but recommended for the leaderboard:
Display rank 1, 2, 3 with distinct styling:
- 1st: `text-warning` + gold crown icon or medal
- 2nd: `text-text-secondary` + silver medal
- 3rd: `text-warning-text/60` + bronze medal

**List items** (`space-y-1`):
Each entry:
```
flex items-center gap-3 px-2 py-2 rounded-lg transition-colors
```
- Current user: `bg-accent-subtle`
- Others: `hover:bg-elevated`

Columns:
- Rank: `w-6 text-center text-xs font-mono text-text-muted`
- Avatar (sm)
- Username: `flex-1 text-sm font-medium text-text-primary truncate`
- Wins: `text-sm font-semibold text-success`
- Win %: `text-xs text-text-muted w-10 text-right`

**Empty state**: `text-center py-6 text-sm text-text-muted`

### 9.6 MoveHistory (`MoveHistory.tsx`)

Standard card.

**Header**: `text-sm font-semibold text-text-primary mb-3`

**List**: `space-y-0.5 max-h-64 overflow-y-auto`

Each move row:
```
flex items-center justify-between py-1.5 px-2 rounded text-xs
hover:bg-elevated transition-colors
```
- Move number: `w-6 text-text-muted font-mono`
- Move notation: `flex-1 font-mono text-text-secondary`
- Player name: `text-text-muted max-w-[80px] truncate text-right`

Divider between rows: none (space-y-0.5 is sufficient).

**Empty state**: `text-xs text-text-muted py-4 text-center`

---

## 10. Game Board Specifications

Each game board component receives props from the GameBoard page. The board itself fills its container. All boards support a `disabled` state (greyed out, no click events) when it is not the player's turn.

### 10.1 Tic Tac Toe Board (`TicTacToeBoard.tsx`)

**Outer container**: `flex flex-col items-center gap-6`

**Turn indicator**: `text-sm font-medium text-text-secondary`  
"Your symbol: [X/O]" — show the symbol in its color.

**Grid**:
```
grid grid-cols-3 gap-3
```
Cell sizing: `aspect-square w-full max-w-[120px]` (the grid constrains the size)
Wrap the grid in: `w-full max-w-xs mx-auto`

Each cell button:
```
aspect-square w-full rounded-2xl bg-elevated border-2 border-border
flex items-center justify-center
hover:bg-overlay hover:border-border-strong
transition-all duration-100
disabled:cursor-not-allowed
```

Symbol styles:
- Empty cell: `text-transparent` (no content shown)
- X: `text-4xl font-extrabold text-accent` + `animate-scale-in`
- O: `text-4xl font-extrabold text-warning` + `animate-scale-in`

**Winning cells**: Replace border with `border-success` and bg with `bg-success-subtle`. Add `animate-pulse-once` class when win is detected.

**Board disabled state** (not your turn): Overlay the grid with pointer-events-none, reduce opacity to 0.7.

### 10.2 Chess Board (`ChessBoard.tsx`)

**Container**: `inline-flex flex-col items-center`

**Board**:
```
rounded-xl overflow-hidden border-4 border-[#8B6914] shadow-lg
```

Ranks and file labels (optional): `text-xs font-mono text-text-muted`

**Squares**: Each square is `aspect-square w-[min(7vw,56px)] sm:w-14 flex items-center justify-center relative`
- Light square bg: `#F0D9B5` (hard-coded — this is part of the chess aesthetic)
- Dark square bg: `#B58863` (hard-coded)
- Last move highlight: add `after:absolute after:inset-0 after:bg-yellow-400/30 after:pointer-events-none`
- Selected square: `ring-4 ring-inset ring-yellow-400`
- Possible move dot (empty square): `after:absolute after:w-1/3 after:h-1/3 after:rounded-full after:bg-black/20`
- Possible move capture (occupied): `after:absolute after:inset-0 after:rounded-full after:ring-4 after:ring-inset after:ring-black/40`

**Piece rendering**: Unicode chess symbols, `text-3xl select-none`
- White pieces: `[text-shadow:0_1px_2px_rgba(0,0,0,0.8)]` (for visibility on light squares)
- Black pieces: `[text-shadow:0_1px_2px_rgba(255,255,255,0.3)]`

**Board orientation**: Flip for black player (use CSS `transform: rotate(180deg)` on board + rotate each piece back).

### 10.3 Checkers Board (`CheckersBoard.tsx`)

Follows same pattern as Chess but with a simpler grid:
- Dark squares: `#5D4037`
- Light squares: `#BCAAA4`
- Piece: `w-4/5 h-4/5 rounded-full border-4` with player-color fills
- Red pieces: `bg-red-500 border-red-700`
- Black pieces: `bg-neutral-800 border-neutral-900`
- Selected piece: `ring-4 ring-yellow-400 ring-offset-2`
- King marker: crown overlay icon

### 10.4 Wisecracker Board (`WisecrackerBoard.tsx`)

This is a text-heavy, phase-driven UI.

**Outer container**: `space-y-5 w-full max-w-2xl mx-auto`

**Status bar** (top):
```
grid grid-cols-3 gap-3
```
Each status panel: `rounded-xl bg-elevated border border-border px-4 py-3`
- Label: `text-xs font-medium text-text-muted uppercase tracking-wider mb-1`
- Value: `text-sm font-semibold text-text-primary`

**Phase labels** (shown in status bar or as a header pill):
- `lobby` → default badge "Lobby"
- `prompt` → accent badge "Choosing Prompt"
- `answering` → info badge "Answering"
- `revealing` → warning badge "Revealing"
- `roundResult` → success badge "Round Over"
- `completed` → success badge "Match Complete"

**Mid-round waiting alert** (conditional):
```
rounded-xl bg-warning-subtle border border-warning/30 px-4 py-3 text-sm text-warning-text
flex items-center gap-2
```
Prepend info icon.

**Phase containers** (each phase section):
Standard card `bg-surface rounded-2xl border border-border p-5`

Section title: `text-base font-semibold text-text-primary mb-3`

**Lobby phase**:
- Max score row: `flex items-center gap-3`
  - Label: `text-sm text-text-secondary`
  - Number input: `w-20` + input styles from 6.2
- Start/waiting state clearly visible

**Prompt phase** (chooser view):
- Prompt card: `bg-elevated rounded-xl p-4 mb-3 text-text-primary italic`
- Row of buttons: `flex gap-2` — "Refresh" (ghost) + "Use This Prompt" (primary)

**Answering phase**:
- Prompt display: `bg-elevated rounded-xl p-4 mb-4 text-text-primary text-center`
  - Blanks rendered as: `inline-block min-w-[80px] border-b-2 border-accent mx-1 text-accent font-medium` for each blank
- Answer inputs: `space-y-3`
  - Label per blank: `text-xs font-medium text-text-muted uppercase tracking-wider`
  - Input: standard input spec
- Submit button: Success variant `w-full`
- Already submitted: success banner `bg-success-subtle border border-success/30 rounded-xl px-4 py-3 text-success-text text-sm text-center`

**Waiting list** (subcomponent within answering phase):
```
mt-4 rounded-xl bg-elevated border border-border p-4
```
Title `text-xs font-medium text-text-muted uppercase tracking-wider mb-2`
Each player row: `flex items-center gap-2 text-sm py-1`
- Player name: `text-text-secondary`
- Status: dot — success (submitted) or pulsing `animate-pulse text-text-muted` (waiting)

**Revealing phase**:
Each answer option button:
```
w-full rounded-xl bg-elevated border border-border px-4 py-3 text-left text-sm text-text-primary
hover:border-border-strong hover:bg-overlay transition-all duration-150
```
Revealed answer: Show author below answer in `text-xs text-text-muted mt-1`
Chooser picks: On selection, highlight the chosen card with `bg-accent-subtle border-accent-muted`

**Round result**:
Winner announcement: `text-center text-success font-semibold text-base` + optional confetti note

**Completed / Final scoreboard**:
Card `bg-surface rounded-2xl border border-border p-5`
Title `text-lg font-semibold mb-4`
Score grid `grid gap-2 sm:grid-cols-2`
Each score row: Inset card `bg-page rounded-lg border border-border px-3 py-2 flex justify-between`
- Player name: `text-sm font-medium text-text-primary`
- Score: `text-sm font-mono font-bold text-accent`

**Responsive**: All Wisecracker cards go to full-width on mobile. The 3-column status bar collapses to 1 column on mobile if needed (use `grid-cols-1 sm:grid-cols-3`).

### 10.5 Uno Table (`UnoTable.tsx`)

**Outer**: `flex flex-col items-center gap-6 py-4`

**Play area** (draw pile + discard):
```
flex gap-6 items-center justify-center
```

Card base size: `w-16 h-24 rounded-xl flex items-center justify-center font-bold text-white shadow-md flex-shrink-0`

Card colors:
- Red: `bg-red-500`
- Green: `bg-emerald-500`
- Blue: `bg-blue-500`
- Yellow: `bg-amber-400 text-amber-900`
- Wild/Draw Four: `bg-gradient-to-br from-red-500 via-green-500 to-blue-500`
- Draw pile back: `bg-elevated border-2 border-border text-text-muted text-sm`

Draw button: Draw pile card + `hover:scale-105 active:scale-95 transition-transform duration-100 cursor-pointer`

**Player hand**: 
```
flex flex-wrap gap-2 justify-center max-w-2xl w-full px-2
```
Each card in hand: same card base but `w-14 h-20` + `hover:scale-110 hover:-translate-y-2 transition-transform duration-100 cursor-pointer`
Disabled (can't play): `opacity-50 cursor-not-allowed hover:scale-100 hover:translate-y-0`

**Color picker** (conditional, shown after playing a Wild):
```
flex gap-3 mt-2
```
Each color button: `w-12 h-12 rounded-full shadow-md hover:scale-110 transition-transform` with respective color bg.

**Other players** (placeholder for future UI): Top of screen, small, shows opponent hand backs.

**Responsive**: On mobile, card hand wraps and cards are smaller. Min card size `w-12 h-16`.

### 10.6 President Table (`PresidentTable.tsx`)

Currently a stub. Apply placeholder card:
```
rounded-2xl bg-elevated border border-border border-dashed p-12 text-center
```
Icon: 👑 `text-4xl mb-3`
Text: `text-text-muted` "President — Coming Soon"
Subtext: `text-xs text-text-disabled mt-1`

Apply the same pattern for CheckersBoard stub when it is in stub/incomplete state.

---

## 11. Color Semantics Reference

Use these rules consistently to avoid misuse of semantic colors.

| Color | Token | Use for |
|-------|-------|---------|
| Accent (brand blue) | `text-accent`, `bg-accent` | Primary actions, selected states, links, "your turn" |
| Success (emerald) | `text-success`, `bg-success` | Win results, online status, successful actions, submitted state |
| Danger (red) | `text-danger`, `bg-danger` | Loss results, errors, destructive actions, form validation errors |
| Warning (amber) | `text-warning`, `bg-warning` | Draw results, alerts, "waiting" states, Uno yellow cards |
| Info (sky) | `text-info` | Informational notices, neutral system messages |
| text-text-primary | — | All main readable text |
| text-text-secondary | — | Supporting text, labels, less important info |
| text-text-muted | — | Timestamps, counts, helper text |
| text-text-disabled | — | Truly non-interactive or unavailable content |

**Game result color rules (consistent everywhere)**:
- Win → Success color
- Loss → Danger color
- Draw → Warning color
- Active/In Progress → Accent color

---

## 12. Responsive Design Rules

### Mandatory responsive rules
1. **No horizontal overflow**: Every page must be fully usable at 320px width. Use `min-w-0` on flex children that might overflow. Use `truncate` on long text.
2. **Touch targets**: Interactive elements must be at least 44×44px on mobile. Buttons use `min-h-[44px]` on mobile if needed.
3. **Grid collapsing**: All multi-column grids use `grid-cols-1` as base, adding columns at `md:` or `lg:`.
4. **Sidebar stacking**: Dashboard sidebar (Leaderboard) and GameBoard sidebar stack below main content on mobile.
5. **Game boards**: All boards must be responsive — use `w-full max-w-[size] mx-auto` or viewport-relative sizing. Chess board cells use `min(7vw, 56px)` to scale down gracefully.
6. **Header nav**: Full nav links are `hidden md:flex`. Mobile gets hamburger menu.
7. **No fixed pixel widths on containers**: Use `max-w-*` + `w-full` instead.

### Breakpoint-specific notes
- `< sm` (< 640px): Single column everything. Cards have `p-4` (not p-5/p-6). Header shows minimal: logo + hamburger.
- `sm-lg` (640-1023px): Most layouts still single column. Can start showing 2-col grids for smaller elements.
- `>= lg` (1024px+): Full 3-column dashboard, side-by-side GameBoard layout.

---

## 13. Motion & Transitions

### Transition rules
- All color/bg changes: `transition-colors duration-150`
- All transform changes (hover scale): `transition-transform duration-100`
- Sidebar/panel open/close: `transition-all duration-200`
- Page entrance: `animate-fade-in` (defined in index.css)
- New game piece placement (TTT, Chess moves): `animate-scale-in`
- Win highlight: `animate-pulse-once`
- Result card entrance: `animate-slide-up`

### What NOT to animate
- Long durations (> 300ms) on interactive elements (feel sluggish)
- Opacity changes that affect readability
- Background blur changes (expensive on mobile)

### Reduced motion respect
In index.css, add:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 14. Accessibility Requirements

1. **Color contrast**: All text/background combinations must meet WCAG AA (4.5:1 for normal text, 3:1 for large text). The token system defined in Section 4 satisfies this. Do not override colors outside the token system.
2. **Focus rings**: All interactive elements must show a visible focus ring (`:focus-visible` is set globally). Do NOT suppress focus styles without replacing them.
3. **ARIA labels**: Icon-only buttons (ThemeToggle, close buttons, copy button) must have `aria-label`.
4. **Semantic HTML**: Use `<button>` for actions, `<a>` for navigation, `<nav>` for nav regions, `<main>` for main content, `<header>` for the app header.
5. **Live regions**: When game state changes (new move, game over), update should be announced. Consider `aria-live="polite"` on the status badge in GameBoard.
6. **Game boards**: Board cells should have `aria-label` describing their position (e.g., "Row 2, Column 3").
7. **Keyboard navigation**: All interactive elements must be reachable and operable via keyboard alone.
8. **Error messages**: Form errors must be linked to their input with `aria-describedby`.

---

## 15. Asset & Image Guide

The following images can be generated by an AI image generation agent to enhance the design. They are all optional enhancements — the design works without them, but they significantly elevate the visual quality.

The PenguinCookie shared assets are part of the Games Arena visual system:

- `frontend/public/favicon.png`: copied from PenguinCookie `favicon.png`; used by `frontend/index.html`.
- `frontend/src/assets/penguin-mascot.png`: shared PenguinCookie mascot; used in Header and Auth branding while keeping "Games Arena" as the product name.
- `frontend/src/assets/hero-bg-light.png`: light-mode page atmosphere and Auth background.
- `frontend/src/assets/hero-bg.png`: dark-mode page atmosphere and Auth background.

Use the background images through a shared page-backdrop pattern: light image visible in light mode, dark image visible in dark mode, plus a low-opacity radial blue overlay and subtle grid. Auth may use the strongest treatment. Dashboard should use a subtler treatment. GameBoard and History should use quiet overlays so game state stays readable.
### 15.1 Logo / Brand Mark

**Default**: Use `penguin-mascot.png` as the shared identity mark in Header and Auth. Optional future generation can create a logo for "Games Arena" combining competitive gaming energy with a clean, modern aesthetic.

**Spec for generation**:
- Style: Flat / geometric, minimal gradients, works on both dark and light backgrounds
- Concept: A stylized shield or arena shape containing a small collection of recognizable game pieces (chess knight, playing card suit, tic-tac-toe grid)
- Colors: Brand blue, white, and soft navy-slate
- Deliver as: SVG preferred, PNG at 512×512px minimum
- Usage: In `<Header />` left side + Auth card top. Must look good at 40px height.

**Alternate simpler concept**: Stylized "GA" monogram with a small crown or lightning bolt. Clean wordmark of "Games Arena" in a custom gaming typeface.

---

### 15.2 Page Backgrounds

**What to generate**: A subtle, atmospheric background texture or pattern for the Auth page.

**Spec**:
- Style: Abstract geometric/isometric, very subtle (will be used at low opacity or as a very muted background)
- Content: Faint silhouettes of game elements (chess pieces, cards, dice, game controllers)
- Colors for dark mode: Soft navy-slate with blue highlights, very low contrast
- Colors for light mode: Light slate with barely-visible blue shapes
- Deliver as: Two versions — dark and light, as SVG or large PNG (1920×1080)
- Usage: `background-image` on Auth page's `min-h-screen` container

---

### 15.3 Game Type Thumbnail Cards — HIGH PRIORITY

**What to generate**: 6 illustrated thumbnail cards, one per game type. These appear in the Dashboard "Play Now" section when selecting a game to create.

**Card dimensions**: 160×100px (3:2 ratio), or scale up as needed.

**Style**: Consistent illustration style across all 6 — recommend flat vector with bold shapes and game-specific accent colors on a dark background.

**Individual specs**:

1. **Tic Tac Toe** (`ticTacToe.png`): Bold X and O symbols in brand blue/amber on a dark grid. Clean, iconic.
2. **Wisecracker** (`wisecracker.png`): Two speech bubbles with a laughing face or microphone, colorful and playful. This is a party/humor game.
3. **Chess** (`chess.png`): A single chess knight piece, dramatic lighting, blue accent, on dark background.
4. **Checkers** (`checkers.png`): Top-down view of a checkerboard in play with a few red and black pieces.
5. **Uno** (`uno.png`): A fan of colorful Uno cards (red, green, blue, yellow) spread out.
6. **President** (`president.png`): A gold crown above a hand of playing cards.

**Usage**: Shown on the game type selector pill/card in Dashboard, and potentially as background thumbnails for game type filter chips in GameHistory.

---

### 15.4 Empty State Illustrations — MEDIUM PRIORITY

**What to generate**: 2 small illustrations for empty states.

1. **No active games** (`empty-games.svg`): A small, friendly illustration of an empty game table or board. Simple and clean. Style: outlined/sketch style matching brand colors.
2. **No game history** (`empty-history.svg`): Similar style — an hourglass or calendar with "0" games.
3. **Waiting for opponent** (`waiting-opponent.svg`): An animated or static "..." style illustration, conveying anticipation.

**Style**: Simple, friendly, consistent with the brand. Works on both dark and light backgrounds.

---

### 15.5 Error / 404 Illustration — LOW PRIORITY

**What to generate**: A fun 404 / error page illustration.

**Spec**: A confused or shrugging penguin character (matching the "PenguinCookie" developer brand) surrounded by floating game pieces. Text "Game not found" would appear beside it. Should be charming and light-hearted.

**Deliver as**: SVG or PNG at 400×300px.

---

### 15.6 Avatar Placeholder

**What to generate**: A default avatar image used when a player has no custom avatar.

**Spec**: Simple geometric avatar or silhouette style, in brand blue, neutral. Should look good in a small circle (40×40px).

**Deliver as**: SVG circle-shaped icon.

---

## 16. Rules for Future Pages & Components

When adding any new page or component to Games Arena, follow these binding rules:

### Rule 1: Always use semantic tokens
Never use Tailwind's built-in color utilities (gray-*, blue-*, etc.) directly. Always use the semantic tokens: `bg-surface`, `text-text-primary`, `border-border`, etc. This ensures light/dark mode works automatically.

The only exceptions are:
- Chess board squares (hard-coded amber/brown chess aesthetic)
- Game piece colors in Uno (red-500, green-500, etc. are intentional card colors)
- Status dot colors that must be vivid regardless of theme

### Rule 2: Mobile-first, always
Write `grid-cols-1` first, add `md:grid-cols-2` second. Write `flex-col` first, add `lg:flex-row` second. Never assume desktop layout.

### Rule 3: Match existing patterns
Before creating a new component, check if one of these existing patterns covers the need:
- New data display → Standard Card or Interactive Card
- New action → Button (primary/secondary/ghost)
- New status → Badge with appropriate semantic variant
- New form field → Input spec from Section 6.2

### Rule 4: New game boards
Any new game board component should:
- Accept `gameState`, `onMove`, `isMyTurn`, `myPlayerId` as props minimum
- Wrap the board in `w-full max-w-[appropriate size] mx-auto`
- Have a `disabled` visual state (pointer-events-none + opacity-70) when `!isMyTurn`
- Show a "Coming Soon" placeholder using the PresidentTable placeholder pattern until logic is implemented
- Animate piece placement with `animate-scale-in`

### Rule 5: Typography hierarchy
Use the size scale from Section 3.2 strictly:
- Page heading → `text-3xl font-bold`
- Section heading → `text-lg font-semibold`
- Card heading → `text-base font-semibold`
- Body text → `text-sm` or `text-base`
- Labels/metadata → `text-xs`

### Rule 6: Buttons are consistent
Every clickable action is a `<button>`. Always provide hover, focus, and disabled states. Never use a bare `<div onClick>`.

### Rule 7: Test both modes
Every new page/component must be visually reviewed in both dark and light mode before being considered complete.

### Rule 8: The Header is shared
Every authenticated page uses the `<Header />` component. Do not rebuild the header inline in a page component.

### Rule 9: Animation is subtle
Use the animation utilities defined in index.css (`fade-in`, `slide-up`, `scale-in`, `pulse-once`, `float`, `twinkle`, `gradient-x`, and reveal-on-scroll). Do not add new keyframes without adding them to index.css and this document. Do not use animations on elements that update frequently (e.g., live counters, clocks).

### Rule 10: Spacing is intentional
- Page-level padding: `px-4 sm:px-6 py-6`
- Card internal padding: `p-4` (small) or `p-5` (default) or `p-6` (large/roomy)
- Between sibling cards: `gap-4` or `gap-6`
- Inside card, between elements: `space-y-3` or `space-y-4`
- Tightest group spacing: `gap-1.5` or `space-y-1`

---

## 17. Verification Checklist for Implementation Agent

After implementing, verify the following:

### Functional checks
- [ ] Dark mode activates on first load if OS is set to dark
- [ ] Light mode activates on first load if OS is set to light
- [ ] Theme toggle persists across page refreshes (stored in `localStorage` under key `ga-theme`)
- [ ] No flash of wrong theme on page load (init script in index.html fires before React)
- [ ] All 4 pages render without console errors in both modes
- [ ] No browser `alert()`, `confirm()`, or `prompt()` calls are used for app errors
- [ ] Join failures and move failures open the shared Modal component

### Visual checks
- [ ] Auth page: Card is centered at all screen sizes, form is usable on 320px mobile
- [ ] Dashboard: 3-column layout at ≥1024px, single column below; leaderboard below games on mobile
- [ ] GameBoard: Side-by-side at ≥1024px, board stacked above sidebar on mobile
- [ ] GameHistory: Filter tabs wrap correctly on mobile, game list rows are readable on small screens
- [ ] ThemeToggle appears in Header on all authenticated pages
- [ ] No content overflows its container horizontally at 320px viewport width
- [ ] Semantic colors (win/loss/draw) are visible and accessible in both light and dark mode
- [ ] Dark mode reads as soft navy-slate, not near-black or harshly contrasty
- [ ] Modals are readable and correctly spaced at 320px, tablet, and desktop widths
- [ ] Favicon loads from `frontend/public/favicon.png`
- [ ] Header and Auth use `penguin-mascot.png`
- [ ] Light mode page atmosphere uses `hero-bg-light.png`; dark mode uses `hero-bg.png`
- [ ] Blue glow, gradient text, cursor, and reveal motion states are visible where specified

### Component checks
- [ ] Buttons show hover state, focus ring, and disabled state
- [ ] Inputs show focus ring and error state
- [ ] Badges render correct color for each variant
- [ ] Modals close via close button, Escape, and backdrop click
- [ ] Modal focus moves into the dialog on open and returns to the trigger on close
- [ ] PlayerCard highlights current turn in accent color
- [ ] Tic Tac Toe X is Accent (brand blue), O is warning (amber)
- [ ] Game codes always render in `font-mono`
- [ ] Wisecracker phase label badge updates with each phase

### Build check
- [ ] `npm run build` completes without errors after Tailwind 4 migration
- [ ] No references to old Tailwind config file remain
- [ ] `tailwind.config.js` is deleted
- [ ] `postcss.config.js` is deleted (or updated for v4 if PostCSS still needed)

