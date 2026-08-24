import { test, expect } from '@fixtures/pages.fixture';
import { protectedRoutes, errorMessages, users } from '@data/testData';

/**
 * Escenarios TÉCNICOS de control de acceso (seguridad, caja negra).
 *
 * Objetivo: verificar que las rutas internas no sean alcanzables por URL
 * directa sin una sesión válida. Es un caso clásico de "broken access
 * control" y merece cobertura automatizada en cualquier e-commerce.
 */
test.describe('Técnico - Control de acceso a rutas protegidas', () => {
  for (const route of protectedRoutes) {
    test(`TC-10 - Acceso directo a ${route} sin sesión es rechazado`, async ({ page, loginPage }) => {
      await page.goto(route);

      await expect(loginPage.errorMessage).toBeVisible();
      await expect(loginPage.errorMessage).toHaveText(errorMessages.protectedRoute(route));
      await expect(page).toHaveURL(/saucedemo\.com\/?$/);
    });
  }

  test('TC-11 - Tras cerrar sesión, la ruta protegida deja de ser accesible', async ({
    loginPage,
    inventoryPage,
    page,
  }) => {
    await loginPage.goto();
    await loginPage.login(users.standard.username, users.standard.password);
    await expect(page).toHaveURL(/inventory\.html/);

    await inventoryPage.logout();
    await page.goto('/inventory.html');

    await expect(loginPage.errorMessage).toHaveText(errorMessages.protectedRoute('/inventory.html'));
  });
});
