#!/usr/bin/env node
/**
 * Genera un reporte HTML con gráficas a partir del results.json de Playwright.
 *
 * Por qué existe: el reporte HTML nativo de Playwright es excelente para
 * DEPURAR un fallo (trace, video, screenshot), pero no tiene gráficas ni una
 * vista de resumen. Este reporte cubre lo otro: el estado de la corrida de un
 * vistazo, para compartir con alguien que no va a abrir un trace.
 *
 * Todas las gráficas son SVG. Es una decisión, no un detalle: los navegadores
 * NO imprimen `background-color` por defecto, así que un gráfico hecho con
 * divs de fondo desaparece al exportar a PDF. El `fill` de un <rect> es
 * contenido y siempre se imprime.
 *
 * Uso:  node scripts/generate-dashboard.mjs [entrada.json] [salida.html]
 * Default: test-results/results.json -> test-results/dashboard.html
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';
import { flattenCases, buildModel, STATUS_ORDER, STATUS_LABEL, groupOf } from './lib/data.mjs';
import {
  esc,
  fmtDuration,
  stackedBar,
  magnitudeBar,
  statusChip,
  gauge,
  timeline,
  riskMatrix,
} from './lib/render.mjs';

const inputPath = process.argv[2] ?? 'test-results/results.json';
const outputPath = process.argv[3] ?? 'test-results/dashboard.html';

let report;
try {
  report = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch {
  console.error(`\n[reporte] No pude leer "${inputPath}".`);
  console.error('[reporte] Corré primero: npm test\n');
  process.exit(1);
}

const cases = flattenCases(report);
if (cases.length === 0) {
  console.error('[reporte] El results.json no contiene casos. ¿La corrida se interrumpió?');
  process.exit(1);
}

const m = buildModel(report, cases);
const ok = m.failedCases.length === 0;

const startedAt = m.runStart ? new Date(m.runStart) : new Date();
const startedLabel = startedAt.toLocaleString('es-AR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
});

/* ------------------------------------------------------------------ *
 * Bloques
 * ------------------------------------------------------------------ */

const statusSegments = STATUS_ORDER.filter((s) => m.counts[s] > 0).map((s) => ({
  status: s,
  label: STATUS_LABEL[s],
  value: m.counts[s],
}));

const legend = STATUS_ORDER.map(
  (s) => `<div class="legend__item${m.counts[s] === 0 ? ' is-empty' : ''}">
      ${statusChip(s)}
      <span class="legend__value">${m.counts[s]}</span>
    </div>`
).join('');

const maxFileDuration = Math.max(...m.fileStats.map((f) => f.duration), 1);
const fileBars = m.fileStats
  .map(
    (f) => `<div class="row">
      <div class="row__label" title="${esc(f.file)}">${esc(basename(f.file))}</div>
      <div class="row__plot">${magnitudeBar(f.duration / maxFileDuration, 14, `${basename(f.file)}: ${fmtDuration(f.duration)}`)}</div>
      <div class="row__value">${fmtDuration(f.duration)}<span class="row__sub">${f.tests} test${f.tests === 1 ? '' : 's'}</span></div>
    </div>`
  )
  .join('');

const groupBars = m.groupStats
  .map((g) => {
    const segs = STATUS_ORDER.filter((s) => g[s] > 0).map((s) => ({
      status: s,
      label: STATUS_LABEL[s],
      value: g[s],
    }));
    return `<div class="row">
      <div class="row__label">${esc(g.group)}</div>
      <div class="row__plot">${stackedBar(segs)}</div>
      <div class="row__value">${g.total}<span class="row__sub">${g.passed + g.flaky}/${g.total} ok</span></div>
    </div>`;
  })
  .join('');

const slowestRows = m.slowest
  .map(
    (c) => `<tr>
      <td class="c-id">${esc(c.caseId)}</td>
      <td>${esc(c.title)}</td>
      <td class="c-num">${fmtDuration(c.duration)}</td>
    </tr>`
  )
  .join('');

function issueBlock(c, kind) {
  return `<details class="issue" ${kind === 'failed' ? 'open' : ''}>
      <summary>${statusChip(kind, `${c.caseId || '—'}`)}<span class="issue__title">${esc(c.title)}</span></summary>
      <div class="issue__meta">${esc(c.suite)} · ${esc(basename(c.file))} · ${fmtDuration(c.duration)}${c.retries ? ` · ${c.retries} reintento${c.retries === 1 ? '' : 's'}` : ''}</div>
      <pre class="issue__error">${esc(c.error || 'Sin detalle de error en el JSON. Abrí el reporte nativo para ver el trace.')}</pre>
    </details>`;
}

