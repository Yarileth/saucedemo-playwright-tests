import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/** Confirmación de compra (`/checkout-complete.html`). */
export class CheckoutCompletePage extends BasePage {
  readonly completeHeader: Locator;
  readonly completeText: Locator;
  readonly ponyExpressImage: Locator;
  readonly backHomeButton: Locator;

  constructor(page: Page) {
    super(page);
    this.completeHeader = page.getByTestId('complete-header');
    this.completeText = page.getByTestId('complete-text');
    this.ponyExpressImage = page.getByTestId('pony-express');
    this.backHomeButton = page.getByTestId('back-to-products');
  }

  async getHeaderText(): Promise<string> {
    return (await this.completeHeader.textContent())?.trim() ?? '';
  }

  async backHome(): Promise<void> {
    await this.backHomeButton.click();
  }
}
