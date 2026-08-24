# Plan de Pruebas — Automatización E2E de SauceDemo (Swag Labs)

| | |
|---|---|
| **Versión** | 1.0 |
| **Fecha** | 2026-08-24 |
| **Sistema bajo prueba (SUT)** | https://www.saucedemo.com |
| **Framework** | Playwright + TypeScript, patrón Page Object Model |
| **Alcance** | Autenticación, listado de productos, ficha de producto, carrito, checkout completo (incluida la confirmación de orden) |
| **Referencias** | Syllabus ISTQB Foundation Level (CTFL) v4.0; ISO/IEC/IEEE 29119-3 (documentación de pruebas) |

---

## 1. Introducción

### 1.1 Objetivo

Definir la estrategia, el diseño y la trazabilidad de la suite automatizada de pruebas E2E sobre SauceDemo, cubriendo tanto **escenarios de negocio** (recorridos completos del comprador) como **escenarios técnicos** (validaciones de campo, reglas de cálculo, control de acceso, ordenamientos y defectos conocidos).

### 1.2 Por qué SauceDemo

SauceDemo (Swag Labs) es un sitio de e-commerce publicado por Sauce Labs **expresamente para practicar automatización de pruebas**. Esto habilita algo que un sitio de producción de terceros no permite: ejecutar el flujo completo de compra de punta a punta, incluida la confirmación de la orden, sin consecuencias reales ni consideraciones éticas.

Además, el sitio expone deliberadamente **usuarios con defectos inyectados** (`problem_user`, `performance_glitch_user`, `error_user`, `visual_user`), lo que permite demostrar algo que rara vez se puede demostrar: que la suite **efectivamente detecta defectos**, no solo que pasa en el camino feliz.

### 1.3 Características del SUT relevantes para el diseño

- **Atributos `data-test` estables** en todos los elementos relevantes. La suite configura `testIdAttribute: 'data-test'` y usa `getByTestId()` como estrategia primaria de locator: la más robusta posible, independiente de clases CSS, texto y estructura del DOM.
- **Sin backend real de negocio**: los precios y el catálogo son fijos, lo que permite aserciones exactas sobre valores concretos en lugar de aserciones débiles del tipo "debe haber al menos un resultado".
- **Estado persistido en cookies**: el carrito sobrevive a la navegación entre páginas, lo que habilita casos de persistencia.

> **Nota sobre el contexto del proyecto.** La descripción del proyecto menciona SAP Commerce Cloud como plataforma objetivo. SauceDemo no está construido sobre SAP Commerce Cloud; se usa aquí como sitio de práctica. La metodología, la arquitectura del framework (POM, fixtures, datos externalizados) y la estructura de este plan son directamente reutilizables sobre un storefront SAP Commerce Cloud: lo que cambia son los locators y el catálogo de casos, no el enfoque.

---

## 2. Análisis de riesgo del producto

Priorización por probabilidad de falla × impacto de negocio, según el enfoque de pruebas basadas en riesgo del syllabus ISTQB.

| ID | Riesgo | Prob. | Impacto | Prioridad | Casos que lo mitigan |
|---|---|---|---|---|---|
| R1 | Un usuario no puede completar una compra | Baja | **Crítico** | P1 | BN-01, BN-02, BN-03 |
| R2 | Los totales del checkout se calculan mal (impuesto/subtotal) | Media | **Crítico** | P1 | TC-23, TC-24 |
| R3 | Rutas internas accesibles sin sesión (broken access control) | Media | **Alto** | P1 | TC-10, TC-11 |
| R4 | El login acepta credenciales inválidas o permite enumerar usuarios | Baja | **Alto** | P1 | TC-02 a TC-07 |
| R5 | El carrito pierde o duplica productos al navegar | Media | Alto | P1 | TC-19, TC-20, BN-06 |
| R6 | El catálogo muestra productos o precios incorrectos | Baja | Alto | P2 | TC-12, TC-13 |
| R7 | El ordenamiento del listado no funciona | Media | Medio | P2 | TC-14 a TC-17 |
| R8 | Las imágenes de producto no corresponden al producto | Media | Medio | P2 | TC-26, TC-27 |
| R9 | Degradación de performance en el acceso al catálogo | Media | Medio | P3 | TC-09 |
| R10 | El usuario no puede corregir su carrito antes de comprar | Baja | Medio | P2 | BN-04, BN-05, BN-07, TC-22, TC-25 |

