import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { parsePrice } from '@utils/helpers';

/** Listado de productos (post-login). */
export class InventoryPage extends BasePage {
  readonly inventoryList: Locator;
  readonly inventoryItems: Locator;
  readonly itemNames: Locator;
  readonly itemPrices: Locator;
  readonly sortDropdown: Locator;
  readonly productImages: Locator;

  constructor(page: Page) {
    super(page);
    this.inventoryList = page.getByTestId('inventory-list');
    this.inventoryItems = page.getByTestId('inventory-item');
    this.itemNames = page.getByTestId('inventory-item-name');
    this.itemPrices = page.getByTestId('inventory-item-price');
    this.sortDropdown = page.getByTestId('product-sort-container');
    this.productImages = page.locator('.inventory_item_img img');
  }

  async goto(): Promise<void> {
    await this.page.goto('/inventory.html');
  }

  async itemCount(): Promise<number> {
    return this.inventoryItems.count();
  }

  async getProductNames(): Promise<string[]> {
    return (await this.itemNames.allTextContents()).map((t) => t.trim());
  }

  async getProductPrices(): Promise<number[]> {
    return (await this.itemPrices.allTextContents()).map(parsePrice);
  }

  addToCartButton(slug: string): Locator {
    return this.page.getByTestId(`add-to-cart-${slug}`);
  }

  removeButton(slug: string): Locator {
    return this.page.getByTestId(`remove-${slug}`);
  }

  async addToCart(slug: string): Promise<void> {
    await this.addToCartButton(slug).click();
  }

  async removeFromCart(slug: string): Promise<void> {
    await this.removeButton(slug).click();
  }

  async sortBy(optionValue: string): Promise<void> {
    await this.sortDropdown.selectOption(optionValue);
  }

  async openProductByName(name: string): Promise<void> {
    await this.itemNames.filter({ hasText: name }).first().click();
  }

  /** `src` de todas las imágenes de producto — usado para detectar imágenes rotas. */
  async getImageSources(): Promise<string[]> {
    return this.productImages.evaluateAll((imgs) =>
      imgs.map((img) => (img as HTMLImageElement).getAttribute('src') ?? '')
    );
  }
}
