import { test, expect } from '@fixtures/pages.fixture';
import { products, invalidCheckoutData, checkoutCustomer, TAX_RATE } from '@data/testData';
import { round2 } from '@utils/helpers';

/**
 * Escenarios TÉCNICOS del checkout: validación de formulario y verificación
 * de la regla de cálculo de totales.
 *
 * Técnicas de diseño:
 *  - Partición de equivalencia sobre los tres campos obligatorios del paso 1.
 *  - Verificación de regla de negocio calculada (impuesto del 8% sobre el
 *    subtotal), que es donde un e-commerce se juega la confianza del usuario.
 */
test.describe('Técnico - Validaciones de checkout', () => {
  test.beforeEach(async ({ loggedInInventory, cartPage }) => {
    await loggedInInventory.addToCart(products[0].slug);
    await cartPage.goto();
    await cartPage.checkout();
  });

  for (const scenario of invalidCheckoutData) {
    test(`TC-21 - Checkout con ${scenario.caseName} muestra el error correspondiente`, async ({
      checkoutStepOnePage,
      page,
    }) => {
      await checkoutStepOnePage.fillAndContinue(
        scenario.data.firstName,
        scenario.data.lastName,
        scenario.data.postalCode
      );

      await expect(checkoutStepOnePage.errorMessage).toHaveText(scenario.expectedError);
      await expect(page).toHaveURL(/checkout-step-one\.html/);
    });
  }

  test('TC-22 - "Cancel" en el paso 1 devuelve al carrito sin perder los productos', async ({
    checkoutStepOnePage,
    cartPage,
    page,
  }) => {
    await checkoutStepOnePage.cancel();

    await expect(page).toHaveURL(/cart\.html/);
    expect(await cartPage.itemCount()).toBe(1);
  });

  test('TC-23 - El impuesto es el 8% del subtotal y el total es la suma de ambos', async ({
    checkoutStepOnePage,
    checkoutStepTwoPage,
  }) => {
    await checkoutStepOnePage.fillAndContinue(
      checkoutCustomer.firstName,
      checkoutCustomer.lastName,
      checkoutCustomer.postalCode
    );

    const subtotal = await checkoutStepTwoPage.getSubtotal();
    const tax = await checkoutStepTwoPage.getTax();
    const total = await checkoutStepTwoPage.getTotal();

    expect(tax, 'El impuesto debe ser el 8% del subtotal').toBe(round2(subtotal * TAX_RATE));
    expect(total, 'El total debe ser subtotal + impuesto').toBe(round2(subtotal + tax));
  });

  test('TC-24 - El subtotal equivale a la suma de los precios de los ítems del resumen', async ({
    checkoutStepOnePage,
    checkoutStepTwoPage,
  }) => {
    await checkoutStepOnePage.fillAndContinue(
      checkoutCustomer.firstName,
      checkoutCustomer.lastName,
      checkoutCustomer.postalCode
    );

    const prices = await checkoutStepTwoPage.getItemPrices();
    const subtotal = await checkoutStepTwoPage.getSubtotal();

    expect(subtotal).toBe(round2(prices.reduce((acc, p) => acc + p, 0)));
  });

  test('TC-25 - "Cancel" en el paso 2 devuelve al inventario', async ({
    checkoutStepOnePage,
    checkoutStepTwoPage,
    page,
  }) => {
    await checkoutStepOnePage.fillAndContinue(
      checkoutCustomer.firstName,
      checkoutCustomer.lastName,
      checkoutCustomer.postalCode
    );

    await checkoutStepTwoPage.cancel();

    await expect(page).toHaveURL(/inventory\.html/);
  });
});