**Uso de la priorización:** los casos P1 conforman el conjunto de regresión mínima obligatoria. El subconjunto marcado con la etiqueta `@smoke` (ejecutable con `npm run test:smoke`) es el chequeo más rápido de que el sistema está operativo.

---

## 3. Estrategia de pruebas

### 3.1 Nivel y tipo

- **Nivel:** pruebas de sistema (*system testing*), end-to-end sobre la interfaz de usuario.
- **Enfoque:** caja negra, basado en especificación observable del comportamiento.
- **Tipos cubiertos:**

| Tipo de prueba | Cobertura |
|---|---|
| Funcional | Completa sobre el alcance definido (BN-01 a BN-08, TC-01 a TC-08, TC-12 a TC-25) |
| Seguridad (caja negra) | Control de acceso a rutas protegidas (TC-10, TC-11); no enumeración de usuarios (TC-05); enmascarado de contraseña (TC-07) |
| Performance (puntual) | Tiempo de carga del inventario con usuario degradado (TC-09) |
| Regresión | Toda la suite está diseñada para ejecución repetida en CI |
| Carga / estrés | Fuera de alcance |
| Regresión visual (pixel) | Fuera de alcance — se cubre parcialmente vía TC-26/TC-27 (integridad de imágenes) |
| Accesibilidad (WCAG) | Fuera de alcance de esta versión |

### 3.2 Arquitectura del framework

| Decisión | Justificación |
|---|---|
| **Page Object Model** | Aísla los locators de la lógica de prueba: un cambio en la UI se corrige en un solo archivo. |
| **`getByTestId()` sobre `data-test`** | Estrategia de locator más resistente a refactors de maquetado. |
| **Fixtures de Playwright** | `loggedInInventory` encapsula la precondición "sesión iniciada" y evita repetir el login en tests cuyo objetivo no es el login. |
| **Datos externalizados** (`src/data/testData.ts`) | Los valores esperados (precios, mensajes de error, tasa de impuesto) viven en un solo lugar y están verificados contra el sitio real. |
| **`test.step()` en escenarios de negocio** | El reporte HTML muestra cada paso Dado/Cuando/Entonces con su estado, legible por stakeholders no técnicos. |
| **Aislamiento por test** | Cada test corre en un contexto de navegador limpio (sin cookies compartidas), por lo que no hay dependencias de orden entre tests. |

### 3.3 Datos de prueba

Todos los valores esperados fueron **verificados en vivo contra el sitio real** durante el diseño (no son supuestos):

- **Catálogo:** 6 productos con precios exactos ($7.99 a $49.99).
- **Mensajes de error:** copiados textualmente del DOM (login y checkout).
- **Tasa de impuesto:** **8%** — derivada de una observación real (subtotal $39.98 → impuesto $3.20 → total $43.18).
- **Opciones de ordenamiento:** valores reales del `<select>` (`az`, `za`, `lohi`, `hilo`).

---

## 4. Técnicas de diseño de casos aplicadas

| Técnica ISTQB | Aplicación concreta | Casos |
|---|---|---|
| **Partición de equivalencia** | Campos de login (válido / vacío / inválido / bloqueado) y campos del checkout (completo / incompleto en cada combinación) | TC-02 a TC-05, TC-21 |
| **Tabla de decisión** | Combo de ordenamiento: 4 opciones × resultado esperado determinado. Se cubren las 4 combinaciones, no una muestra | TC-14 a TC-17 |
| **Transición de estados** | Ciclo del botón de producto (`Add to cart` ⇄ `Remove`) y del carrito (vacío → con ítems → comprado → vacío) | TC-18, BN-08 |
| **Pruebas basadas en casos de uso** | Recorridos completos del comprador, redactados en Dado/Cuando/Entonces | BN-01 a BN-08 |
| **Pruebas negativas / de robustez** | Rutas protegidas por URL directa, formularios incompletos, navegación hacia atrás tras logout | TC-08, TC-10, TC-11, TC-21 |
| **Verificación de reglas de cálculo** | Impuesto = 8% del subtotal; total = subtotal + impuesto; subtotal = suma de ítems | TC-23, TC-24 |
| **Pruebas de caracterización** | Documentan de forma ejecutable el comportamiento defectuoso conocido de `problem_user` | TC-26, TC-27 |

