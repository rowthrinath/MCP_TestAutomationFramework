using Microsoft.Playwright;
using Tests.CSharp.Pages;

namespace Tests.CSharp.Pages;

public class CartPage : BasePage
{
    private readonly ILocator _cartContainer;
    private readonly ILocator _cartItems;
    private readonly ILocator _checkoutButton;
    private readonly ILocator _continueShoppingButton;
    private readonly ILocator _removeButtons;

    public CartPage(IPage page) : base(page)
    {
        _cartContainer = Page.Locator("#cart_contents_container");
        _cartItems = Page.Locator(".cart_item");
        _checkoutButton = Page.Locator("[data-test='checkout']");
        _continueShoppingButton = Page.Locator("[data-test='continue-shopping']");
        _removeButtons = Page.Locator("[data-test*='remove-']");
    }

    public async Task<int> GetCartItemsCountAsync()
    {
        return await _cartItems.CountAsync();
    }

    public async Task<string> GetItemTitleAsync(int index)
    {
        var item = _cartItems.Nth(index);
        var titleElement = item.Locator(".inventory_item_name");
        return await GetElementTextAsync(titleElement);
    }

    public async Task<string> GetItemPriceAsync(int index)
    {
        var item = _cartItems.Nth(index);
        var priceElement = item.Locator(".inventory_item_price");
        return await GetElementTextAsync(priceElement);
    }

    public async Task<string> GetItemQuantityAsync(int index)
    {
        var item = _cartItems.Nth(index);
        var quantityElement = item.Locator(".cart_quantity");
        return await GetElementTextAsync(quantityElement);
    }

    public async Task RemoveItemAsync(int index)
    {
        var removeButton = _removeButtons.Nth(index);
        await ClickElementAsync(removeButton);
    }

    public async Task ProceedToCheckoutAsync()
    {
        await ClickElementAsync(_checkoutButton);
    }

    public async Task ContinueShoppingAsync()
    {
        await ClickElementAsync(_continueShoppingButton);
    }

    public async Task<bool> IsCartPageLoadedAsync()
    {
        return await IsElementVisibleAsync(_cartContainer);
    }

    public async Task<bool> IsCartEmptyAsync()
    {
        return await GetCartItemsCountAsync() == 0;
    }
}

