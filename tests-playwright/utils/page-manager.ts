import { Page } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { InventoryPage } from '../pages/inventory-page';
import { CartPage } from '../pages/cart-page';
import { CheckoutPage } from '../pages/checkout-page';
import { CheckoutOverviewPage } from '../pages/checkout-overview-page';
import { CheckoutCompletePage } from '../pages/checkout-complete-page';

export class PageManager {
  public loginPage: LoginPage;
  public inventoryPage: InventoryPage;
  public cartPage: CartPage;
  public checkoutPage: CheckoutPage;
  public checkoutOverviewPage: CheckoutOverviewPage;
  public checkoutCompletePage: CheckoutCompletePage;

  constructor(page: Page) {
    this.loginPage = new LoginPage(page);
    this.inventoryPage = new InventoryPage(page);
    this.cartPage = new CartPage(page);
    this.checkoutPage = new CheckoutPage(page);
    this.checkoutOverviewPage = new CheckoutOverviewPage(page);
    this.checkoutCompletePage = new CheckoutCompletePage(page);
  }
}
