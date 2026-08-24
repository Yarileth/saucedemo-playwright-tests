/**
 * Lectura y agregación del results.json de Playwright.
 * Separado del render para que la lógica de datos sea testeable por su cuenta.
 */

/** Estado normalizado a partir del outcome del test. */
export function normalizeStatus(outcome) {
  switch (outcome) {
    case 'expected': return 'passed';
    case 'unexpected': return 'failed';
    case 'flaky': return 'flaky';
    case 'skipped': return 'skipped';
    default: return outcome ?? 'unknown';
  }
}

export function extractCaseId(title) {
  const m = title.match(/\b((?:BN|TC)-\d+)\b/);
  return m ? m[1] : '';
}

export function stripCaseId(title) {
  return title.replace(/^\s*(?:BN|TC)-\d+\s*[-–—]\s*/, '').trim();
}

/** Playwright escribe los errores con códigos ANSI de terminal; en HTML son basura. */
export function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return String(text ?? '').replace(/\u001b\[[0-9;]*m/g, '');
}

export function groupOf(file) {
  if (file.includes('business')) return 'Negocio';
  if (file.includes('technical')) return 'Técnico';
  return 'Otros';
}

/**
 * Matriz de riesgos del plan de pruebas (docs/plan-de-pruebas.md, sección 2).
 * Vive acá porque results.json no conoce el análisis de riesgo: este mapa es
 * el puente entre lo que se ejecutó y por qué se diseñó cada caso.
 */
export const RISKS = [
  { id: 'R1',  desc: 'Un usuario no puede completar una compra',     impact: 'Crítico', cases: ['BN-01', 'BN-02', 'BN-03'] },
  { id: 'R2',  desc: 'Los totales del checkout se calculan mal',     impact: 'Crítico', cases: ['TC-23', 'TC-24'] },
  { id: 'R3',  desc: 'Rutas internas accesibles sin sesión',         impact: 'Alto',    cases: ['TC-10', 'TC-11'] },
  { id: 'R4',  desc: 'Login inseguro o enumeración de usuarios',     impact: 'Alto',    cases: ['TC-02', 'TC-03', 'TC-04', 'TC-05', 'TC-06', 'TC-07'] },
  { id: 'R5',  desc: 'El carrito pierde o duplica productos',        impact: 'Alto',    cases: ['TC-19', 'TC-20', 'BN-06'] },
  { id: 'R6',  desc: 'Catálogo con productos o precios incorrectos', impact: 'Alto',    cases: ['TC-12', 'TC-13'] },
  { id: 'R7',  desc: 'El ordenamiento del listado no funciona',      impact: 'Medio',   cases: ['TC-14', 'TC-15', 'TC-16', 'TC-17'] },
  { id: 'R8',  desc: 'Imágenes que no corresponden al producto',     impact: 'Medio',   cases: ['TC-26', 'TC-27'] },
  { id: 'R9',  desc: 'Degradación de performance del catálogo',      impact: 'Medio',   cases: ['TC-09'] },
  { id: 'R10', desc: 'El usuario no puede corregir su carrito',      impact: 'Medio',   cases: ['BN-04', 'BN-05', 'BN-07', 'TC-22', 'TC-25'] },
];

export const STATUS_ORDER = ['passed', 'flaky', 'failed', 'skipped'];

export const STATUS_LABEL = {
  passed: 'Pasaron',
  flaky: 'Inestables',
  failed: 'Fallaron',
  skipped: 'Omitidos',
};

