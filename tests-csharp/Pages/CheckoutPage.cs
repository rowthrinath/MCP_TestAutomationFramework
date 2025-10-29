using Microsoft.Playwright;
using Tests.CSharp.Pages;

namespace Tests.CSharp.Pages;

public class CheckoutPage : BasePage
{
    private readonly ILocator _firstNameInput;
    private readonly ILocator _lastNameInput;
    private readonly ILocator _postalCodeInput;
    private readonly ILocator _continueButton;
    private readonly ILocator _cancelButton;
    private readonly ILocator _checkoutContainer;

    public CheckoutPage(IPage page) : base(page)
    {
        _firstNameInput = Page.Locator("[data-test='firstName']");
        _lastNameInput = Page.Locator("[data-test='lastName']");
        _postalCodeInput = Page.Locator("[data-test='postalCode']");
        _continueButton = Page.Locator("[data-test='continue']");
        _cancelButton = Page.Locator("[data-test='cancel']");
        _checkoutContainer = Page.Locator("#checkout_info_container");
    }

    public async Task FillCheckoutInfoAsync(string firstName, string lastName, string postalCode)
    {
        await FillElementAsync(_firstNameInput, firstName);
        await FillElementAsync(_lastNameInput, lastName);
        await FillElementAsync(_postalCodeInput, postalCode);
    }

    public async Task ContinueToOverviewAsync()
    {
        await ClickElementAsync(_continueButton);
    }

    public async Task CancelCheckoutAsync()
    {
        await ClickElementAsync(_cancelButton);
    }

    public async Task<bool> IsCheckoutPageLoadedAsync()
    {
        return await IsElementVisibleAsync(_checkoutContainer);
    }
}

