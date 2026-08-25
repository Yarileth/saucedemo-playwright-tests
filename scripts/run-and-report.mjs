#!/usr/bin/env node
/**
 * Corre la suite y genera el reporte con gráficas, SIEMPRE.
 *
 * Por qué existe: `npm test && npm run dashboard` no sirve. Playwright
 * devuelve un código de salida distinto de cero cuando algún test falla, así
 * que el `&&` corta la cadena y el reporte no se genera justo en la corrida
 * que más falta hace mirarlo. Lo mismo pasa con las tareas encadenadas de
 * VS Code (`dependsOrder: sequence`), que se detienen ante un fallo.
 *
 * Este script ejecuta los dos pasos por separado, genera el reporte pase lo
 * que pase, y al final propaga el código de salida real de los tests para que
 * un pipeline de CI siga marcando la corrida como fallida si corresponde.
 */
import { spawnSync } from 'node:child_process';

/** `npx` en Windows es un .cmd, así que necesita shell. */
const isWindows = process.platform === 'win32';

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: isWindows,
  });
  if (result.error) {
    console.error(`\n[run] No se pudo ejecutar "${command}": ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

console.log('\n=== Ejecutando la suite ===\n');
// Los argumentos extra se pasan a Playwright: `npm run test:report -- --grep @smoke`
const extraArgs = process.argv.slice(2);
const testExit = run('npx', ['playwright', 'test', ...extraArgs]);

console.log('\n=== Generando el reporte con gráficas ===\n');
const reportExit = run('node', ['scripts/generate-dashboard.mjs']);

if (reportExit !== 0) {
  console.error('\n[run] La suite corrió, pero el reporte no se pudo generar.');
  process.exit(reportExit);
}

if (testExit === 0) {
  console.log('\n✓ Todos los tests pasaron. Reporte en test-results/dashboard.html\n');
} else {
  console.log('\n✗ Hubo tests que fallaron. El detalle está en test-results/dashboard.html');
  console.log('  Para el trace navegable, video y screenshot: npm run report\n');
}

// Se propaga el resultado real de los tests: CI tiene que ver el fallo.
process.exit(testExit);
