using Microsoft.Playwright;
using Tests.CSharp.Pages;

namespace Tests.CSharp.Pages;

public class CheckoutCompletePage : BasePage
{
    private readonly ILocator _completeHeader;
    private readonly ILocator _completeText;
    private readonly ILocator _backHomeButton;

    public CheckoutCompletePage(IPage page) : base(page)
    {
        _completeHeader = Page.Locator(".complete-header");
        _completeText = Page.Locator(".complete-text");
        _backHomeButton = Page.Locator("[data-test='back-to-products']");
    }

    public async Task<string> GetCompleteHeaderAsync()
    {
        return await GetElementTextAsync(_completeHeader);
    }

    public async Task<string> GetCompleteTextAsync()
    {
        return await GetElementTextAsync(_completeText);
    }

    public async Task BackHomeAsync()
    {
        await ClickElementAsync(_backHomeButton);
    }
}

