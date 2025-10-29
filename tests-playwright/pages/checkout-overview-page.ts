import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

export class CheckoutOverviewPage extends BasePage {
  private readonly overviewContainer: Locator;
  private readonly cartItems: Locator;
  private readonly subtotalLabel: Locator;
  private readonly taxLabel: Locator;
  private readonly totalLabel: Locator;
  private readonly finishButton: Locator;
  private readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.overviewContainer = page.locator('#checkout_summary_container');
    this.cartItems = page.locator('.cart_item');
    this.subtotalLabel = page.locator('.summary_subtotal_label');
    this.taxLabel = page.locator('.summary_tax_label');
    this.totalLabel = page.locator('.summary_total_label');
    this.finishButton = page.locator('[data-test="finish"]');
    this.cancelButton = page.locator('[data-test="cancel"]');
  }

  async getCartItemsCount(): Promise<number> {
    return await this.cartItems.count();
  }

  async getItemTitle(index: number): Promise<string> {
    const item = this.cartItems.nth(index);
    const titleElement = item.locator('.inventory_item_name');
    return await this.getElementText(titleElement);
  }

  async getItemPrice(index: number): Promise<string> {
    const item = this.cartItems.nth(index);
    const priceElement = item.locator('.inventory_item_price');
    return await this.getElementText(priceElement);
  }

  async getSubtotal(): Promise<string> {
    return await this.getElementText(this.subtotalLabel);
  }

  async getTax(): Promise<string> {
    return await this.getElementText(this.taxLabel);
  }

  async getTotal(): Promise<string> {
    return await this.getElementText(this.totalLabel);
  }

  async finishOrder(): Promise<void> {
    try {
      await this.waitForElement(this.finishButton, 15000);
      await this.clickElement(this.finishButton);
    } catch (error) {
      console.log('Finish button not found or not clickable:', error);
      throw error;
    }
  }

  async cancelOrder(): Promise<void> {
    await this.clickElement(this.cancelButton);
  }

  async isOverviewPageLoaded(): Promise<boolean> {
    return await this.isElementVisible(this.overviewContainer);
  }
}
