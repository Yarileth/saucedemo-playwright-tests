import { Page, Locator, expect } from '@playwright/test';

/**
 * Comportamiento común a todas las páginas autenticadas: header, menú lateral
 * y acceso al carrito.
 *
 * Todos los locators usan `getByTestId()`, que resuelve contra el atributo
 * `data-test` (configurado en playwright.config.ts). saucedemo.com expone
 * estos atributos de forma consistente, así que la suite no depende de
 * clases CSS ni de la estructura del DOM.
 */
export class BasePage {
  readonly pageTitle: Locator;
  readonly cartLink: Locator;
  readonly cartBadge: Locator;
  readonly menuButton: Locator;
  readonly closeMenuButton: Locator;
  readonly logoutLink: Locator;
  readonly resetAppStateLink: Locator;
  readonly allItemsLink: Locator;
  readonly aboutLink: Locator;

  constructor(readonly page: Page) {
    this.pageTitle = page.getByTestId('title');
    this.cartLink = page.getByTestId('shopping-cart-link');
    this.cartBadge = page.getByTestId('shopping-cart-badge');
    // OJO: `data-test="open-menu"` / `data-test="close-menu"` NO están en los
    // botones, sino en las <img> decorativas del ícono. El botón real que
    // recibe el clic es un hermano posicionado por encima
    // (react-burger-menu), así que clickear el testid falla con un timeout:
    // Playwright detecta que otro elemento intercepta el puntero.
    // Por eso acá, y solo acá, usamos el id del botón real.
    // Detectado al correr la suite en CI, no en la revisión de código.
    this.menuButton = page.locator('#react-burger-menu-btn');
    this.closeMenuButton = page.locator('#react-burger-cross-btn');
    this.logoutLink = page.getByTestId('logout-sidebar-link');
    this.resetAppStateLink = page.getByTestId('reset-sidebar-link');
    this.allItemsLink = page.getByTestId('inventory-sidebar-link');
    this.aboutLink = page.getByTestId('about-sidebar-link');
  }

  async getTitleText(): Promise<string> {
    return (await this.pageTitle.textContent())?.trim() ?? '';
  }

  /**
   * Cantidad de ítems indicada por el badge del carrito.
   * Devuelve 0 cuando el badge no está presente, que es cómo el sitio
   * representa un carrito vacío (no muestra un "0").
   */
  async getCartCount(): Promise<number> {
    if (!(await this.cartBadge.isVisible().catch(() => false))) return 0;
    return Number.parseInt((await this.cartBadge.textContent()) ?? '0', 10);
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }

  async openMenu(): Promise<void> {
    await this.menuButton.click();
    await expect(this.logoutLink).toBeVisible();
  }

  async logout(): Promise<void> {
    await this.openMenu();
    await this.logoutLink.click();
  }

  /**
   * Restablece el estado de la aplicación (vacía el carrito).
   * saucedemo.com persiste el carrito en cookies, así que este helper es
   * útil como limpieza explícita; de todos modos cada test de Playwright
   * corre en un contexto de navegador aislado.
   */
  async resetAppState(): Promise<void> {
    await this.openMenu();
    await this.resetAppStateLink.click();
    await this.closeMenuButton.click();
  }
}
