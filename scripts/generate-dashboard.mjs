#!/usr/bin/env node
/**
 * Genera un dashboard HTML con gráficas a partir del results.json que produce
 * el reporter JSON de Playwright.
 *
 * El reporte HTML nativo de Playwright es excelente para DEPURAR un fallo
 * (trace, video, screenshot), pero no tiene gráficas ni una vista de resumen
 * ejecutivo. Este script cubre eso: una página autocontenida, sin dependencias,
 * pensada para compartir con alguien que no va a abrir un trace.
 *
 * Uso:  node scripts/generate-dashboard.mjs [entrada.json] [salida.html]
 * Default: test-results/results.json -> test-results/dashboard.html
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';

const inputPath = process.argv[2] ?? 'test-results/results.json';
const outputPath = process.argv[3] ?? 'test-results/dashboard.html';

let report;
try {
  report = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (err) {
  console.error(`\n[dashboard] No pude leer "${inputPath}".`);
  console.error('[dashboard] Corré primero: npm test\n');
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * 1. Aplanar el árbol de suites de Playwright a una lista de casos
 * ------------------------------------------------------------------ */

/** Estado normalizado a partir del `status` (outcome) del test. */
function normalizeStatus(outcome) {
  switch (outcome) {
    case 'expected':
      return 'passed';
    case 'unexpected':
      return 'failed';
    case 'flaky':
      return 'flaky';
    case 'skipped':
      return 'skipped';
    default:
      return outcome ?? 'unknown';
  }
}

/** Extrae el ID de caso (BN-01 / TC-23) del título, si lo tiene. */
function extractCaseId(title) {
  const match = title.match(/\b((?:BN|TC)-\d+)\b/);
  return match ? match[1] : '';
}

/**
 * Quita el prefijo "TC-01 - " del título, porque el ID ya se muestra en su
 * propia columna y repetirlo duplica información en cada fila.
 */
function stripCaseId(title) {
  return title.replace(/^\s*(?:BN|TC)-\d+\s*[-–—]\s*/, '').trim();
}

/**
 * Playwright escribe los mensajes de error con códigos de color ANSI (pensados
 * para la terminal). En HTML se verían como basura tipo "[22m", así que los
 * removemos.
 */
function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return String(text ?? '').replace(/\u001b\[[0-9;]*m/g, '');
}

const cases = [];

function walkSuite(suite, ancestry) {
  const trail = suite.title ? [...ancestry, suite.title] : ancestry;

  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const status = normalizeStatus(test.status);
      const duration = (test.results ?? []).reduce((acc, r) => acc + (r.duration ?? 0), 0);
      const failing = (test.results ?? []).find((r) => r.error || r.errors?.length);

      cases.push({
        caseId: extractCaseId(spec.title),
        title: stripCaseId(spec.title),
        suite: trail.filter((t) => !t.endsWith('.ts')).join(' › '),
        file: spec.file ?? suite.file ?? '',
        status,
        duration,
        retries: Math.max(0, (test.results ?? []).length - 1),
        error: stripAnsi(failing?.error?.message ?? failing?.errors?.[0]?.message ?? ''),
      });
    }
  }

  for (const child of suite.suites ?? []) walkSuite(child, trail);
}

for (const suite of report.suites ?? []) walkSuite(suite, []);

if (cases.length === 0) {
  console.error('[dashboard] El results.json no contiene casos. ¿La corrida se interrumpió?');
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * 2. Agregaciones
 * ------------------------------------------------------------------ */

const STATUS_ORDER = ['passed', 'flaky', 'failed', 'skipped'];
const STATUS_LABEL = {
  passed: 'Pasaron',
  flaky: 'Inestables',
  failed: 'Fallaron',
  skipped: 'Omitidos',
};

const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
for (const c of cases) counts[c.status] = (counts[c.status] ?? 0) + 1;

const total = cases.length;
const executed = total - counts.skipped;
// Un test "flaky" terminó pasando (tras reintento), así que cuenta como pasado
// para la tasa de éxito, pero se muestra aparte porque es una señal de alerta.
const successful = counts.passed + counts.flaky;
const passRate = executed > 0 ? (successful / executed) * 100 : 0;

const totalDuration = report.stats?.duration ?? cases.reduce((a, c) => a + c.duration, 0);

/** Duración agregada por archivo de spec. */
const byFile = new Map();
for (const c of cases) {
  const key = c.file || '(sin archivo)';
  const entry = byFile.get(key) ?? { file: key, duration: 0, tests: 0, failed: 0 };
  entry.duration += c.duration;
  entry.tests += 1;
  if (c.status === 'failed') entry.failed += 1;
  byFile.set(key, entry);
}
const fileStats = [...byFile.values()].sort((a, b) => b.duration - a.duration);

/** Agrupación por tipo de escenario, según la carpeta del spec. */
function groupOf(file) {
  if (file.includes('business')) return 'Negocio';
  if (file.includes('technical')) return 'Técnico';
  return 'Otros';
}
const byGroup = new Map();
for (const c of cases) {
  const key = groupOf(c.file);
  const entry = byGroup.get(key) ?? { group: key, ...Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])), total: 0 };
  entry[c.status] += 1;
  entry.total += 1;
  byGroup.set(key, entry);
}
const groupStats = [...byGroup.values()].sort((a, b) => b.total - a.total);

