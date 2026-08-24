import { test, expect } from '@fixtures/pages.fixture';
import { products, checkoutCustomer, TAX_RATE } from '@data/testData';
import { round2 } from '@utils/helpers';

/**
 * Escenarios de NEGOCIO: el flujo de compra end-to-end.
 *
 * Redactados desde la perspectiva del comprador y estructurados con
 * `test.step()` en formato Dado/Cuando/Entonces, para que el reporte HTML
 * sea legible por un stakeholder no técnico: cada paso aparece nombrado
 * en el detalle del test.
 */
test.describe('Negocio - Flujo de compra', () => {
  test('BN-01 - Como comprador, completo una compra de un producto de punta a punta @smoke', async ({
    loggedInInventory,
    cartPage,
    checkoutStepOnePage,
    checkoutStepTwoPage,
    checkoutCompletePage,
    page,
  }) => {
    const product = products[0]; // Sauce Labs Backpack — $29.99

    await test.step(`Dado que agrego "${product.name}" al carrito`, async () => {
      await loggedInInventory.addToCart(product.slug);
      expect(await loggedInInventory.getCartCount()).toBe(1);
    });

    await test.step('Cuando abro el carrito y veo el producto correcto', async () => {
      await loggedInInventory.openCart();
      await expect(page).toHaveURL(/cart\.html/);
      expect(await cartPage.getItemNames()).toEqual([product.name]);
      expect(await cartPage.getQuantities()).toEqual([1]);
    });

    await test.step('Y completo mis datos de envío', async () => {
      await cartPage.checkout();
      await checkoutStepOnePage.fillAndContinue(
        checkoutCustomer.firstName,
        checkoutCustomer.lastName,
        checkoutCustomer.postalCode
      );
      await expect(page).toHaveURL(/checkout-step-two\.html/);
    });

    await test.step('Y el resumen muestra el importe correcto', async () => {
      expect(await checkoutStepTwoPage.getSubtotal()).toBe(product.price);
      expect(await checkoutStepTwoPage.getTotal()).toBe(
        round2(product.price + round2(product.price * TAX_RATE))
      );
    });

    await test.step('Entonces al confirmar veo la orden completada', async () => {
      await checkoutStepTwoPage.finish();
      await expect(page).toHaveURL(/checkout-complete\.html/);
      await expect(checkoutCompletePage.completeHeader).toHaveText('Thank you for your order!');
    });

    await test.step('Y el carrito queda vacío después de la compra', async () => {
      expect(await checkoutCompletePage.getCartCount()).toBe(0);
    });
  });

  test('BN-02 - Como comprador, compro varios productos y el total refleja todos los ítems', async ({
    loggedInInventory,
    cartPage,
    checkoutStepOnePage,
    checkoutStepTwoPage,
    checkoutCompletePage,
    page,
  }) => {
    const selected = [products[0], products[1], products[3]]; // 29.99 + 9.99 + 49.99
    const expectedSubtotal = round2(selected.reduce((acc, p) => acc + p.price, 0));

    await test.step('Dado que agrego tres productos al carrito', async () => {
      for (const product of selected) {
        await loggedInInventory.addToCart(product.slug);
      }
      expect(await loggedInInventory.getCartCount()).toBe(selected.length);
    });

    await test.step('Cuando reviso el carrito, están los tres productos', async () => {
      await loggedInInventory.openCart();
      expect(await cartPage.itemCount()).toBe(selected.length);
      const names = await cartPage.getItemNames();
      for (const product of selected) {
        expect(names).toContain(product.name);
      }
    });

    await test.step('Entonces el subtotal del checkout es la suma de los tres precios', async () => {
      await cartPage.checkout();
      await checkoutStepOnePage.fillAndContinue(
        checkoutCustomer.firstName,
        checkoutCustomer.lastName,
        checkoutCustomer.postalCode
      );
      expect(await checkoutStepTwoPage.getSubtotal()).toBe(expectedSubtotal);
    });

    await test.step('Y puedo confirmar la compra correctamente', async () => {
      await checkoutStepTwoPage.finish();
      await expect(page).toHaveURL(/checkout-complete\.html/);
      await expect(checkoutCompletePage.completeHeader).toBeVisible();
    });
  });

  test('BN-03 - Como comprador, compro desde la ficha de detalle del producto', async ({
    loggedInInventory,
    productDetailPage,
    cartPage,
    checkoutStepOnePage,
    checkoutStepTwoPage,
    checkoutCompletePage,
    page,
  }) => {
    const product = products[3]; // Sauce Labs Fleece Jacket — $49.99

    await test.step(`Dado que abro la ficha de "${product.name}" desde el listado`, async () => {
      await loggedInInventory.openProductByName(product.name);
      await expect(page).toHaveURL(/inventory-item\.html/);
      expect(await productDetailPage.getName()).toBe(product.name);
      expect(await productDetailPage.getPrice()).toBe(product.price);
    });

    await test.step('Cuando lo agrego al carrito desde la ficha', async () => {
      await productDetailPage.addToCart();
      expect(await productDetailPage.getCartCount()).toBe(1);
    });

    await test.step('Entonces puedo completar la compra normalmente', async () => {
      await productDetailPage.openCart();
      await cartPage.checkout();
      await checkoutStepOnePage.fillAndContinue(
        checkoutCustomer.firstName,
        checkoutCustomer.lastName,
        checkoutCustomer.postalCode
      );
      expect(await checkoutStepTwoPage.getSubtotal()).toBe(product.price);

      await checkoutStepTwoPage.finish();
      await expect(checkoutCompletePage.completeHeader).toHaveText('Thank you for your order!');
    });
  });
});