---

## 5. Criterios de entrada, salida y suspensión

**Entrada**
- El proyecto compila sin errores (`npm run typecheck`).
- Chromium instalado (`npx playwright install chromium`).
- Conectividad hacia saucedemo.com desde el entorno de ejecución.

**Salida (por corrida)**
- 100% de los casos P1 ejecutados, sin fallos abiertos sin triage.
- Reporte HTML generado y archivado.

**Suspensión**
- Si el sitio devuelve errores 5xx sostenidos o no es alcanzable, la corrida se marca como *no concluyente* y no se reportan defectos del SUT.

---

## 6. Catálogo de casos de prueba

Prioridad: **P1** (crítico/regresión mínima) · **P2** (regresión completa) · **P3** (deseable).
Todos los casos listados están **automatizados**.

### 6.1 Escenarios de negocio

| ID | Título | Precondición | Resultado esperado | Prio. | Spec |
|---|---|---|---|---|---|
| BN-01 | Compra completa de un producto de punta a punta `@smoke` | Sesión iniciada | Orden confirmada ("Thank you for your order!") y carrito vacío | P1 | `business/purchase-flow.spec.ts` |
| BN-02 | Compra de múltiples productos | Sesión iniciada | El subtotal es la suma de los 3 precios y la orden se confirma | P1 | `business/purchase-flow.spec.ts` |
| BN-03 | Compra iniciada desde la ficha de detalle | Sesión iniciada | El producto correcto llega al checkout y la orden se confirma | P1 | `business/purchase-flow.spec.ts` |
| BN-04 | Quitar un producto del carrito | 2 productos en el carrito | Queda solo el otro producto; el badge se ajusta | P2 | `business/cart-management.spec.ts` |
| BN-05 | Vaciar el carrito por completo | 2 productos en el carrito | Carrito sin ítems y badge sin valor | P2 | `business/cart-management.spec.ts` |
| BN-06 | "Continue Shopping" preserva el carrito | 1 producto en el carrito | Vuelve al listado conservando el producto | P2 | `business/cart-management.spec.ts` |
| BN-07 | "Reset App State" vacía el carrito | 2 productos en el carrito | Badge en 0 | P2 | `business/cart-management.spec.ts` |
| BN-08 | Post-compra: volver al listado con carrito limpio | Orden confirmada | Inventario visible y carrito vacío | P2 | `business/cart-management.spec.ts` |

### 6.2 Escenarios técnicos

