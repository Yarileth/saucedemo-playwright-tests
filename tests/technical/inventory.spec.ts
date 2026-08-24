import { test, expect } from '@fixtures/pages.fixture';
import { products, EXPECTED_PRODUCT_COUNT, sortOptions } from '@data/testData';
import { isAscending, isDescending, isSortedAlphaAsc, isSortedAlphaDesc } from '@utils/helpers';

/**
 * Escenarios TÉCNICOS del listado de productos.
 *
 * Técnica de diseño principal: TABLA DE DECISIÓN sobre el combo de
 * ordenamiento — cada opción del select (az / za / lohi / hilo) tiene un
 * resultado esperado determinado, y se cubren las cuatro combinaciones.
 */
test.describe('Técnico - Listado de productos', () => {
  test('TC-12 - El inventario muestra exactamente los 6 productos del catálogo @smoke', async ({
    loggedInInventory,
  }) => {
    expect(await loggedInInventory.itemCount()).toBe(EXPECTED_PRODUCT_COUNT);

    const names = await loggedInInventory.getProductNames();
    for (const product of products) {
      expect(names).toContain(product.name);
    }
  });

  test('TC-13 - Cada producto muestra el precio esperado del catálogo', async ({
    loggedInInventory,
  }) => {
    const names = await loggedInInventory.getProductNames();
    const prices = await loggedInInventory.getProductPrices();

    for (const [index, name] of names.entries()) {
      const expected = products.find((p) => p.name === name);
      expect(expected, `Producto inesperado en el listado: ${name}`).toBeDefined();
      expect(prices[index], `Precio incorrecto para ${name}`).toBe(expected!.price);
    }
  });

  test('TC-14 - Orden por nombre A→Z', async ({ loggedInInventory }) => {
    await loggedInInventory.sortBy(sortOptions.nameAsc);
    expect(isSortedAlphaAsc(await loggedInInventory.getProductNames())).toBeTruthy();
  });

  test('TC-15 - Orden por nombre Z→A', async ({ loggedInInventory }) => {
    await loggedInInventory.sortBy(sortOptions.nameDesc);
    expect(isSortedAlphaDesc(await loggedInInventory.getProductNames())).toBeTruthy();
  });

  test('TC-16 - Orden por precio de menor a mayor', async ({ loggedInInventory }) => {
    await loggedInInventory.sortBy(sortOptions.priceAsc);
    expect(isAscending(await loggedInInventory.getProductPrices())).toBeTruthy();
  });

  test('TC-17 - Orden por precio de mayor a menor', async ({ loggedInInventory }) => {
    await loggedInInventory.sortBy(sortOptions.priceDesc);
    expect(isDescending(await loggedInInventory.getProductPrices())).toBeTruthy();
  });

  test('TC-18 - El botón cambia a "Remove" al agregar y vuelve a "Add to cart" al quitar', async ({
    loggedInInventory,
  }) => {
    const { slug } = products[0];

    await expect(loggedInInventory.addToCartButton(slug)).toBeVisible();
    await loggedInInventory.addToCart(slug);

    await expect(loggedInInventory.removeButton(slug)).toBeVisible();
    await expect(loggedInInventory.addToCartButton(slug)).not.toBeVisible();

    await loggedInInventory.removeFromCart(slug);
    await expect(loggedInInventory.addToCartButton(slug)).toBeVisible();
  });

  test('TC-19 - El badge del carrito refleja la cantidad de productos agregados', async ({
    loggedInInventory,
  }) => {
    expect(await loggedInInventory.getCartCount()).toBe(0);

    await loggedInInventory.addToCart(products[0].slug);
    expect(await loggedInInventory.getCartCount()).toBe(1);

    await loggedInInventory.addToCart(products[1].slug);
    expect(await loggedInInventory.getCartCount()).toBe(2);

    await loggedInInventory.removeFromCart(products[0].slug);
    expect(await loggedInInventory.getCartCount()).toBe(1);
  });

  test('TC-20 - El carrito persiste al navegar entre secciones', async ({
    loggedInInventory,
    productDetailPage,
  }) => {
    await loggedInInventory.addToCart(products[0].slug);
    expect(await loggedInInventory.getCartCount()).toBe(1);

    await productDetailPage.gotoById(products[2].id);
    expect(await productDetailPage.getCartCount()).toBe(1);

    await productDetailPage.backToProducts();
    expect(await loggedInInventory.getCartCount()).toBe(1);
  });
});
