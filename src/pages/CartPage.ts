import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { parsePrice } from '@utils/helpers';

/** Carrito de compras (`/cart.html`). */
export class CartPage extends BasePage {
  readonly cartList: Locator;
  readonly cartItems: Locator;
  readonly itemNames: Locator;
  readonly itemPrices: Locator;
  readonly itemQuantities: Locator;
  readonly continueShoppingButton: Locator;
  readonly checkoutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.cartList = page.getByTestId('cart-list');
    this.cartItems = page.getByTestId('inventory-item');
    this.itemNames = page.getByTestId('inventory-item-name');
    this.itemPrices = page.getByTestId('inventory-item-price');
    this.itemQuantities = page.getByTestId('item-quantity');
    this.continueShoppingButton = page.getByTestId('continue-shopping');
    this.checkoutButton = page.getByTestId('checkout');
  }

  async goto(): Promise<void> {
    await this.page.goto('/cart.html');
  }

  async itemCount(): Promise<number> {
    return this.cartItems.count();
  }

  async getItemNames(): Promise<string[]> {
    return (await this.itemNames.allTextContents()).map((t) => t.trim());
  }

  async getItemPrices(): Promise<number[]> {
    return (await this.itemPrices.allTextContents()).map(parsePrice);
  }

  async getQuantities(): Promise<number[]> {
    return (await this.itemQuantities.allTextContents()).map((t) => Number.parseInt(t.trim(), 10));
  }

  removeButton(slug: string): Locator {
    return this.page.getByTestId(`remove-${slug}`);
  }

  async removeItem(slug: string): Promise<void> {
    await this.removeButton(slug).click();
  }

  async checkout(): Promise<void> {
    await this.checkoutButton.click();
  }

  async continueShopping(): Promise<void> {
    await this.continueShoppingButton.click();
  }
}