| ID | Título | Técnica de diseño | Resultado esperado | Prio. | Spec |
|---|---|---|---|---|---|
| TC-01 | Login exitoso con `standard_user` `@smoke` | Partición (clase válida) | Redirige a `/inventory.html`, título "Products" | P1 | `technical/login.spec.ts` |
| TC-02 | Login sin usuario | Partición (clase inválida) | "Epic sadface: Username is required" | P1 | `technical/login.spec.ts` |
| TC-03 | Login sin contraseña | Partición (clase inválida) | "Epic sadface: Password is required" | P1 | `technical/login.spec.ts` |
| TC-04 | Usuario bloqueado | Partición (clase inválida) | "Sorry, this user has been locked out." y no ingresa | P1 | `technical/login.spec.ts` |
| TC-05 | Contraseña incorrecta y usuario inexistente dan el **mismo** mensaje | Prueba de seguridad | Mensaje idéntico en ambos casos (no permite enumerar usuarios) | P1 | `technical/login.spec.ts` |
| TC-06 | Cerrar el mensaje de error con la X | Prueba de UI | El error deja de mostrarse | P3 | `technical/login.spec.ts` |
| TC-07 | La contraseña se enmascara | Prueba de seguridad | `input[type="password"]` | P2 | `technical/login.spec.ts` |
| TC-08 | Logout corta la sesión `@smoke` | Transición de estados | Vuelve al login; ir "atrás" no restaura la sesión | P1 | `technical/login.spec.ts` |
| TC-09 | `performance_glitch_user` es medible más lento que `standard_user`, pero funcional **[defecto conocido]** | Prueba no funcional, comparativa | El usuario degradado tarda más que el normal y aun así el inventario carga, por debajo del techo de regresión | P3 | `technical/login.spec.ts` |
| TC-10 | Acceso directo por URL a 5 rutas protegidas sin sesión | Prueba negativa / seguridad | Redirige al login con el mensaje de ruta protegida (5 casos parametrizados) | P1 | `technical/security-routes.spec.ts` |
| TC-11 | Ruta protegida tras cerrar sesión | Prueba negativa / seguridad | Rechaza el acceso | P1 | `technical/security-routes.spec.ts` |
| TC-12 | El inventario muestra los 6 productos `@smoke` | Basado en especificación | 6 ítems, todos los nombres del catálogo | P2 | `technical/inventory.spec.ts` |
| TC-13 | Cada producto muestra su precio correcto | Basado en especificación | Precio exacto por producto | P2 | `technical/inventory.spec.ts` |
| TC-14 | Orden por nombre A→Z | Tabla de decisión | Nombres en orden alfabético ascendente | P2 | `technical/inventory.spec.ts` |
| TC-15 | Orden por nombre Z→A | Tabla de decisión | Nombres en orden alfabético descendente | P2 | `technical/inventory.spec.ts` |
| TC-16 | Orden por precio menor→mayor | Tabla de decisión | Precios ascendentes | P2 | `technical/inventory.spec.ts` |
| TC-17 | Orden por precio mayor→menor | Tabla de decisión | Precios descendentes | P2 | `technical/inventory.spec.ts` |
| TC-18 | Ciclo del botón Add ⇄ Remove | Transición de estados | El botón alterna correctamente | P2 | `technical/inventory.spec.ts` |
| TC-19 | El badge refleja la cantidad del carrito | Basado en estado | Badge = cantidad de ítems (0/1/2) | P1 | `technical/inventory.spec.ts` |
| TC-20 | El carrito persiste al navegar | Basado en estado | El badge se mantiene al cambiar de página | P1 | `technical/inventory.spec.ts` |
| TC-21 | Checkout con campos obligatorios faltantes | Partición de equivalencia | Mensaje de error correspondiente a cada campo (3 casos parametrizados) | P1 | `technical/checkout-validations.spec.ts` |
| TC-22 | "Cancel" en el paso 1 | Prueba de navegación | Vuelve al carrito sin perder los productos | P2 | `technical/checkout-validations.spec.ts` |
| TC-23 | **El impuesto es el 8% del subtotal y el total es la suma** | Regla de cálculo | `tax == round(subtotal × 0.08)` y `total == subtotal + tax` | P1 | `technical/checkout-validations.spec.ts` |
| TC-24 | El subtotal es la suma de los ítems del resumen | Regla de cálculo | `subtotal == Σ precios` | P1 | `technical/checkout-validations.spec.ts` |
| TC-25 | "Cancel" en el paso 2 | Prueba de navegación | Vuelve al inventario | P2 | `technical/checkout-validations.spec.ts` |
| TC-26 | `problem_user` muestra la misma imagen 404 en los 6 productos **[defecto conocido]** | Caracterización | 1 sola imagen distinta en lugar de 6; el `src` contiene "404" | P2 | `technical/known-defects.spec.ts` |
| TC-27 | `standard_user` sí muestra 6 imágenes distintas (contraste con TC-26) | Caracterización | 6 `src` únicos, ninguno con "404" | P2 | `technical/known-defects.spec.ts` |

**Total: 35 IDs de caso (27 técnicos + 8 de negocio), que se expanden en 41 tests ejecutables** — TC-10 se parametriza en 5 rutas y TC-21 en 3 combinaciones de campos. **100% automatizados.**

---

