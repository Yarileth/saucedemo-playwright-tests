# Automatización E2E — SauceDemo (Swag Labs)

Suite de pruebas end-to-end sobre [saucedemo.com](https://www.saucedemo.com) con **Playwright + TypeScript**, diseñada con metodología **ISTQB**: análisis de riesgo, técnicas formales de diseño de casos, y trazabilidad riesgo → caso → script.

**35 casos de prueba (41 tests ejecutables), 100% automatizados**, cubriendo los 10 riesgos identificados en el análisis.

> El plan de pruebas completo — riesgos, estrategia, técnicas aplicadas y catálogo detallado — está en **[`docs/plan-de-pruebas.md`](./docs/plan-de-pruebas.md)**.

---

## Instalación y ejecución

**En Windows, el camino corto:** doble clic en `ejecutar-pruebas.bat`. Instala lo que falte, corre los 41 tests y abre el dashboard solo. Requiere tener [Node.js](https://nodejs.org) instalado.

**A mano, en cualquier sistema:**

```bash
npm install
npx playwright install chromium

npm test                 # toda la suite
npm run test:smoke       # solo casos críticos (@smoke) — chequeo rápido
npm run test:business    # solo escenarios de negocio (BN-xx)
npm run test:technical   # solo escenarios técnicos (TC-xx)
npm run test:ui          # UI mode de Playwright (ideal para desarrollar/depurar)
npm run report           # abre el reporte nativo de Playwright (traces, videos)
npm run dashboard        # genera el dashboard con gráficas -> test-results/dashboard.html
```

---

## Qué cubre

### Escenarios de negocio (8 casos) — el recorrido del comprador

Compra completa de punta a punta (incluida la confirmación de orden), compra de múltiples productos, compra desde la ficha de detalle, y gestión del carrito (quitar ítems, vaciarlo, seguir comprando, estado post-compra). Escritos en formato **Dado / Cuando / Entonces** con `test.step()`, así el reporte HTML es legible por alguien que no lee código.

### Escenarios técnicos (27 casos → 33 tests) — validaciones y reglas

- **Autenticación:** login válido, campos vacíos, usuario bloqueado, logout, enmascarado de contraseña.
- **Seguridad:** las 5 rutas protegidas verificadas por acceso directo vía URL sin sesión; y un caso que confirma que contraseña incorrecta y usuario inexistente devuelven el **mismo** mensaje (no permite enumerar usuarios).
- **Reglas de cálculo:** el impuesto es el 8% del subtotal y el total es la suma — verificado con los valores reales del sitio.
- **Ordenamiento:** las 4 opciones del combo cubiertas como tabla de decisión.
- **Carrito:** badge, persistencia entre páginas, ciclo Add ⇄ Remove.
- **Defectos conocidos:** `problem_user` muestra la misma imagen 404 en los 6 productos — con su caso espejo sobre `standard_user` que sí pasa.

Ese último par (TC-26 / TC-27) es el que demuestra que la suite **detecta defectos de verdad**, no solo que pasa en el camino feliz.

---

## Los dos reportes

Playwright trae un reporte HTML nativo excelente **para depurar**: por cada fallo te da el trace navegable paso a paso, video y screenshot. Lo que **no** trae son gráficas ni una vista de resumen — es una lista filtrable, no un tablero.

Por eso el proyecto incluye los dos:

| | `npm run report` | `npm run dashboard` |
|---|---|---|
| **Para qué** | Depurar un fallo puntual | Ver el estado de la corrida de un vistazo |
| **Público** | Quien va a arreglar el test | Cualquiera del equipo |
| **Contiene** | Trace, video, screenshot, pasos | Tasa de éxito, distribución por estado, duración por archivo, casos lentos, tabla completa |
| **Gráficas** | No | Sí |

El dashboard se genera desde `test-results/results.json` con un script sin dependencias (`scripts/generate-dashboard.mjs`), sale como un HTML autocontenido que podés mandar por mail o subir a cualquier lado, y se adapta a tema claro y oscuro. En CI, ambos se publican como artifacts.

Además del resumen por estado, el dashboard trae dos vistas que el reporte nativo no da:

- **Línea de tiempo de la ejecución** — cada test ubicado en el tiempo real de la corrida, en la fila del worker que lo ejecutó. Responde por qué la corrida tardó lo que tardó: dónde se aprovecha el paralelismo, dónde quedan huecos y qué caso empuja el cierre.
- **Trazabilidad riesgo → casos → estado** — los 10 riesgos del análisis del plan, con los casos que los mitigan y cómo terminó cada uno. Es el puente entre "corrieron los tests" y "los riesgos del negocio están cubiertos".

### Exportar a PDF

El dashboard está pensado para imprimirse: Ctrl+P → *Guardar como PDF* y listo, **sin necesidad de tildar "Gráficos de fondo"**. Todas las gráficas son SVG, no divs con `background-color`, justamente porque los navegadores no imprimen fondos por defecto y un gráfico hecho con fondos sale en blanco. Al imprimir se fuerza la paleta clara, se evita que una tarjeta quede cortada entre dos páginas y se expanden los bloques de error colapsados para que el PDF no pierda información.

Corré `npm test` primero y después `npm run dashboard` — son dos comandos y no uno solo a propósito: si los tests fallan, `npm test` devuelve código distinto de cero y encadenarlos haría que el dashboard no se genere justo cuando más lo necesitás.

---

## Decisiones de diseño

| Decisión | Por qué |
|---|---|
| `getByTestId()` sobre `data-test` | SauceDemo expone `data-test` en todo lo relevante. Es la estrategia de locator más resistente: no depende de CSS, texto ni estructura del DOM. |
| Page Object Model | Un cambio de UI se corrige en un solo archivo, no en 41 tests. |
| Fixture `loggedInInventory` | Encapsula la precondición "sesión iniciada"; los tests que no prueban el login no repiten el login. |
| Datos en `src/data/testData.ts` | Precios, mensajes de error y la tasa de impuesto centralizados — **todos verificados contra el sitio real**, ninguno asumido. |
| Sin `waitForTimeout` en toda la suite | Solo auto-espera de Playwright (`expect(locator)`), que es lo que evita tests inestables. |
| Aislamiento por test | Cada test corre en un contexto de navegador limpio: no hay dependencias de orden. |

---

## Estructura

```
├── docs/plan-de-pruebas.md          # Plan ISTQB completo (riesgos, técnicas, catálogo, trazabilidad)
├── playwright.config.ts             # Chromium, testIdAttribute=data-test, HTML reporter
├── src/
│   ├── pages/                       # Page Objects (Login, Inventory, ProductDetail, Cart, Checkout×3)
│   ├── fixtures/pages.fixture.ts    # Inyección de Page Objects + precondición de sesión
│   ├── data/testData.ts             # Usuarios, catálogo, mensajes de error, tasa de impuesto
│   └── utils/helpers.ts             # Parseo de precios, verificación de ordenamientos
├── tests/
│   ├── business/                    # BN-01 a BN-08
│   └── technical/                   # TC-01 a TC-27
└── .github/workflows/playwright.yml # CI: push, PR y regresión diaria
```

---

## Estado de verificación

Los **selectores, mensajes de error, precios y la tasa de impuesto del 8%** fueron verificados uno por uno contra el DOM real del sitio durante el diseño de la suite. El proyecto **compila limpio** (`npm run typecheck`).

La ejecución completa de la suite todavía no se corrió de punta a punta: el entorno donde se construyó no tenía salida de red hacia saucedemo.com. **Corré `npm test` en tu máquina como primer paso** — si algún caso falla, el reporte HTML (`npm run report`) muestra el trace navegable del fallo.

---

## Cobertura actual y siguientes pasos

Hoy: **Chromium**, reporte HTML nativo de Playwright.

Listos para habilitar cuando haga falta (comentados en `playwright.config.ts`): Firefox, WebKit y un proyecto mobile (Pixel 7). Más allá de eso, los siguientes candidatos naturales son accesibilidad con `@axe-core/playwright` y extender los defectos conocidos a `error_user` y `visual_user`.
