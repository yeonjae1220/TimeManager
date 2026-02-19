<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script setup></script>

<style>
/* ─── Design Tokens ─────────────────────────────── */
:root {
  --bg:            #0c0c0c;
  --surface:       #141414;
  --surface-2:     #1b1b1b;
  --border:        #252525;
  --border-subtle: #1a1a1a;

  --text:   #dedad3;
  --text-2: #5c5955;
  --text-3: #2e2c2a;

  --accent:     #c9a96e;
  --accent-dim: rgba(201,169,110,0.09);
  --danger:     #b05656;
  --danger-dim: rgba(176,86,86,0.1);
  --running:    #6fcf97;
  --running-dim: rgba(111,207,151,0.08);

  --font-serif: 'DM Serif Display', Georgia, serif;
  --font-sans:  'DM Sans', system-ui, -apple-system, sans-serif;
  --font-mono:  'IBM Plex Mono', 'SF Mono', monospace;

  --radius:    3px;
  --radius-md: 6px;
  --t: 130ms ease;
}

/* ─── Reset ─────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
  min-height: 100vh;
}

/* Grain overlay */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 9999;
}

#app { min-height: 100vh; }

a { color: inherit; text-decoration: none; }
button { font-family: var(--font-sans); cursor: pointer; border: none; outline: none; }
ul, ol { list-style: none; }

/* ─── Layout Shell ───────────────────────────────── */
.page {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 40px;
  min-height: 100vh;
  animation: pageIn 280ms ease both;
}

@keyframes pageIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ─── Topbar ─────────────────────────────────────── */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  border-bottom: 1px solid var(--border-subtle);
}

.topbar-brand {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.topbar-back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-2);
  letter-spacing: 0.06em;
  transition: color var(--t);
}
.topbar-back:hover { color: var(--text); }

/* ─── Buttons ────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 18px;
  height: 34px;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.06em;
  border-radius: var(--radius);
  transition: all var(--t);
}

.btn-primary {
  background: var(--accent);
  color: #0c0c0c;
  font-weight: 500;
}
.btn-primary:hover { background: #d6b87a; }
.btn-primary:active { transform: scale(0.97); }

.btn-ghost {
  background: transparent;
  color: var(--text-2);
  border: 1px solid var(--border);
}
.btn-ghost:hover { color: var(--text); border-color: var(--text-3); }

.btn-danger {
  background: transparent;
  color: var(--danger);
  border: 1px solid rgba(176,86,86,0.25);
}
.btn-danger:hover { background: var(--danger-dim); }

.btn:disabled {
  opacity: 0.28;
  cursor: not-allowed;
  transform: none !important;
}

/* ─── Form Fields ────────────────────────────────── */
.field { display: flex; flex-direction: column; gap: 9px; }

.field label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-2);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.field input,
.field select {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  padding: 8px 0;
  width: 100%;
  outline: none;
  transition: border-color var(--t);
  appearance: none;
}
.field input:focus,
.field select:focus { border-bottom-color: var(--accent); }

.field input[type="datetime-local"] {
  font-family: var(--font-mono);
  font-size: 12px;
  color-scheme: dark;
}

/* ─── Status Dot ─────────────────────────────────── */
.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.dot.running {
  background: var(--running);
  box-shadow: 0 0 7px var(--running);
  animation: pulse 2.2s ease infinite;
}
.dot.stopped { background: var(--text-3); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}

/* ─── Divider ────────────────────────────────────── */
.divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 36px 0;
}

/* ─── Modal ──────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 24px;
  animation: fadeIn 140ms ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.modal-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  width: 100%;
  max-width: 420px;
  padding: 32px;
  animation: slideUp 180ms ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}

.modal-title {
  font-size: 15px;
  font-weight: 400;
  color: var(--text);
  letter-spacing: 0.01em;
}

.modal-close {
  background: none;
  color: var(--text-2);
  font-size: 18px;
  line-height: 1;
  padding: 4px;
  transition: color var(--t);
}
.modal-close:hover { color: var(--text); }

.modal-section {
  padding: 20px 0;
  border-bottom: 1px solid var(--border-subtle);
}
.modal-section:last-of-type { border-bottom: none; }

.modal-section-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-2);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: 14px;
  display: block;
}

.modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 24px;
}

/* ─── Scrollbar ──────────────────────────────────── */
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* ─── Select option dark ─────────────────────────── */
select option { background: #1b1b1b; color: var(--text); }
</style>
