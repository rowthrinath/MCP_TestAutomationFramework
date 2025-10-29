import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

export class CheckoutCompletePage extends BasePage {
  private readonly completeContainer: Locator;
  private readonly completeHeader: Locator;
  private readonly completeText: Locator;
  private readonly backHomeButton: Locator;

  constructor(page: Page) {
    super(page);
    this.completeContainer = page.locator('#checkout_complete_container');
    this.completeHeader = page.locator('.complete-header');
    this.completeText = page.locator('.complete-text');
    this.backHomeButton = page.locator('[data-test="back-to-products"]');
  }

  async getCompleteHeader(): Promise<string> {
    return await this.getElementText(this.completeHeader);
  }

  async getCompleteText(): Promise<string> {
    return await this.getElementText(this.completeText);
  }

  async backToProducts(): Promise<void> {
    await this.clickElement(this.backHomeButton);
  }

  async isCompletePageLoaded(): Promise<boolean> {
    return await this.isElementVisible(this.completeContainer);
  }
}