/** Aplana el árbol de suites a una lista de casos con todo lo que el reporte necesita. */
export function flattenCases(report) {
  const cases = [];

  function walk(suite, ancestry) {
    const trail = suite.title ? [...ancestry, suite.title] : ancestry;

    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        const status = normalizeStatus(test.status);
        const duration = results.reduce((a, r) => a + (r.duration ?? 0), 0);
        const failing = results.find((r) => r.error || r.errors?.length);
        const last = results[results.length - 1];

        cases.push({
          caseId: extractCaseId(spec.title),
          title: stripCaseId(spec.title),
          suite: trail.filter((t) => !t.endsWith('.ts')).join(' › '),
          file: spec.file ?? suite.file ?? '',
          status,
          duration,
          retries: Math.max(0, results.length - 1),
          error: stripAnsi(failing?.error?.message ?? failing?.errors?.[0]?.message ?? ''),
          worker: last?.workerIndex ?? 0,
          startTime: results[0]?.startTime ? new Date(results[0].startTime).getTime() : null,
          endTime:
            last?.startTime != null
              ? new Date(last.startTime).getTime() + (last.duration ?? 0)
              : null,
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, trail);
  }

  for (const suite of report.suites ?? []) walk(suite, []);
  return cases;
}

/** Construye todas las agregaciones que consume el render. */
export function buildModel(report, cases) {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
  for (const c of cases) counts[c.status] = (counts[c.status] ?? 0) + 1;

  const total = cases.length;
  const executed = total - counts.skipped;
  // Un test flaky terminó pasando tras el reintento: cuenta como exitoso para
  // la tasa, pero se reporta aparte porque es una señal de alerta.
  const successful = counts.passed + counts.flaky;
  const passRate = executed > 0 ? (successful / executed) * 100 : 0;

  const byFile = new Map();
  for (const c of cases) {
    const key = c.file || '(sin archivo)';
    const e = byFile.get(key) ?? { file: key, duration: 0, tests: 0, failed: 0 };
    e.duration += c.duration;
    e.tests += 1;
    if (c.status === 'failed') e.failed += 1;
    byFile.set(key, e);
  }

  const byGroup = new Map();
  for (const c of cases) {
    const key = groupOf(c.file);
    const e =
      byGroup.get(key) ??
      { group: key, ...Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])), total: 0 };
    e[c.status] += 1;
    e.total += 1;
    byGroup.set(key, e);
  }

  // Índice caso -> peor estado, para la matriz de trazabilidad.
  const rank = { failed: 3, flaky: 2, skipped: 1, passed: 0 };
  const byCaseId = new Map();
  for (const c of cases) {
    if (!c.caseId) continue;
    const prev = byCaseId.get(c.caseId);
    if (!prev || rank[c.status] > rank[prev.status]) byCaseId.set(c.caseId, c);
  }

  const risks = RISKS.map((r) => {
    const found = r.cases.map((id) => ({ id, case: byCaseId.get(id) ?? null }));
    const covered = found.filter((f) => f.case);
    const failed = covered.filter((f) => f.case.status === 'failed').length;
    const flaky = covered.filter((f) => f.case.status === 'flaky').length;
    const skipped = covered.filter((f) => f.case.status === 'skipped').length;
    const state = failed
      ? 'failed'
      : flaky
        ? 'flaky'
        : covered.length === 0
          ? 'skipped'
          : 'passed';
    return { ...r, found, coveredCount: covered.length, failed, flaky, skipped, state };
  });

  const runStart = report.stats?.startTime ? new Date(report.stats.startTime).getTime() : null;
  const runDuration = report.stats?.duration ?? cases.reduce((a, c) => a + c.duration, 0);

  return {
    cases,
    counts,
    total,
    executed,
    successful,
    passRate,
    fileStats: [...byFile.values()].sort((a, b) => b.duration - a.duration),
    groupStats: [...byGroup.values()].sort((a, b) => b.total - a.total),
    risks,
    failedCases: cases.filter((c) => c.status === 'failed'),
    flakyCases: cases.filter((c) => c.status === 'flaky'),
    slowest: [...cases].sort((a, b) => b.duration - a.duration).slice(0, 8),
    runStart,
    runDuration,
    workers: [...new Set(cases.map((c) => c.worker))].sort((a, b) => a - b),
  };
}
