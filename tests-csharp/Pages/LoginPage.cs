using Microsoft.Playwright;
using Tests.CSharp.Pages;

namespace Tests.CSharp.Pages;

public class LoginPage : BasePage
{
    private readonly ILocator _usernameInput;
    private readonly ILocator _passwordInput;
    private readonly ILocator _loginButton;
    private readonly ILocator _errorMessage;

    public LoginPage(IPage page) : base(page)
    {
        _usernameInput = Page.Locator("[data-test='username']");
        _passwordInput = Page.Locator("[data-test='password']");
        _loginButton = Page.Locator("[data-test='login-button']");
        _errorMessage = Page.Locator("[data-test='error']");
    }

    public async Task LoginAsync(string username, string password)
    {
        await FillElementAsync(_usernameInput, username);
        await FillElementAsync(_passwordInput, password);
        await ClickElementAsync(_loginButton);
        await Page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    public async Task<bool> IsLoginButtonVisibleAsync()
    {
        return await IsElementVisibleAsync(_loginButton);
    }

    public async Task<string> GetErrorMessageAsync()
    {
        try
        {
            await WaitForElementAsync(_errorMessage, 5000);
            return await GetElementTextAsync(_errorMessage);
        }
        catch
        {
            return string.Empty;
        }
    }

    public async Task<bool> IsErrorMessageVisibleAsync()
    {
        return await IsElementVisibleAsync(_errorMessage);
    }

    public async Task ClearFormAsync()
    {
        await _usernameInput.ClearAsync();
        await _passwordInput.ClearAsync();
    }
}

