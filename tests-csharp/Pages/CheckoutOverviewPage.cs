using Microsoft.Playwright;
using Tests.CSharp.Pages;

namespace Tests.CSharp.Pages;

public class CheckoutOverviewPage : BasePage
{
    private readonly ILocator _finishButton;
    private readonly ILocator _cancelButton;
    private readonly ILocator _cartItems;
    private readonly ILocator _subtotalLabel;
    private readonly ILocator _taxLabel;
    private readonly ILocator _totalLabel;

    public CheckoutOverviewPage(IPage page) : base(page)
    {
        _finishButton = Page.Locator("[data-test='finish']");
        _cancelButton = Page.Locator("[data-test='cancel']");
        _cartItems = Page.Locator(".cart_item");
        _subtotalLabel = Page.Locator(".summary_subtotal_label");
        _taxLabel = Page.Locator(".summary_tax_label");
        _totalLabel = Page.Locator(".summary_total_label");
    }

    public async Task FinishOrderAsync()
    {
        try
        {
            await WaitForElementAsync(_finishButton, 15000);
            await ClickElementAsync(_finishButton);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Finish button not found or not clickable: {ex}");
            throw;
        }
    }

    public async Task CancelAsync()
    {
        await ClickElementAsync(_cancelButton);
    }

    public async Task<int> GetCartItemsCountAsync()
    {
        return await _cartItems.CountAsync();
    }

    public async Task<string> GetSubtotalAsync()
    {
        return await GetElementTextAsync(_subtotalLabel);
    }

    public async Task<string> GetTaxAsync()
    {
        return await GetElementTextAsync(_taxLabel);
    }

    public async Task<string> GetTotalAsync()
    {
        return await GetElementTextAsync(_totalLabel);
    }
}

