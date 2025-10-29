import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

export class CartPage extends BasePage {
  private readonly cartContainer: Locator;
  private readonly cartItems: Locator;
  private readonly checkoutButton: Locator;
  private readonly continueShoppingButton: Locator;
  private readonly removeButtons: Locator;

  constructor(page: Page) {
    super(page);
    this.cartContainer = page.locator('#cart_contents_container');
    this.cartItems = page.locator('.cart_item');
    this.checkoutButton = page.locator('[data-test="checkout"]');
    this.continueShoppingButton = page.locator('[data-test="continue-shopping"]');
    this.removeButtons = page.locator('[data-test*="remove-"]');
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

  async getItemQuantity(index: number): Promise<string> {
    const item = this.cartItems.nth(index);
    const quantityElement = item.locator('.cart_quantity');
    return await this.getElementText(quantityElement);
  }

  async removeItem(index: number): Promise<void> {
    const removeButton = this.removeButtons.nth(index);
    await this.clickElement(removeButton);
  }

  async proceedToCheckout(): Promise<void> {
    await this.clickElement(this.checkoutButton);
  }

  async continueShopping(): Promise<void> {
    await this.clickElement(this.continueShoppingButton);
  }

  async isCartPageLoaded(): Promise<boolean> {
    return await this.isElementVisible(this.cartContainer);
  }

  async isCartEmpty(): Promise<boolean> {
    return await this.getCartItemsCount() === 0;
  }
}
