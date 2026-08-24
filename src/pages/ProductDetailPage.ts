import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { parsePrice } from '@utils/helpers';

/**
 * Ficha de producto (`/inventory-item.html?id=N`).
 * A diferencia del listado, acá los botones usan `data-test` genéricos
 * (`add-to-cart` / `remove`), porque hay un solo producto en pantalla.
 */
export class ProductDetailPage extends BasePage {
  readonly name: Locator;
  readonly description: Locator;
  readonly price: Locator;
  readonly addToCartButton: Locator;
  readonly removeButton: Locator;
  readonly backToProductsButton: Locator;

  constructor(page: Page) {
    super(page);
    this.name = page.getByTestId('inventory-item-name');
    this.description = page.getByTestId('inventory-item-desc');
    this.price = page.getByTestId('inventory-item-price');
    this.addToCartButton = page.getByTestId('add-to-cart');
    this.removeButton = page.getByTestId('remove');
    this.backToProductsButton = page.getByTestId('back-to-products');
  }

  async gotoById(id: number): Promise<void> {
    await this.page.goto(`/inventory-item.html?id=${id}`);
  }

  async getName(): Promise<string> {
    return (await this.name.textContent())?.trim() ?? '';
  }

  async getPrice(): Promise<number> {
    return parsePrice((await this.price.textContent()) ?? '');
  }

  async addToCart(): Promise<void> {
    await this.addToCartButton.click();
  }

  async backToProducts(): Promise<void> {
    await this.backToProductsButton.click();
  }
}
