import { test, expect } from '@fixtures/pages.fixture';
import { users, EXPECTED_PRODUCT_COUNT } from '@data/testData';

/**
 * Escenarios TÉCNICOS que ejercitan los usuarios con DEFECTOS INYECTADOS.
 *
 * saucedemo.com expone a propósito usuarios cuyo comportamiento está roto.
 * Automatizarlos sirve para dos cosas:
 *  1. Demostrar que la suite efectivamente DETECTA defectos (una suite que
 *     solo pasa en el camino feliz no prueba nada sobre su propia eficacia).
 *  2. Documentar el comportamiento defectuoso conocido de forma ejecutable.
 *
 * Estos tests están escritos como CARACTERIZACIÓN: afirman el defecto tal
 * como existe hoy. Si el sitio se arregla, fallan — y esa falla es la señal
 * de que el defecto se corrigió, no un falso positivo.
 */
test.describe('Técnico - Usuarios con defectos inyectados', () => {
  test('TC-26 - problem_user muestra la misma imagen (404) en todos los productos [DEFECTO CONOCIDO]', async ({
    loginPage,
    inventoryPage,
    page,
  }) => {
    await loginPage.goto();
    await loginPage.login(users.problem.username, users.problem.password);
    await expect(page).toHaveURL(/inventory\.html/);

    const sources = await inventoryPage.getImageSources();
    expect(sources).toHaveLength(EXPECTED_PRODUCT_COUNT);

    const uniqueSources = new Set(sources);

    // Comportamiento CORRECTO esperado: 6 imágenes distintas, una por producto.
    // Comportamiento ACTUAL (defecto): las 6 apuntan al mismo asset "sl-404".
    expect(
      uniqueSources.size,
      `Defecto conocido: problem_user muestra ${uniqueSources.size} imagen(es) distinta(s) ` +
        `para ${EXPECTED_PRODUCT_COUNT} productos. Si este test falla porque ahora hay 6 ` +
        `imágenes distintas, el defecto fue corregido: actualizar la aserción.`
    ).toBe(1);

    expect([...uniqueSources][0]).toContain('404');
  });

  test('TC-27 - standard_user SÍ muestra una imagen distinta por producto (contraste con TC-26)', async ({
    loggedInInventory,
  }) => {
    const sources = await loggedInInventory.getImageSources();

    expect(sources).toHaveLength(EXPECTED_PRODUCT_COUNT);
    expect(new Set(sources).size).toBe(EXPECTED_PRODUCT_COUNT);
    for (const src of sources) {
      expect(src).not.toContain('404');
    }
  });
});
