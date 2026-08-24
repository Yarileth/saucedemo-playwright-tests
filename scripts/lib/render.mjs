import { basename } from 'node:path';
import { STATUS_ORDER, STATUS_LABEL, groupOf } from './data.mjs';

/* ------------------------------------------------------------------ *
 * Helpers de formato
 * ------------------------------------------------------------------ */

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function fmtDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m} min ${String(s).padStart(2, '0')} s`;
}

const pct = (n) => `${n.toFixed(3)}%`;

/* ------------------------------------------------------------------ *
 * Marcas SVG
 *
 * TODAS las gráficas son SVG, no divs con background-color. Ese fue el
 * motivo del rediseño: los navegadores NO imprimen colores de fondo por
 * defecto, así que al exportar a PDF las barras desaparecían. El `fill` de
 * un <rect> es contenido, no fondo, y se imprime siempre.
 *
 * Los rects usan anchos en porcentaje sobre el viewport del SVG (sin
 * viewBox ni preserveAspectRatio), así no hay deformación y el `rx` en
 * píxeles se mantiene redondo.
 * ------------------------------------------------------------------ */

const BAR_H = 14;

/**
 * Barra apilada parte-a-todo.
 *
 * El separador entre segmentos se logra con un `stroke` del color de la
 * superficie: al straddlear el borde deja 1px por lado, o sea los 2px de
 * aire que pide la guía, sin necesidad de calcular offsets en píxeles
 * dentro de un espacio porcentual (que SVG no permite mezclar).
 */
export function stackedBar(segments, height = BAR_H) {
  const totalValue = segments.reduce((a, s) => a + s.value, 0);
  if (totalValue === 0) return '';

  let cum = 0;
  const rects = segments.map((seg) => {
    const w = (seg.value / totalValue) * 100;
    const rect =
      `<rect x="${pct(cum)}" y="1" width="${pct(w)}" height="${height - 2}" rx="3" ` +
      `fill="var(--st-${seg.status})" stroke="var(--surface-1)" stroke-width="2">` +
      `<title>${esc(seg.label)}: ${seg.value}</title></rect>`;
    cum += w;
    return rect;
  });

  return `<svg class="bar" width="100%" height="${height}" role="img" aria-hidden="true">${rects.join('')}</svg>`;
}

/** Barra simple de magnitud (una sola hue, secuencial). */
export function magnitudeBar(ratio, height = BAR_H, tooltip = '') {
  const w = Math.max(ratio * 100, 0.6);
  return (
    `<svg class="bar" width="100%" height="${height}" role="img" aria-hidden="true">` +
    `<rect x="0" y="0" width="100%" height="${height}" rx="3" fill="var(--track)"/>` +
    `<rect x="0" y="0" width="${pct(w)}" height="${height}" rx="3" fill="var(--accent)">` +
    (tooltip ? `<title>${esc(tooltip)}</title>` : '') +
    `</rect></svg>`
  );
}

/** Chip de estado: cuadradito SVG + texto. Nunca color solo. */
export function statusChip(status, label) {
  return (
    `<span class="chip"><svg width="9" height="9" aria-hidden="true">` +
    `<rect width="9" height="9" rx="2" fill="var(--st-${status})"/></svg>` +
    `<span>${esc(label ?? STATUS_LABEL[status] ?? status)}</span></span>`
  );
}

/**
 * Medidor de tasa de éxito: arco SVG. Es la única forma "radial" del
 * reporte y está justificada — es un ratio contra un límite conocido (100%),
 * que es exactamente el caso de uso de un meter.
 */
export function gauge(rate, failRate) {
  const size = 148;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const C = 2 * Math.PI * r;

  // Dos arcos sobre el mismo anillo: la porción de éxito en verde y la de
  // fallos reales en rojo. Pintar todo el anillo de rojo porque hubo UN
  // fallo hacía leer "93% malo", que es lo contrario de lo que dice el dato.
  const okLen = (rate / 100) * C;
  const failLen = (failRate / 100) * C;

  const arc = (len, offset, color) =>
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" ` +
    `stroke-linecap="butt" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" ` +
    `stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${c} ${c})"/>`;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img"
    aria-label="Tasa de éxito: ${rate.toFixed(1)} por ciento">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
    ${arc(okLen, 0, 'var(--st-passed)')}
    ${failLen > 0 ? arc(failLen, okLen, 'var(--st-failed)') : ''}
    <text x="${c}" y="${c - 2}" text-anchor="middle" class="gauge__value">${rate.toFixed(1)}%</text>
    <text x="${c}" y="${c + 18}" text-anchor="middle" class="gauge__caption">de éxito</text>
  </svg>`;
}

/**
 * Línea de tiempo de ejecución: cada test como una barra sobre el eje de
 * tiempo real de la corrida, agrupado por worker.
 *
 * Es la vista que el reporte nativo de Playwright no da y que responde a
 * "¿por qué la corrida tardó lo que tardó?": muestra el paralelismo real,
 * los huecos y qué test bloquea el cierre.
 */
export function timeline(model) {
  const { cases, runStart, workers } = model;
  const timed = cases.filter((c) => c.startTime != null && c.endTime != null);
  if (!timed.length || runStart == null) {
    return '<p class="empty">Esta corrida no registró marcas de tiempo por test.</p>';
  }

  const t0 = Math.min(runStart, ...timed.map((c) => c.startTime));
  const t1 = Math.max(...timed.map((c) => c.endTime));
  const span = Math.max(t1 - t0, 1);

  const laneH = 26;
  const gap = 6;
  const padL = 74;
  const padR = 16;
  const padT = 26;
  const W = 1000;
  const H = padT + workers.length * (laneH + gap) + 26;
  const plotW = W - padL - padR;
  const xOf = (t) => padL + ((t - t0) / span) * plotW;

  // Eje: una marca cada ~1/5 del recorrido, redondeada a segundos.
  const ticks = [];
  const stepMs = Math.max(1000, Math.round(span / 5 / 1000) * 1000);
  for (let t = 0; t <= span; t += stepMs) {
    ticks.push(
      `<line x1="${xOf(t0 + t).toFixed(1)}" y1="${padT - 8}" x2="${xOf(t0 + t).toFixed(1)}" y2="${H - 24}" class="tl-grid"/>` +
        `<text x="${xOf(t0 + t).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="tl-tick">${(t / 1000).toFixed(0)}s</text>`
    );
  }

  const lanes = workers.map((w, i) => {
    const y = padT + i * (laneH + gap);
    const label = `<text x="${padL - 12}" y="${y + laneH / 2 + 4}" text-anchor="end" class="tl-lane">worker ${w}</text>`;
    const bars = timed
      .filter((c) => c.worker === w)
      .map((c) => {
        const x = xOf(c.startTime);
        const width = Math.max(xOf(c.endTime) - x, 2.5);
        return (
          `<rect x="${x.toFixed(1)}" y="${y + 4}" width="${width.toFixed(1)}" height="${laneH - 8}" rx="2.5" ` +
          `fill="var(--st-${c.status})">` +
          `<title>${esc(c.caseId ? c.caseId + ' — ' : '')}${esc(c.title)}\n${fmtDuration(c.duration)} · ${STATUS_LABEL[c.status]}</title>` +
          `</rect>`
        );
      })
      .join('');
    return label + bars;
  });

  // Sin atributo height fijo: con viewBox + width 100% + height auto el SVG
  // conserva su relación de aspecto y no deja un hueco debajo al escalar.
  return `<div class="scroll-x"><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block"
      preserveAspectRatio="xMinYMin meet" role="img"
      aria-label="Línea de tiempo de ejecución por worker">
      ${ticks.join('')}
      ${lanes.join('')}
    </svg></div>`;
}

/** Matriz de trazabilidad riesgo → casos → estado. */
export function riskMatrix(risks) {
  return risks
    .map((r) => {
      const cells = r.found
        .map((f) => {
          if (!f.case) {
            return `<span class="cell cell--absent" title="${esc(f.id)}: no ejecutado en esta corrida">${esc(f.id)}</span>`;
          }
          return (
            `<span class="cell cell--${f.case.status}" title="${esc(f.id)} — ${esc(f.case.title)} (${STATUS_LABEL[f.case.status]})">` +
            `<svg width="7" height="7" aria-hidden="true"><rect width="7" height="7" rx="1.5" fill="var(--st-${f.case.status})"/></svg>` +
            `${esc(f.id)}</span>`
          );
        })
        .join('');

      return `<div class="risk">
        <div class="risk__head">
          <span class="risk__id">${esc(r.id)}</span>
          <span class="risk__desc">${esc(r.desc)}</span>
          <span class="risk__impact risk__impact--${r.impact.toLowerCase()}">${esc(r.impact)}</span>
        </div>
        <div class="risk__cells">${cells}</div>
      </div>`;
    })
    .join('');
}

export { STATUS_ORDER, STATUS_LABEL, groupOf, basename };
