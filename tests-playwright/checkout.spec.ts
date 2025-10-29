import { test, expect } from './fixtures/test-fixtures';
import { USERS } from './fixtures/test-data';

test.describe('Checkout Flow Tests', () => {
  test.beforeEach(async ({ pages }) => {
    await pages.loginPage.goto('/');
    await pages.loginPage.login(USERS.STANDARD);
    
    // Add items to cart and proceed to checkout
    await pages.inventoryPage.addItemToCart(0);
    await pages.inventoryPage.addItemToCart(1);
    await pages.inventoryPage.goToCart();
    await pages.cartPage.proceedToCheckout();
  });

  test('should display checkout form', async ({ pages }) => {
    await expect(pages.checkoutPage.pageInstance.locator('#checkout_info_container')).toBeVisible();
    await expect(pages.checkoutPage.pageInstance.locator('[data-test="firstName"]')).toBeVisible();
    await expect(pages.checkoutPage.pageInstance.locator('[data-test="lastName"]')).toBeVisible();
    await expect(pages.checkoutPage.pageInstance.locator('[data-test="postalCode"]')).toBeVisible();
  });

  test('should complete checkout with valid information', async ({ pages }) => {
    await pages.checkoutPage.fillCheckoutInfo('John', 'Doe', '12345');
    await pages.checkoutPage.continueToOverview();
    
    await expect(pages.checkoutOverviewPage.pageInstance).toHaveURL(/.*checkout-step-two/);
    await expect(pages.checkoutOverviewPage.pageInstance.locator('#checkout_summary_container')).toBeVisible();
  });

  test('should show error for empty first name', async ({ pages }) => {
    await pages.checkoutPage.fillCheckoutInfo('', 'Doe', '12345');
    await pages.checkoutPage.continueToOverview();
    
    await expect(pages.checkoutPage.isErrorMessageVisible()).resolves.toBe(true);
    
    const errorMessage = await pages.checkoutPage.getErrorMessage();
    expect(errorMessage).toContain('First Name is required');
  });

  test('should show error for empty last name', async ({ pages }) => {
    await pages.checkoutPage.fillCheckoutInfo('John', '', '12345');
    await pages.checkoutPage.continueToOverview();
    
    await expect(pages.checkoutPage.isErrorMessageVisible()).resolves.toBe(true);
    
    const errorMessage = await pages.checkoutPage.getErrorMessage();
    expect(errorMessage).toContain('Last Name is required');
  });

  test('should show error for empty postal code', async ({ pages }) => {
    await pages.checkoutPage.fillCheckoutInfo('John', 'Doe', '');
    await pages.checkoutPage.continueToOverview();
    
    await expect(pages.checkoutPage.isErrorMessageVisible()).resolves.toBe(true);
    
    const errorMessage = await pages.checkoutPage.getErrorMessage();
    expect(errorMessage).toContain('Postal Code is required');
  });

  test('should cancel checkout', async ({ pages }) => {
    await pages.checkoutPage.cancelCheckout();
    
    await expect(pages.cartPage.pageInstance).toHaveURL(/.*cart/);
    await expect(pages.cartPage.pageInstance.locator('#cart_contents_container')).toBeVisible();
  });

  test('should display checkout overview with correct information', async ({ pages }) => {
    await pages.checkoutPage.fillCheckoutInfo('John', 'Doe', '12345');
    await pages.checkoutPage.continueToOverview();
    
    const itemsCount = await pages.checkoutOverviewPage.getCartItemsCount();
    expect(itemsCount).toBe(2);
    
    const subtotal = await pages.checkoutOverviewPage.getSubtotal();
    const tax = await pages.checkoutOverviewPage.getTax();
    const total = await pages.checkoutOverviewPage.getTotal();
    
    expect(subtotal).toMatch(/Item total: \$\d+\.\d{2}/);
    expect(tax).toMatch(/Tax: \$\d+\.\d{2}/);
    expect(total).toMatch(/Total: \$\d+\.\d{2}/);
  });

  test('should complete order successfully', async ({ pages }) => {
    await pages.checkoutPage.fillCheckoutInfo('John', 'Doe', '12345');
    await pages.checkoutPage.continueToOverview();
    await pages.checkoutOverviewPage.finishOrder();
    
    await expect(pages.checkoutCompletePage.pageInstance).toHaveURL(/.*checkout-complete/);
    await expect(pages.checkoutCompletePage.pageInstance.locator('#checkout_complete_container')).toBeVisible();
    
    const completeHeader = await pages.checkoutCompletePage.getCompleteHeader();
    expect(completeHeader).toBe('Thank you for your order!');
  });

  test('should navigate back to products from complete page', async ({ pages }) => {
    await pages.checkoutPage.fillCheckoutInfo('John', 'Doe', '12345');
    await pages.checkoutPage.continueToOverview();
    await pages.checkoutOverviewPage.finishOrder();
    await pages.checkoutCompletePage.backToProducts();
    
    await expect(pages.inventoryPage.pageInstance).toHaveURL(/.*inventory/);
    await expect(pages.inventoryPage.pageInstance.locator('.inventory_container')).toBeVisible();
  });

  test('should cancel order from overview page', async ({ pages }) => {
    await pages.checkoutPage.fillCheckoutInfo('John', 'Doe', '12345');
    await pages.checkoutPage.continueToOverview();
    await pages.checkoutOverviewPage.cancelOrder();
    
    await expect(pages.inventoryPage.pageInstance).toHaveURL(/.*inventory/);
    await expect(pages.inventoryPage.pageInstance.locator('.inventory_container')).toBeVisible();
  });
});
