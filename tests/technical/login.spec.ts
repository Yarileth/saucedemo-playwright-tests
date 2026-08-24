import { test, expect } from '@fixtures/pages.fixture';
import { users, invalidCredentials, errorMessages, PERFORMANCE_THRESHOLD_MS } from '@data/testData';

/**
 * Escenarios TÉCNICOS de autenticación.
 *
 * Técnicas de diseño aplicadas:
 *  - Partición de equivalencia sobre los campos usuario/contraseña
 *    (válido / vacío / inválido / bloqueado).
 *  - Prueba de seguridad de caja negra: verificar que el mensaje de error
 *    no distinga entre "usuario inexistente" y "contraseña incorrecta"
 *    (evita enumeración de usuarios).
 *  - Prueba no funcional de performance sobre un usuario con degradación
 *    inyectada a propósito por el sitio.
 */
test.describe('Técnico - Autenticación', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('TC-01 - Login exitoso con standard_user redirige al inventario @smoke', async ({
    loginPage,
    page,
  }) => {
    await loginPage.login(users.standard.username, users.standard.password);

    await expect(page).toHaveURL(/inventory\.html/);
    await expect(page.getByTestId('title')).toHaveText('Products');
  });

  test('TC-02 - Login sin usuario muestra "Username is required"', async ({ loginPage }) => {
    await loginPage.login(invalidCredentials.emptyUsername.username, invalidCredentials.emptyUsername.password);

    await expect(loginPage.errorMessage).toHaveText(errorMessages.usernameRequired);
  });

  test('TC-03 - Login sin contraseña muestra "Password is required"', async ({ loginPage }) => {
    await loginPage.login(invalidCredentials.emptyPassword.username, invalidCredentials.emptyPassword.password);

    await expect(loginPage.errorMessage).toHaveText(errorMessages.passwordRequired);
  });

  test('TC-04 - Usuario bloqueado es rechazado con un mensaje específico', async ({
    loginPage,
    page,
  }) => {
    await loginPage.login(users.lockedOut.username, users.lockedOut.password);

    await expect(loginPage.errorMessage).toHaveText(errorMessages.lockedOut);
    await expect(page).not.toHaveURL(/inventory\.html/);
  });

  test('TC-05 - Contraseña incorrecta y usuario inexistente devuelven el MISMO mensaje (no permite enumerar usuarios)', async ({
    loginPage,
  }) => {
    await test.step('Intento con contraseña incorrecta sobre un usuario que existe', async () => {
      await loginPage.login(invalidCredentials.wrongPassword.username, invalidCredentials.wrongPassword.password);
      await expect(loginPage.errorMessage).toHaveText(errorMessages.noMatch);
    });

    await test.step('Intento con un usuario que no existe', async () => {
      await loginPage.dismissError();
      await loginPage.login(invalidCredentials.unknownUser.username, invalidCredentials.unknownUser.password);
      await expect(loginPage.errorMessage).toHaveText(errorMessages.noMatch);
    });

    // Ambos casos comparten el mismo texto: un atacante no puede inferir
    // qué usuarios existen a partir de la respuesta del formulario.
  });

  test('TC-06 - El mensaje de error se puede cerrar con la X', async ({ loginPage }) => {
    await loginPage.login(invalidCredentials.bothEmpty.username, invalidCredentials.bothEmpty.password);
    await expect(loginPage.errorMessage).toBeVisible();

    await loginPage.dismissError();

    await expect(loginPage.errorMessage).not.toBeVisible();
  });

  test('TC-07 - La contraseña se enmascara en pantalla', async ({ loginPage }) => {
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
  });

  test('TC-08 - Logout vuelve al login y corta la sesión @smoke', async ({
    loginPage,
    inventoryPage,
    page,
  }) => {
    await loginPage.login(users.standard.username, users.standard.password);
    await expect(page).toHaveURL(/inventory\.html/);

    await inventoryPage.logout();

    await expect(page).toHaveURL(/saucedemo\.com\/?$/);
    await expect(loginPage.loginButton).toBeVisible();

    await test.step('Volver atrás en el historial no debe restaurar la sesión', async () => {
      // Si el historial no tiene una entrada previa (según cómo se haya
      // llegado al test), no hay nada que verificar acá: TC-11 cubre el
      // mismo control de acceso por URL directa.
      await page.goBack().catch(() => undefined);
      await expect(inventoryPage.inventoryList).not.toBeVisible();
    });
  });

  test('TC-09 - performance_glitch_user es medible más lento que standard_user, pero funcional [DEFECTO CONOCIDO]', async ({
    loginPage,
    page,
  }) => {
    test.setTimeout(90_000);

    /**
     * `performance_glitch_user` tiene una demora inyectada a propósito en el
     * login (alrededor de 5 segundos).
     *
     * Una primera versión de este test afirmaba "carga en menos de 4s", y
     * fallaba siempre: estaba exigiendo que un defecto deliberado no
     * existiera. Un umbral absoluto además es frágil, porque depende de la
     * máquina y de la red del runner de CI.
     *
     * El diseño correcto para caracterizar una degradación es COMPARATIVO:
     * medimos el mismo flujo con los dos usuarios en la misma corrida y
     * verificamos (a) que el usuario degradado efectivamente tarda más, y
     * (b) que aun así termina cargando, es decir que la demora es un
     * problema de performance y no de funcionalidad.
     */
    async function measureLogin(username: string, password: string): Promise<number> {
      await loginPage.goto();
      const start = Date.now();
      await loginPage.login(username, password);
      await expect(page.getByTestId('inventory-list')).toBeVisible({ timeout: 30_000 });
      return Date.now() - start;
    }

    const standardMs = await measureLogin(users.standard.username, users.standard.password);
    await page.getByTestId('shopping-cart-link').waitFor();
    const glitchMs = await measureLogin(
      users.performanceGlitch.username,
      users.performanceGlitch.password
    );

    await test.step('El usuario degradado tarda mediblemente más que el normal', async () => {
      expect(
        glitchMs,
        `standard_user: ${standardMs}ms · performance_glitch_user: ${glitchMs}ms. ` +
          'Si este test falla porque ya no hay diferencia, la demora inyectada fue removida.'
      ).toBeGreaterThan(standardMs);
    });

    await test.step('Pese a la demora, el inventario carga (la degradación no rompe la funcionalidad)', async () => {
      await expect(page).toHaveURL(/inventory\.html/);
      expect(
        glitchMs,
        `El login degradado tardó ${glitchMs}ms, por encima del techo de ` +
          `${PERFORMANCE_THRESHOLD_MS}ms. Eso ya no es la demora conocida sino una regresión.`
      ).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });
  });
});
