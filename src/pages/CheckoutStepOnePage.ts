import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/** Checkout paso 1: datos del comprador (`/checkout-step-one.html`). */
export class CheckoutStepOnePage extends BasePage {
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly postalCodeInput: Locator;
  readonly continueButton: Locator;
  readonly cancelButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.firstNameInput = page.getByTestId('firstName');
    this.lastNameInput = page.getByTestId('lastName');
    this.postalCodeInput = page.getByTestId('postalCode');
    this.continueButton = page.getByTestId('continue');
    this.cancelButton = page.getByTestId('cancel');
    this.errorMessage = page.getByTestId('error');
  }

  async goto(): Promise<void> {
    await this.page.goto('/checkout-step-one.html');
  }

  async fillForm(firstName: string, lastName: string, postalCode: string): Promise<void> {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.postalCodeInput.fill(postalCode);
  }

  async submit(): Promise<void> {
    await this.continueButton.click();
  }

  async fillAndContinue(firstName: string, lastName: string, postalCode: string): Promise<void> {
    await this.fillForm(firstName, lastName, postalCode);
    await this.submit();
  }

  async getErrorText(): Promise<string> {
    return (await this.errorMessage.textContent())?.trim() ?? '';
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