### 6.3 Hallazgos de la primera ejecución en CI

La primera corrida real de la suite (GitHub Actions) dio **37 pasados de 41**. Los 4 fallos no fueron defectos del sitio sino de la propia automatización, y ambas causas quedaron corregidas:

| Fallo | Casos afectados | Causa raíz | Corrección |
|---|---|---|---|
| Timeout al clickear el menú lateral | TC-08, TC-11, BN-07 | El atributo `data-test="open-menu"` (y `close-menu`) no está en el botón sino en la `<img>` decorativa del ícono. El botón real de react-burger-menu es un hermano posicionado encima, que intercepta el puntero: Playwright espera a que el elemento sea clickeable y agota el timeout. | Usar `#react-burger-menu-btn` y `#react-burger-cross-btn`, los únicos dos locators de la suite que no son `data-test` (documentado en el código). |
| Umbral de performance imposible | TC-09 | El test exigía que el inventario cargara en menos de 4 s con `performance_glitch_user`, un usuario cuya demora de ~5 s está inyectada a propósito. El caso fallaba por diseño, y un umbral absoluto además depende de la máquina. | Rediseño comparativo: se mide el mismo flujo con `standard_user` y con el usuario degradado en la misma corrida, y se verifica que el segundo tarda más pero igual carga, con un techo de regresión holgado. |

Ambos hallazgos ilustran por qué la ejecución real es parte del diseño de pruebas y no un trámite posterior: ninguna de las dos causas era detectable leyendo el código, y la segunda era un error conceptual en el diseño del caso, no un problema técnico.

---

## 7. Sobre los casos de defectos conocidos (TC-26 / TC-27)

TC-26 es una **prueba de caracterización**: afirma el defecto tal como existe hoy, con un mensaje de fallo que explica qué hacer si el sitio se corrige. Su valor es doble:

1. **Evidencia de eficacia de la suite.** Una suite que solo pasa en el camino feliz no demuestra nada sobre su capacidad de detectar defectos. TC-26 y TC-27 forman un par: el mismo chequeo pasa para `standard_user` y detecta el defecto para `problem_user`.
2. **Documentación ejecutable.** El comportamiento defectuoso queda registrado en un formato que no se desactualiza en silencio.

Este patrón es directamente trasladable a un proyecto real: cuando se reporta un defecto que no se va a corregir en el sprint actual, escribir un test de caracterización evita que el equipo lo redescubra y avisa automáticamente cuando finalmente se arregla.

---

## 8. Reporte de resultados

Cada corrida genera:

- **Reporte HTML de Playwright** (`playwright-report/`, se abre con `npm run report`): estado por test (passed/failed/skipped/flaky), duración, pasos nombrados (`test.step`) y, ante un fallo, screenshot, video y *trace* navegable paso a paso.
- **`test-results/results.json`**: salida estructurada para alimentar un dashboard propio o un resumen ejecutivo en el pipeline.
- **Reporter `list`** en consola, para ejecución local y logs de CI.

### 8.1 Dashboard de resultados con gráficas

El reporte nativo de Playwright está optimizado para **depurar** un fallo, no para comunicar el estado de una corrida: no incluye gráficas ni un resumen ejecutivo. Para cubrir eso, el proyecto incorpora `scripts/generate-dashboard.mjs`, que transforma `results.json` en un HTML autocontenido (`npm run dashboard`) con:

- **Cifra principal**: tasa de éxito sobre los tests efectivamente ejecutados (los omitidos no diluyen la métrica).
- **KPIs**: total, pasados, fallados, inestables y omitidos.
- **Distribución de resultados**: barra apilada parte-a-todo con la paleta de estado (verde/ámbar/rojo/gris), con leyenda y valores — el color nunca es el único portador de significado.
- **Resultados por tipo de escenario**: técnico vs. negocio.
- **Duración por archivo de pruebas**: barras horizontales para detectar specs lentos.
- **Casos fallados y casos inestables**: cada uno con su mensaje de error completo.
- **Los 8 casos más lentos** y la **tabla completa** de todos los tests.

