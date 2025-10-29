import { test, expect } from './fixtures/test-fixtures';
import { USERS } from './fixtures/test-data';

test.describe('Shopping Cart Tests', () => {
  test.beforeEach(async ({ pages }) => {
    await pages.loginPage.goto('/');
    await pages.loginPage.login(USERS.STANDARD);
    
    // Add items to cart
    await pages.inventoryPage.addItemToCart(0);
    await pages.inventoryPage.addItemToCart(1);
    await pages.inventoryPage.goToCart();
  });

  test('should display cart items', async ({ pages }) => {
    await expect(pages.cartPage.pageInstance.locator('#cart_contents_container')).toBeVisible();
    
    const itemsCount = await pages.cartPage.getCartItemsCount();
    expect(itemsCount).toBe(2);
  });

  test('should display correct item details in cart', async ({ pages }) => {
    const firstItemTitle = await pages.cartPage.getItemTitle(0);
    const firstItemPrice = await pages.cartPage.getItemPrice(0);
    const firstItemQuantity = await pages.cartPage.getItemQuantity(0);
    
    expect(firstItemTitle).toBeTruthy();
    expect(firstItemPrice).toBeTruthy();
    expect(firstItemQuantity).toBe('1');
  });

  test('should remove item from cart', async ({ pages }) => {
    const initialItemsCount = await pages.cartPage.getCartItemsCount();
    
    await pages.cartPage.removeItem(0);
    
    const newItemsCount = await pages.cartPage.getCartItemsCount();
    expect(newItemsCount).toBe(initialItemsCount - 1);
  });

  test('should continue shopping', async ({ pages }) => {
    await pages.cartPage.continueShopping();
    
    await expect(pages.inventoryPage.pageInstance).toHaveURL(/.*inventory/);
    await expect(pages.inventoryPage.pageInstance.locator('.inventory_container')).toBeVisible();
  });

  test('should proceed to checkout', async ({ pages }) => {
    await pages.cartPage.proceedToCheckout();
    
    await expect(pages.checkoutPage.pageInstance).toHaveURL(/.*checkout-step-one/);
    await expect(pages.checkoutPage.pageInstance.locator('#checkout_info_container')).toBeVisible();
  });

  test('should handle empty cart', async ({ pages }) => {
    // Remove all items
    await pages.cartPage.removeItem(0);
    await pages.cartPage.removeItem(0);
    
    const isEmpty = await pages.cartPage.isCartEmpty();
    expect(isEmpty).toBe(true);
  });
});
