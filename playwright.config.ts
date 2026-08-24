import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para la suite E2E de saucedemo.com.
 *
 * Decisiones de configuración relevantes:
 *  - `testIdAttribute: 'data-test'`: saucedemo.com expone atributos `data-test`
 *    estables en todos los elementos relevantes, así que usamos `getByTestId()`
 *    como estrategia de locator primaria. Es la estrategia más robusta posible:
 *    no depende de clases CSS, texto ni estructura del DOM.
 *  - Cobertura de navegador: Chromium (alcance inicial acordado). Firefox,
 *    WebKit y un proyecto mobile quedan listos, comentados, más abajo.
 *  - Reporte: HTML Reporter nativo, con trace, video y screenshot en fallos.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 7_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://www.saucedemo.com',
    testIdAttribute: 'data-test',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    // Solo se usa si PW_CHROMIUM_PATH está definida (por ejemplo, un binario
    // de Chromium ya presente en el runner de CI). Si no, Playwright usa el
    // navegador que instala `npx playwright install chromium`.
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Cobertura adicional, lista para habilitar cuando haga falta:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
