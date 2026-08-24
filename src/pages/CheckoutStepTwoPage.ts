import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { parsePrice } from '@utils/helpers';

/** Checkout paso 2: resumen y totales (`/checkout-step-two.html`). */
export class CheckoutStepTwoPage extends BasePage {
  readonly cartItems: Locator;
  readonly itemNames: Locator;
  readonly itemPrices: Locator;
  readonly paymentInfo: Locator;
  readonly shippingInfo: Locator;
  readonly subtotalLabel: Locator;
  readonly taxLabel: Locator;
  readonly totalLabel: Locator;
  readonly finishButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.cartItems = page.getByTestId('inventory-item');
    this.itemNames = page.getByTestId('inventory-item-name');
    this.itemPrices = page.getByTestId('inventory-item-price');
    this.paymentInfo = page.getByTestId('payment-info-value');
    this.shippingInfo = page.getByTestId('shipping-info-value');
    this.subtotalLabel = page.getByTestId('subtotal-label');
    this.taxLabel = page.getByTestId('tax-label');
    this.totalLabel = page.getByTestId('total-label');
    this.finishButton = page.getByTestId('finish');
    this.cancelButton = page.getByTestId('cancel');
  }

  /** Subtotal ("Item total: $39.98") como número. */
  async getSubtotal(): Promise<number> {
    return parsePrice((await this.subtotalLabel.textContent()) ?? '');
  }

  /** Impuesto ("Tax: $3.20") como número. */
  async getTax(): Promise<number> {
    return parsePrice((await this.taxLabel.textContent()) ?? '');
  }

  /** Total ("Total: $43.18") como número. */
  async getTotal(): Promise<number> {
    return parsePrice((await this.totalLabel.textContent()) ?? '');
  }

  async getItemNames(): Promise<string[]> {
    return (await this.itemNames.allTextContents()).map((t) => t.trim());
  }

  async getItemPrices(): Promise<number[]> {
    return (await this.itemPrices.allTextContents()).map(parsePrice);
  }

  async finish(): Promise<void> {
    await this.finishButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
