import { test, expect } from '@fixtures/pages.fixture';
import { products, checkoutCustomer } from '@data/testData';

/**
 * Escenarios de NEGOCIO: gestión del carrito antes de comprar.
 * Cubren el "arrepentimiento" del comprador: agregar, quitar, seguir
 * comprando y volver — flujos que en un e-commerce real generan abandono
 * si fallan.
 */
test.describe('Negocio - Gestión del carrito', () => {
  test('BN-04 - Como comprador, quito un producto del carrito y el total se ajusta', async ({
    loggedInInventory,
    cartPage,
  }) => {
    const [first, second] = [products[0], products[1]];

    await test.step('Dado que tengo dos productos en el carrito', async () => {
      await loggedInInventory.addToCart(first.slug);
      await loggedInInventory.addToCart(second.slug);
      await loggedInInventory.openCart();
      expect(await cartPage.itemCount()).toBe(2);
    });

    await test.step(`Cuando quito "${first.name}"`, async () => {
      await cartPage.removeItem(first.slug);
    });

    await test.step('Entonces solo queda el otro producto', async () => {
      expect(await cartPage.itemCount()).toBe(1);
      expect(await cartPage.getItemNames()).toEqual([second.name]);
      expect(await cartPage.getCartCount()).toBe(1);
    });
  });

  test('BN-05 - Como comprador, vacío el carrito por completo', async ({
    loggedInInventory,
    cartPage,
  }) => {
    await loggedInInventory.addToCart(products[0].slug);
    await loggedInInventory.addToCart(products[1].slug);
    await loggedInInventory.openCart();

    await cartPage.removeItem(products[0].slug);
    await cartPage.removeItem(products[1].slug);

    expect(await cartPage.itemCount()).toBe(0);
    expect(await cartPage.getCartCount()).toBe(0);
    await expect(cartPage.checkoutButton).toBeVisible();
  });

  test('BN-06 - Como comprador, uso "Continue Shopping" y vuelvo al listado sin perder el carrito', async ({
    loggedInInventory,
    cartPage,
    page,
  }) => {
    await loggedInInventory.addToCart(products[0].slug);
    await loggedInInventory.openCart();

    await cartPage.continueShopping();

    await expect(page).toHaveURL(/inventory\.html/);
    expect(await loggedInInventory.getCartCount()).toBe(1);
    await expect(loggedInInventory.removeButton(products[0].slug)).toBeVisible();
  });

  test('BN-07 - Como comprador, "Reset App State" vacía el carrito', async ({
    loggedInInventory,
  }) => {
    await loggedInInventory.addToCart(products[0].slug);
    await loggedInInventory.addToCart(products[2].slug);
    expect(await loggedInInventory.getCartCount()).toBe(2);

    await loggedInInventory.resetAppState();

    expect(await loggedInInventory.getCartCount()).toBe(0);
  });

  test('BN-08 - Como comprador, después de comprar vuelvo al listado con el carrito limpio', async ({
    loggedInInventory,
    cartPage,
    checkoutStepOnePage,
    checkoutStepTwoPage,
    checkoutCompletePage,
    page,
  }) => {
    await loggedInInventory.addToCart(products[0].slug);
    await loggedInInventory.openCart();
    await cartPage.checkout();
    await checkoutStepOnePage.fillAndContinue(
      checkoutCustomer.firstName,
      checkoutCustomer.lastName,
      checkoutCustomer.postalCode
    );
    await checkoutStepTwoPage.finish();

    await test.step('Cuando vuelvo al listado desde la pantalla de confirmación', async () => {
      await checkoutCompletePage.backHome();
    });

    await test.step('Entonces estoy en el inventario y el carrito quedó vacío', async () => {
      await expect(page).toHaveURL(/inventory\.html/);
      expect(await loggedInInventory.getCartCount()).toBe(0);
      await expect(loggedInInventory.addToCartButton(products[0].slug)).toBeVisible();
    });
  });
});