const failureBlocks = m.failedCases.length
  ? m.failedCases.map((c) => issueBlock(c, 'failed')).join('')
  : '<p class="empty">Ningún caso falló en esta corrida.</p>';

const flakyBlocks = m.flakyCases.length
  ? '<p class="note">Fallaron en el primer intento y pasaron al reintentar. Cuentan como exitosos, pero un test inestable esconde un problema real: o el sitio, o una espera mal puesta en la prueba.</p>' +
    m.flakyCases.map((c) => issueBlock(c, 'flaky')).join('')
  : '<p class="empty">Ningún caso resultó inestable en esta corrida.</p>';

const allRows = m.cases
  .map(
    (c) => `<tr>
      <td class="c-id">${esc(c.caseId)}</td>
      <td>${esc(c.title)}</td>
      <td class="c-dim">${esc(groupOf(c.file))}</td>
      <td>${statusChip(c.status)}</td>
      <td class="c-num">${fmtDuration(c.duration)}</td>
    </tr>`
  )
  .join('');

const risksCovered = m.risks.filter((r) => r.coveredCount > 0).length;
const risksHealthy = m.risks.filter((r) => r.state === 'passed').length;

/* ------------------------------------------------------------------ *
 * Documento
 * ------------------------------------------------------------------ */

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reporte E2E — SauceDemo</title>
<style>
  :root {
    color-scheme: light;
    --surface-0:#f4f3f0; --surface-1:#fcfcfb; --surface-2:#efeeea;
    --border:#e2e1dc; --border-soft:#eceae5;
    --text-1:#0b0b0b; --text-2:#52514e; --text-3:#78766f;
    --accent:#2a78d6; --track:#e7e5e0;
    --st-passed:#0ca30c; --st-flaky:#fab219; --st-failed:#d03b3b; --st-skipped:#a8a69d;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --surface-0:#111110; --surface-1:#1a1a19; --surface-2:#222220;
      --border:#33332f; --border-soft:#2a2a27;
      --text-1:#ffffff; --text-2:#c3c2b7; --text-3:#8f8e84;
      --accent:#3987e5; --track:#2c2c29;
      --st-skipped:#6b6a62;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --surface-0:#111110; --surface-1:#1a1a19; --surface-2:#222220;
    --border:#33332f; --border-soft:#2a2a27;
    --text-1:#ffffff; --text-2:#c3c2b7; --text-3:#8f8e84;
    --accent:#3987e5; --track:#2c2c29;
    --st-skipped:#6b6a62;
  }

  *{box-sizing:border-box}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{
    margin:0;background:var(--surface-0);color:var(--text-1);
    font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:1120px;margin:0 auto;padding:40px 24px 72px}

  header{margin-bottom:26px;display:flex;flex-wrap:wrap;gap:14px;align-items:baseline;justify-content:space-between}
  h1{font-size:23px;font-weight:640;letter-spacing:-.015em;margin:0 0 5px}
  .sub{color:var(--text-2);font-size:13.5px;margin:0}
  .verdict{
    display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:580;
    padding:6px 13px;border-radius:999px;border:1px solid var(--border);background:var(--surface-1);
  }

  .card{background:var(--surface-1);border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:18px}
  .card>h2{font-size:11.5px;font-weight:620;letter-spacing:.07em;text-transform:uppercase;color:var(--text-3);margin:0 0 6px}
  .card>.hint{font-size:13px;color:var(--text-2);margin:0 0 20px;max-width:74ch}
  .card>h2+*:not(.hint){margin-top:20px}

  /* Resumen */
  .summary{display:flex;flex-wrap:wrap;gap:34px;align-items:center}
  .gauge__value{font-size:31px;font-weight:640;fill:var(--text-1);letter-spacing:-.02em}
  .gauge__caption{font-size:11.5px;fill:var(--text-3)}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:16px 22px;flex:1 1 400px}
  .kpi__v{font-size:25px;font-weight:600;letter-spacing:-.02em}
  .kpi__l{color:var(--text-2);font-size:12.5px;margin-top:1px}

  /* Marcas */
  .bar{display:block;overflow:visible}
  .legend{display:flex;flex-wrap:wrap;gap:9px 26px;margin-top:16px}
  .legend__item{display:flex;align-items:center;gap:9px;font-size:13.5px}
  .legend__item.is-empty{opacity:.42}
  .legend__value{font-variant-numeric:tabular-nums;font-weight:580}
  .chip{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;color:var(--text-2)}
  .chip svg{flex:none}

  .row{display:grid;grid-template-columns:minmax(110px,190px) 1fr minmax(84px,auto);gap:16px;align-items:center;margin-bottom:12px}
  .row:last-child{margin-bottom:0}
  .row__label{font-size:13.5px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .row__value{font-size:13px;font-variant-numeric:tabular-nums;text-align:right}
  .row__sub{display:block;color:var(--text-3);font-size:11.5px}

  /* Timeline */
  .tl-grid{stroke:var(--border-soft);stroke-width:1}
  .tl-tick{font-size:10.5px;fill:var(--text-3)}
  .tl-lane{font-size:11.5px;fill:var(--text-2)}
  .scroll-x{overflow-x:auto}

  /* Matriz de riesgo */
  .risk{padding:13px 0;border-bottom:1px solid var(--border-soft)}
  .risk:last-child{border-bottom:none}
  .risk__head{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;margin-bottom:9px}
  .risk__id{font-weight:620;font-size:13px;font-variant-numeric:tabular-nums;min-width:30px}
  .risk__desc{font-size:13.5px;color:var(--text-2);flex:1 1 260px}
  .risk__impact{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3);border:1px solid var(--border);border-radius:999px;padding:2px 9px}
  .risk__impact--crítico{color:var(--st-failed);border-color:var(--st-failed)}
  .risk__cells{display:flex;flex-wrap:wrap;gap:6px}
  .cell{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-variant-numeric:tabular-nums;
    border:1px solid var(--border);border-radius:6px;padding:3px 8px;background:var(--surface-2);color:var(--text-2)}
  .cell--absent{opacity:.5;border-style:dashed}

  /* Tablas */
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th{text-align:left;font-weight:580;color:var(--text-3);font-size:11px;letter-spacing:.05em;text-transform:uppercase;padding:0 12px 10px 0;border-bottom:1px solid var(--border)}
  td{padding:9px 12px 9px 0;border-bottom:1px solid var(--border-soft);vertical-align:top}
  tr:last-child td{border-bottom:none}
  .c-id{font-variant-numeric:tabular-nums;color:var(--text-3);white-space:nowrap;font-size:12.5px}
  .c-dim{color:var(--text-2)}
  .c-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}

  /* Fallos */
  .issue{border:1px solid var(--border);border-radius:9px;padding:12px 14px;margin-bottom:10px;background:var(--surface-2)}
  .issue summary{cursor:pointer;display:flex;align-items:center;gap:9px;font-size:13.5px;flex-wrap:wrap}
  .issue__title{color:var(--text-1)}
  .issue__meta{color:var(--text-3);font-size:12px;margin:11px 0 8px}
  .issue__error{background:var(--surface-1);border:1px solid var(--border);border-radius:7px;padding:12px;
    font-size:12px;overflow-x:auto;margin:0;white-space:pre-wrap;
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .empty{color:var(--text-2);font-size:14px;margin:0}
  .note{color:var(--text-2);font-size:13px;margin:0 0 14px;max-width:72ch}

  footer{color:var(--text-3);font-size:12.5px;margin-top:26px}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em}

  @media (max-width:640px){
    .row{grid-template-columns:1fr;gap:5px}
    .row__value{text-align:left}
  }

  /* --------------------------------------------------------------
     Impresión / exportación a PDF.
     Se fuerza la paleta clara (un PDF con fondo negro no sirve),
     se conservan los colores de las marcas y se evita que una
     tarjeta quede cortada entre dos páginas.
     -------------------------------------------------------------- */
  @media print {
    :root{
      color-scheme:light;
      --surface-0:#ffffff; --surface-1:#ffffff; --surface-2:#fafaf8;
      --border:#d8d7d2; --border-soft:#e6e5e0;
      --text-1:#000000; --text-2:#3a3936; --text-3:#63625c;
      --accent:#2a78d6; --track:#e7e5e0;
      --st-passed:#0ca30c; --st-flaky:#e09a00; --st-failed:#d03b3b; --st-skipped:#9c9a92;
    }
    body{background:#fff}
    .wrap{max-width:none;padding:0}
    .card{break-inside:avoid;page-break-inside:avoid;box-shadow:none;margin-bottom:12px}
    .issue{break-inside:avoid;page-break-inside:avoid}
    tr{break-inside:avoid;page-break-inside:avoid}
    thead{display:table-header-group}
    .issue__error{white-space:pre-wrap;word-break:break-word}
    footer{margin-top:14px}
    @page{margin:14mm}
  }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div>
      <h1>Reporte de ejecución E2E — SauceDemo</h1>
      <p class="sub">${esc(startedLabel)} · ${m.total} tests en ${fmtDuration(m.runDuration)} · ${m.workers.length} worker${m.workers.length === 1 ? '' : 's'} en paralelo</p>
    </div>
    <div class="verdict">${statusChip(ok ? 'passed' : 'failed', ok ? 'Corrida sin fallos' : `${m.failedCases.length} caso${m.failedCases.length === 1 ? '' : 's'} con fallo`)}</div>
  </header>

  <section class="card">
    <div class="summary">
      ${gauge(m.passRate, m.executed ? (m.counts.failed / m.executed) * 100 : 0)}
      <div class="kpis">
        <div><div class="kpi__v">${m.total}</div><div class="kpi__l">Tests</div></div>
        <div><div class="kpi__v">${m.counts.passed}</div><div class="kpi__l">Pasaron</div></div>
        <div><div class="kpi__v">${m.counts.failed}</div><div class="kpi__l">Fallaron</div></div>
        <div><div class="kpi__v">${m.counts.flaky}</div><div class="kpi__l">Inestables</div></div>
        <div><div class="kpi__v">${m.counts.skipped}</div><div class="kpi__l">Omitidos</div></div>
        <div><div class="kpi__v">${risksHealthy}/${m.risks.length}</div><div class="kpi__l">Riesgos sanos</div></div>
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Distribución de resultados</h2>
    <p class="hint">La tasa de éxito se calcula sobre los ${m.executed} tests efectivamente ejecutados: los omitidos no la diluyen.</p>
    ${stackedBar(statusSegments, 16)}
    <div class="legend">${legend}</div>
  </section>

  <section class="card">
    <h2>Línea de tiempo de la ejecución</h2>
    <p class="hint">Cada barra es un test ubicado en el tiempo real de la corrida, en la fila del worker que lo ejecutó. Sirve para responder por qué la corrida tardó lo que tardó: dónde hay paralelismo aprovechado, dónde huecos, y qué caso empuja el cierre.</p>
    ${timeline(m)}
  </section>

  <section class="card">
    <h2>Trazabilidad: riesgo → casos → estado</h2>
    <p class="hint">Los ${m.risks.length} riesgos del análisis del plan de pruebas, con los casos que los mitigan y cómo terminó cada uno en esta corrida. ${risksCovered} de ${m.risks.length} riesgos tienen al menos un caso ejecutado.</p>
    ${riskMatrix(m.risks)}
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
    <h2>Los ${m.slowest.length} casos más lentos</h2>
    <table>
      <thead><tr><th>ID</th><th>Caso</th><th style="text-align:right">Duración</th></tr></thead>
      <tbody>${slowestRows}</tbody>
    </table>
  </section>

  <section class="card">
    <h2>Detalle completo (${m.total} tests)</h2>
    <div class="scroll-x">
      <table>
        <thead><tr><th>ID</th><th>Caso</th><th>Tipo</th><th>Estado</th><th style="text-align:right">Duración</th></tr></thead>
        <tbody>${allRows}</tbody>
      </table>
    </div>
  </section>

  <footer>
    Generado desde <code>${esc(inputPath)}</code>. Para depurar un fallo con trace, video y screenshot: <code>npm run report</code>.
  </footer>

</div>

<script>
  /* Un <details> colapsado no imprime su contenido: al exportar a PDF se
     perdian los mensajes de error. Los abrimos justo antes de imprimir y
     los devolvemos a su estado original despues, para no alterar la
     navegacion en pantalla. */
  (function () {
    var reopened = [];
    addEventListener('beforeprint', function () {
      reopened = [];
      document.querySelectorAll('details:not([open])').forEach(function (d) {
        reopened.push(d);
        d.open = true;
      });
    });
    addEventListener('afterprint', function () {
      reopened.forEach(function (d) { d.open = false; });
      reopened = [];
    });
  })();
</script>
</body>
</html>`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, 'utf8');

console.log(
  `[reporte] ${m.total} tests · ${m.counts.passed} pasaron · ${m.counts.failed} fallaron · ` +
    `${m.counts.flaky} inestables · ${m.counts.skipped} omitidos`
);
console.log(`[reporte] Tasa de éxito: ${m.passRate.toFixed(1)}% · Riesgos sanos: ${risksHealthy}/${m.risks.length}`);
console.log(`[reporte] Generado: ${outputPath}`);
