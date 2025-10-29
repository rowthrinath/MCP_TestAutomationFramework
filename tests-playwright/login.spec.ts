import { test, expect } from './fixtures/test-fixtures';
import { USERS } from './fixtures/test-data';

test.describe('Login Tests', () => {
  test.beforeEach(async ({ pages }) => {
    await pages.loginPage.goto('/');
  });

  test('should display login page elements', async ({ pages }) => {
    await expect(pages.loginPage.pageInstance.locator('#user-name')).toBeVisible();
    await expect(pages.loginPage.pageInstance.locator('#password')).toBeVisible();
    await expect(pages.loginPage.pageInstance.locator('#login-button')).toBeVisible();
  });

  test('should login successfully with standard user', async ({ pages }) => {
    await pages.loginPage.login(USERS.STANDARD);
    await expect(pages.loginPage.pageInstance).toHaveURL(/.*inventory/);
    await expect(pages.inventoryPage.pageInstance.locator('.inventory_container')).toBeVisible();
  });

  test('should fail login with locked out user', async ({ pages }) => {
    await pages.loginPage.login(USERS.LOCKED_OUT);
    await expect(pages.loginPage.pageInstance).toHaveURL(/.*\/$/);
    await expect(pages.loginPage.isErrorMessageVisible()).resolves.toBe(true);
    
    const errorMessage = await pages.loginPage.getErrorMessage();
    expect(errorMessage).toContain('locked out');
  });

  test('should login successfully with problem user', async ({ pages }) => {
    await pages.loginPage.login(USERS.PROBLEM);
    await expect(pages.loginPage.pageInstance).toHaveURL(/.*inventory/);
    await expect(pages.inventoryPage.pageInstance.locator('.inventory_container')).toBeVisible();
  });

  test('should login successfully with performance glitch user', async ({ pages }) => {
    await pages.loginPage.login(USERS.PERFORMANCE_GLITCH);
    await expect(pages.loginPage.pageInstance).toHaveURL(/.*inventory/);
    await expect(pages.inventoryPage.pageInstance.locator('.inventory_container')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ pages }) => {
    await pages.loginPage.login({
      username: 'invalid_user',
      password: 'invalid_password',
      description: 'Invalid user'
    });
    
    await expect(pages.loginPage.pageInstance).toHaveURL(/.*\/$/);
    await expect(pages.loginPage.isErrorMessageVisible()).resolves.toBe(true);
    
    const errorMessage = await pages.loginPage.getErrorMessage();
    expect(errorMessage).toContain('Username and password do not match');
  });

  test('should show error for empty username', async ({ pages }) => {
    await pages.loginPage.fillInput(pages.loginPage.pageInstance.locator('#password'), 'secret_sauce');
    await pages.loginPage.clickElement(pages.loginPage.pageInstance.locator('#login-button'));
    
    await expect(pages.loginPage.isErrorMessageVisible()).resolves.toBe(true);
    
    const errorMessage = await pages.loginPage.getErrorMessage();
    expect(errorMessage).toContain('Username is required');
  });

  test('should show error for empty password', async ({ pages }) => {
    await pages.loginPage.fillInput(pages.loginPage.pageInstance.locator('#user-name'), 'standard_user');
    await pages.loginPage.clickElement(pages.loginPage.pageInstance.locator('#login-button'));
    
    await expect(pages.loginPage.isErrorMessageVisible()).resolves.toBe(true);
    
    const errorMessage = await pages.loginPage.getErrorMessage();
    expect(errorMessage).toContain('Password is required');
  });

  test('should clear form fields', async ({ pages }) => {
    await pages.loginPage.fillInput(pages.loginPage.pageInstance.locator('#user-name'), 'test_user');
    await pages.loginPage.fillInput(pages.loginPage.pageInstance.locator('#password'), 'test_password');
    
    await pages.loginPage.clearForm();
    
    await expect(pages.loginPage.pageInstance.locator('#user-name')).toHaveValue('');
    await expect(pages.loginPage.pageInstance.locator('#password')).toHaveValue('');
  });

  test('should logout successfully', async ({ pages }) => {
    await pages.loginPage.login(USERS.STANDARD);
    await pages.inventoryPage.logout();
    
    await expect(pages.loginPage.pageInstance).toHaveURL(/.*\/$/);
    await expect(pages.loginPage.pageInstance.locator('#login-button')).toBeVisible();
  });
});
