import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

export class InventoryPage extends BasePage {
  private readonly inventoryContainer: Locator;
  private readonly inventoryItems: Locator;
  private readonly shoppingCartBadge: Locator;
  private readonly shoppingCartLink: Locator;
  private readonly sortDropdown: Locator;
  private readonly menuButton: Locator;
  private readonly logoutLink: Locator;

  constructor(page: Page) {
    super(page);
    this.inventoryContainer = page.locator('#inventory_container');
    this.inventoryItems = page.locator('.inventory_item');
    this.shoppingCartBadge = page.locator('.shopping_cart_badge');
    this.shoppingCartLink = page.locator('.shopping_cart_link');
    this.sortDropdown = page.locator('[data-test="product_sort_container"]');
    this.menuButton = page.locator('#react-burger-menu-btn');
    this.logoutLink = page.locator('#logout_sidebar_link');
  }

  async getInventoryItemsCount(): Promise<number> {
    return await this.inventoryItems.count();
  }

  async getItemTitle(index: number): Promise<string> {
    const item = this.inventoryItems.nth(index);
    const titleElement = item.locator('.inventory_item_name');
    return await this.getElementText(titleElement);
  }

  async getItemPrice(index: number): Promise<string> {
    const item = this.inventoryItems.nth(index);
    const priceElement = item.locator('.inventory_item_price');
    return await this.getElementText(priceElement);
  }

  async getItemImage(index: number): Promise<string> {
    const item = this.inventoryItems.nth(index);
    const imageElement = item.locator('.inventory_item_img img');
    return await imageElement.getAttribute('src') || '';
  }

  async addItemToCart(index: number): Promise<void> {
    const item = this.inventoryItems.nth(index);
    const addToCartButton = item.locator('button');
    await this.clickElement(addToCartButton);
  }

  async removeItemFromCart(index: number): Promise<void> {
    const item = this.inventoryItems.nth(index);
    const removeButton = item.locator('button');
    await this.clickElement(removeButton);
  }

  async getCartItemsCount(): Promise<number> {
    try {
      const isBadgeVisible = await this.isElementVisible(this.shoppingCartBadge);
      if (!isBadgeVisible) {
        return 0;
      }
      const badgeText = await this.getElementText(this.shoppingCartBadge);
      return badgeText ? parseInt(badgeText) : 0;
    } catch {
      return 0;
    }
  }

  async goToCart(): Promise<void> {
    await this.clickElement(this.shoppingCartLink);
  }

  async sortBy(sortOption: string): Promise<void> {
    try {
      await this.waitForElement(this.sortDropdown, 15000);
      await this.selectOption(this.sortDropdown, sortOption);
    } catch (error) {
      console.log(`Sort dropdown not found or not clickable: ${error}`);
      throw error;
    }
  }

  async logout(): Promise<void> {
    await this.clickElement(this.menuButton);
    await this.clickElement(this.logoutLink);
  }

  async isInventoryPageLoaded(): Promise<boolean> {
    return await this.isElementVisible(this.inventoryContainer);
  }

  async getItemButtonText(index: number): Promise<string> {
    const item = this.inventoryItems.nth(index);
    const button = item.locator('button');
    return await this.getElementText(button);
  }

  async isItemImageBroken(index: number): Promise<boolean> {
    const item = this.inventoryItems.nth(index);
    const imageElement = item.locator('.inventory_item_img img');
    
    try {
      await this.waitForElement(imageElement, 5000);
      
      // Check if image has loaded properly
      const isLoaded = await imageElement.evaluate((img: HTMLImageElement) => {
        return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
      });
      
      return !isLoaded;
    } catch {
      return true;
    }
  }
}
