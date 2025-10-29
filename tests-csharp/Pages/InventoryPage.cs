using Microsoft.Playwright;
using Tests.CSharp.Pages;

namespace Tests.CSharp.Pages;

public class InventoryPage : BasePage
{
    private readonly ILocator _inventoryContainer;
    private readonly ILocator _inventoryItems;
    private readonly ILocator _addToCartButtons;
    private readonly ILocator _removeButtons;
    private readonly ILocator _shoppingCartBadge;
    private readonly ILocator _shoppingCartLink;
    private readonly ILocator _sortDropdown;

    public InventoryPage(IPage page) : base(page)
    {
        _inventoryContainer = Page.Locator(".inventory_container");
        _inventoryItems = Page.Locator(".inventory_item");
        _addToCartButtons = Page.Locator("button:has-text('Add to cart')");
        _removeButtons = Page.Locator("button:has-text('Remove')");
        _shoppingCartBadge = Page.Locator(".shopping_cart_badge");
        _shoppingCartLink = Page.Locator(".shopping_cart_link");
        _sortDropdown = Page.Locator("[data-test='product_sort_container']");
    }

    public async Task<int> GetInventoryItemsCountAsync()
    {
        return await _inventoryItems.CountAsync();
    }

    public async Task AddItemToCartAsync(int index)
    {
        var button = _addToCartButtons.Nth(index);
        await ClickElementAsync(button);
        await Page.WaitForTimeoutAsync(1000);
    }

    public async Task RemoveItemFromCartAsync(int index)
    {
        var button = _removeButtons.Nth(index);
        await ClickElementAsync(button);
        await Page.WaitForTimeoutAsync(1000);
    }

    public async Task<int> GetCartItemsCountAsync()
    {
        try
        {
            var isBadgeVisible = await IsElementVisibleAsync(_shoppingCartBadge);
            if (!isBadgeVisible)
            {
                return 0;
            }
            var badgeText = await GetElementTextAsync(_shoppingCartBadge);
            return badgeText != null && int.TryParse(badgeText, out var count) ? count : 0;
        }
        catch
        {
            return 0;
        }
    }

    public async Task GoToCartAsync()
    {
        await ClickElementAsync(_shoppingCartLink);
    }

    public async Task<string> GetItemTitleAsync(int index)
    {
        var item = _inventoryItems.Nth(index);
        var titleElement = item.Locator(".inventory_item_name");
        return await GetElementTextAsync(titleElement);
    }

    public async Task<string> GetItemPriceAsync(int index)
    {
        var item = _inventoryItems.Nth(index);
        var priceElement = item.Locator(".inventory_item_price");
        return await GetElementTextAsync(priceElement);
    }

    public async Task SortByAsync(string sortOption)
    {
        try
        {
            await WaitForElementAsync(_sortDropdown, 15000);
            await SelectOptionAsync(_sortDropdown, sortOption);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Sort dropdown not found or not clickable: {ex}");
            throw;
        }
    }

    public async Task<bool> IsItemImageBrokenAsync(int index)
    {
        var item = _inventoryItems.Nth(index);
        var imageElement = item.Locator(".inventory_item_img img");

        try
        {
            await WaitForElementAsync(imageElement, 5000);

            var isLoaded = await imageElement.EvaluateAsync<bool>(@"(img) => {
                return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
            }");

            return !isLoaded;
        }
        catch
        {
            return true;
        }
    }

    public async Task<bool> IsPageLoadedAsync()
    {
        return await IsElementVisibleAsync(_inventoryContainer);
    }
}