const failedCases = cases.filter((c) => c.status === 'failed');
const flakyCases = cases.filter((c) => c.status === 'flaky');
const slowest = [...cases].sort((a, b) => b.duration - a.duration).slice(0, 8);

/* ------------------------------------------------------------------ *
 * 3. Helpers de formato
 * ------------------------------------------------------------------ */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function fmtDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m} min ${String(s).padStart(2, '0')} s`;
}

const startedAt = report.stats?.startTime ? new Date(report.stats.startTime) : new Date();
const startedLabel = startedAt.toLocaleString('es-AR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
});

/* ------------------------------------------------------------------ *
 * 4. Render
 * ------------------------------------------------------------------ */

// Barra apilada de parte-a-todo (estado de la corrida).
const stackSegments = STATUS_ORDER.filter((s) => counts[s] > 0)
  .map((s) => {
    const pct = (counts[s] / total) * 100;
    return `<div class="seg seg--${s}" style="flex-basis:${pct.toFixed(3)}%" title="${STATUS_LABEL[s]}: ${counts[s]}"></div>`;
  })
  .join('');

const legendItems = STATUS_ORDER.map(
  (s) => `<div class="legend__item${counts[s] === 0 ? ' legend__item--empty' : ''}">
      <span class="swatch swatch--${s}" aria-hidden="true"></span>
      <span class="legend__label">${STATUS_LABEL[s]}</span>
      <span class="legend__value">${counts[s]}</span>
    </div>`
).join('');

// Barras horizontales de duración por archivo (una sola hue = magnitud).
const maxFileDuration = Math.max(...fileStats.map((f) => f.duration), 1);
const fileBars = fileStats
  .map((f) => {
    const pct = (f.duration / maxFileDuration) * 100;
    return `<div class="hbar">
      <div class="hbar__label" title="${esc(f.file)}">${esc(basename(f.file))}</div>
      <div class="hbar__track"><div class="hbar__fill" style="width:${Math.max(pct, 1.2).toFixed(2)}%"></div></div>
      <div class="hbar__value">${fmtDuration(f.duration)}<span class="hbar__sub">${f.tests} test${f.tests === 1 ? '' : 's'}</span></div>
    </div>`;
  })
  .join('');

// Barras apiladas por grupo (Técnico / Negocio).
const groupBars = groupStats
  .map((g) => {
    const segs = STATUS_ORDER.filter((s) => g[s] > 0)
      .map(
        (s) =>
          `<div class="seg seg--${s}" style="flex-basis:${((g[s] / g.total) * 100).toFixed(3)}%" title="${STATUS_LABEL[s]}: ${g[s]}"></div>`
      )
      .join('');
    return `<div class="hbar">
      <div class="hbar__label">${esc(g.group)}</div>
      <div class="hbar__track"><div class="stack stack--inline">${segs}</div></div>
      <div class="hbar__value">${g.total}<span class="hbar__sub">${g.passed + g.flaky}/${g.total} ok</span></div>
    </div>`;
  })
  .join('');

const slowestRows = slowest
  .map(
    (c) => `<tr>
      <td class="cell-id">${esc(c.caseId)}</td>
      <td>${esc(c.title)}</td>
      <td class="cell-num">${fmtDuration(c.duration)}</td>
    </tr>`
  )
  .join('');

function renderIssue(c, kind) {
  return `<details class="failure">
        <summary><span class="swatch swatch--${kind}" aria-hidden="true"></span>
          <strong>${esc(c.caseId || '—')}</strong> ${esc(c.title)}</summary>
        <div class="failure__meta">${esc(c.suite)} · ${esc(basename(c.file))} · ${fmtDuration(c.duration)}${c.retries ? ` · ${c.retries} reintento${c.retries === 1 ? '' : 's'}` : ''}</div>
        <pre class="failure__error">${esc(c.error || 'Sin detalle de error en el JSON. Abrí el reporte HTML para ver el trace.')}</pre>
      </details>`;
}

const failureBlocks = failedCases.length
  ? failedCases.map((c) => renderIssue(c, 'failed')).join('')
  : `<p class="empty">Ningún caso falló en esta corrida.</p>`;

const flakyBlocks = flakyCases.length
  ? `<p class="note">Estos casos fallaron en el primer intento y pasaron al reintentar. Cuentan como exitosos, pero un test inestable esconde un problema real: o el sitio, o una espera mal puesta en la prueba.</p>` +
    flakyCases.map((c) => renderIssue(c, 'flaky')).join('')
  : `<p class="empty">Ningún caso resultó inestable en esta corrida.</p>`;

const allRows = cases
  .map(
    (c) => `<tr data-status="${c.status}">
      <td class="cell-id">${esc(c.caseId)}</td>
      <td>${esc(c.title)}</td>
      <td>${esc(groupOf(c.file))}</td>
      <td><span class="tag tag--${c.status}"><span class="swatch swatch--${c.status}" aria-hidden="true"></span>${STATUS_LABEL[c.status]}</span></td>
      <td class="cell-num">${fmtDuration(c.duration)}</td>
    </tr>`
  )
  .join('');

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resultados E2E — SauceDemo</title>
<style>
  :root {
    color-scheme: light;
    --surface-0: #f4f3f0;
    --surface-1: #fcfcfb;
    --border:    #e0dfda;
    --text-primary:   #0b0b0b;
    --text-secondary: #52514e;
    --text-muted:     #77756e;
    --accent:  #2a78d6;
    --track:   #eceae5;
    --passed:  #0ca30c;
    --flaky:   #fab219;
    --failed:  #d03b3b;
    --skipped: #a8a69d;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --surface-0: #121211;
      --surface-1: #1a1a19;
      --border:    #33332f;
      --text-primary:   #ffffff;
      --text-secondary: #c3c2b7;
      --text-muted:     #8f8e84;
      --accent:  #3987e5;
      --track:   #2a2a27;
      --skipped: #6b6a62;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --surface-0: #121211;
    --surface-1: #1a1a19;
    --border:    #33332f;
    --text-primary:   #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted:     #8f8e84;
    --accent:  #3987e5;
    --track:   #2a2a27;
    --skipped: #6b6a62;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--surface-0);
    color: var(--text-primary);
    font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 40px 24px 72px; }

  header { margin-bottom: 32px; }
  h1 { font-size: 24px; font-weight: 640; letter-spacing: -0.015em; margin: 0 0 6px; }
  .subtitle { color: var(--text-secondary); font-size: 14px; margin: 0; }

  .card {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
  }
  .card > h2 {
    font-size: 12px; font-weight: 620; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--text-muted); margin: 0 0 20px;
  }

  /* Hero + KPI */
  .hero-row { display: flex; flex-wrap: wrap; gap: 32px; align-items: flex-start; }
  .hero { min-width: 190px; }
  .hero__value { font-size: 60px; line-height: 1; font-weight: 620; letter-spacing: -0.03em; }
  .hero__label { color: var(--text-secondary); font-size: 13px; margin-top: 8px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(104px, 1fr)); gap: 12px 24px; flex: 1 1 380px; }
  .kpi__value { font-size: 25px; font-weight: 600; letter-spacing: -0.02em; }
  .kpi__label { color: var(--text-secondary); font-size: 12.5px; margin-top: 2px; }

  /* Barra apilada */
  .stack { display: flex; width: 100%; height: 100%; gap: 2px; }
  .stack--main { height: 14px; border-radius: 4px; overflow: hidden; margin-bottom: 18px; }
  .stack--inline { border-radius: 3px; overflow: hidden; }
  .seg { min-width: 2px; }
  .seg--passed  { background: var(--passed); }
  .seg--flaky   { background: var(--flaky); }
  .seg--failed  { background: var(--failed); }
  .seg--skipped { background: var(--skipped); }

  .legend { display: flex; flex-wrap: wrap; gap: 8px 26px; }
  .legend__item { display: flex; align-items: center; gap: 8px; font-size: 13.5px; }
  .legend__item--empty { opacity: 0.45; }
  .legend__label { color: var(--text-secondary); }
  .legend__value { font-variant-numeric: tabular-nums; font-weight: 580; }

  .swatch { width: 9px; height: 9px; border-radius: 2px; flex: none; display: inline-block; }
  .swatch--passed  { background: var(--passed); }
  .swatch--flaky   { background: var(--flaky); }
  .swatch--failed  { background: var(--failed); }
  .swatch--skipped { background: var(--skipped); }

  /* Barras horizontales */
  .hbar { display: grid; grid-template-columns: minmax(120px, 210px) 1fr minmax(88px, auto); gap: 16px; align-items: center; margin-bottom: 11px; }
  .hbar:last-child { margin-bottom: 0; }
  .hbar__label { font-size: 13.5px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hbar__track { background: var(--track); border-radius: 4px; height: 11px; overflow: hidden; }
  .hbar__fill { background: var(--accent); height: 100%; border-radius: 4px; }
  .hbar__value { font-size: 13px; font-variant-numeric: tabular-nums; text-align: right; }
  .hbar__sub { display: block; color: var(--text-muted); font-size: 11.5px; }

  /* Tablas */
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th { text-align: left; font-weight: 580; color: var(--text-muted); font-size: 11.5px; letter-spacing: 0.05em; text-transform: uppercase; padding: 0 12px 10px 0; border-bottom: 1px solid var(--border); }
  td { padding: 9px 12px 9px 0; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .cell-id { font-variant-numeric: tabular-nums; color: var(--text-muted); white-space: nowrap; font-size: 12.5px; }
  .cell-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .table-scroll { overflow-x: auto; }
  .tag { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }

  /* Fallos */
  .failure { border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; }
  .failure summary { cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13.5px; }
  .failure__meta { color: var(--text-muted); font-size: 12px; margin: 10px 0 8px; }
  .failure__error { background: var(--surface-0); border: 1px solid var(--border); border-radius: 6px; padding: 12px; font-size: 12px; overflow-x: auto; margin: 0; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .empty { color: var(--text-secondary); font-size: 14px; margin: 0; }
  .note { color: var(--text-secondary); font-size: 13px; margin: 0 0 14px; max-width: 68ch; }

  footer { color: var(--text-muted); font-size: 12.5px; margin-top: 28px; }
  @media (max-width: 620px) {
    .hbar { grid-template-columns: 1fr; gap: 4px; }
    .hbar__value { text-align: left; }
    .hero__value { font-size: 48px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Resultados de la suite E2E — SauceDemo</h1>
    <p class="subtitle">Corrida del ${esc(startedLabel)} · duración total ${fmtDuration(totalDuration)}</p>
  </header>

  <section class="card">
    <div class="hero-row">
      <div class="hero">
        <div class="hero__value" style="color:${failedCases.length ? 'var(--failed)' : 'var(--passed)'}">${passRate.toFixed(1)}%</div>
        <div class="hero__label">de los tests ejecutados pasaron</div>
      </div>
      <div class="kpis">
        <div><div class="kpi__value">${total}</div><div class="kpi__label">Tests</div></div>
        <div><div class="kpi__value">${counts.passed}</div><div class="kpi__label">Pasaron</div></div>
        <div><div class="kpi__value">${counts.failed}</div><div class="kpi__label">Fallaron</div></div>
        <div><div class="kpi__value">${counts.flaky}</div><div class="kpi__label">Inestables</div></div>
        <div><div class="kpi__value">${counts.skipped}</div><div class="kpi__label">Omitidos</div></div>
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Distribución de resultados</h2>
    <div class="stack stack--main">${stackSegments}</div>
    <div class="legend">${legendItems}</div>
  </section>

  <section class="card">
    <h2>Resultados por tipo de escenario</h2>
    ${groupBars}
  </section>

  <section class="card">
    <h2>Duración por archivo de pruebas</h2>
    ${fileBars}
  </section>

  <section class="card">
    <h2>Casos que fallaron</h2>
    ${failureBlocks}
  </section>

  <section class="card">
    <h2>Casos inestables (flaky)</h2>
    ${flakyBlocks}
  </section>

  <section class="card">
    <h2>Los 8 casos más lentos</h2>
    <div class="table-scroll">
      <table>
        <thead><tr><th>ID</th><th>Caso</th><th style="text-align:right">Duración</th></tr></thead>
        <tbody>${slowestRows}</tbody>
      </table>
    </div>
  </section>

  <section class="card">
    <h2>Detalle completo (${total} tests)</h2>
    <div class="table-scroll">
      <table>
        <thead><tr><th>ID</th><th>Caso</th><th>Tipo</th><th>Estado</th><th style="text-align:right">Duración</th></tr></thead>
        <tbody>${allRows}</tbody>
      </table>
    </div>
  </section>

  <footer>
    Generado desde <code>${esc(inputPath)}</code>. Para depurar un fallo con trace, video y screenshot, usá el reporte nativo: <code>npm run report</code>.
  </footer>
</div>
</body>
</html>`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, 'utf8');

console.log(`[dashboard] ${total} tests · ${counts.passed} pasaron · ${counts.failed} fallaron · ${counts.flaky} inestables · ${counts.skipped} omitidos`);
console.log(`[dashboard] Tasa de éxito: ${passRate.toFixed(1)}%`);
console.log(`[dashboard] Generado: ${outputPath}`);