- **Línea de tiempo de la ejecución**: cada test ubicado sobre el eje de tiempo real de la corrida, en la fila del worker que lo ejecutó. Es la vista que responde por qué la corrida tardó lo que tardó.
- **Matriz de trazabilidad riesgo → casos → estado**: los 10 riesgos de la sección 2 con los casos que los mitigan y su resultado en la corrida, más un indicador de "riesgos sanos" en los KPIs. Cierra el circuito entre el análisis de riesgo y la evidencia de ejecución.

Los casos *flaky* se contabilizan como exitosos en la tasa (terminaron pasando) pero se muestran en su propia sección, porque un test inestable señala un problema real: o una condición de carrera en el sitio, o una espera mal planteada en la prueba.

**Exportación a PDF.** Todas las gráficas se dibujan en SVG y no con `background-color` sobre divs. No es un detalle de implementación: los navegadores no imprimen colores de fondo salvo que el usuario tilde explícitamente la opción, de modo que un gráfico construido con fondos sale en blanco al exportar. El `fill` de un `<rect>` es contenido y siempre se imprime. Se suma una hoja de estilos de impresión que fuerza la paleta clara, evita cortar tarjetas entre páginas y expande los bloques de error colapsados.

En CI (workflow incluido en `.github/workflows/playwright.yml`) **ambos** reportes se publican como *artifacts* descargables, con retención de 14 días, usando `if: always()` para que se generen también cuando la corrida falla — que es cuando más se necesitan.

---

## 9. Matriz de trazabilidad riesgo → caso

| Riesgo | Casos | Cubierto |
|---|---|---|
| R1 — No se puede comprar | BN-01, BN-02, BN-03 | ✅ |
| R2 — Totales mal calculados | TC-23, TC-24 | ✅ |
| R3 — Rutas sin protección | TC-10 (×5), TC-11 | ✅ |
| R4 — Fallas de login/seguridad | TC-02, TC-03, TC-04, TC-05, TC-06, TC-07 | ✅ |
| R5 — Carrito inconsistente | TC-19, TC-20, BN-06 | ✅ |
| R6 — Catálogo incorrecto | TC-12, TC-13 | ✅ |
| R7 — Ordenamiento roto | TC-14, TC-15, TC-16, TC-17 | ✅ |
| R8 — Imágenes incorrectas | TC-26, TC-27 | ✅ |
| R9 — Degradación de performance | TC-09 | ✅ |
| R10 — No se puede corregir el carrito | BN-04, BN-05, BN-07, TC-22, TC-25 | ✅ |

**Cobertura de riesgos identificados: 10/10.**

---

## 10. Riesgos del proyecto de pruebas (no del producto)

| Riesgo | Mitigación aplicada |
|---|---|
| Fragilidad de locators ante cambios de UI | Uso exclusivo de `data-test` vía `getByTestId()`; locators centralizados en Page Objects |
| Tests inestables (*flaky*) por timing | Aserciones con auto-espera de Playwright (`expect(locator)`), sin `waitForTimeout` en toda la suite |
| Dependencias de orden entre tests | Aislamiento por contexto de navegador; cada test construye su propia precondición |
| Falsos positivos en el caso de performance | Diseño comparativo (degradado vs. normal en la misma corrida) en lugar de un umbral absoluto dependiente de la máquina, más un techo de regresión holgado y configurable (`PERF_THRESHOLD_MS`) |
| Datos esperados desactualizados | Todos los valores verificados contra el sitio real y centralizados en `src/data/testData.ts` |

---

## 11. Próximos pasos sugeridos

1. **Cobertura cross-browser**: habilitar Firefox y WebKit (ya configurados y comentados en `playwright.config.ts`).
2. **Cobertura mobile**: habilitar el proyecto `mobile-chrome` (Pixel 7).
3. **Accesibilidad**: incorporar `@axe-core/playwright` para chequeos WCAG automatizados.
4. **`error_user` y `visual_user`**: extender `known-defects.spec.ts` con los defectos inyectados de estos dos usuarios (no cubiertos en esta versión).
5. **Historial de tendencias**: si se necesita seguimiento entre corridas y segmentación por severidad, migrar a Allure Report reutilizando `results.json`.
