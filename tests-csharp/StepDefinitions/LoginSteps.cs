using Microsoft.Playwright;
using NUnit.Framework;
using TechTalk.SpecFlow;
using Tests.CSharp.Utils;

namespace Tests.CSharp.StepDefinitions;

[Binding]
public class LoginSteps
{
    private readonly ScenarioContext _scenarioContext;
    private PageManager Pages => _scenarioContext.Get<PageManager>("pages");
    private IPage Page => _scenarioContext.Get<IPage>("page");

    public LoginSteps(ScenarioContext scenarioContext)
    {
        _scenarioContext = scenarioContext;
    }

    [Given(@"I navigate to the login page")]
    public async Task GivenINavigateToTheLoginPage()
    {
        await Pages.LoginPage.GotoAsync("/");
    }

    [Given(@"I am logged in as ""(.*)""")]
    public async Task GivenIAmLoggedInAs(string username)
    {
        var password = "secret_sauce";
        await Pages.LoginPage.GotoAsync("/");
        await Pages.LoginPage.LoginAsync(username, password);
        await Page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    [When(@"I login with username ""(.*)"" and password ""(.*)""")]
    public async Task WhenILoginWithUsernameAndPassword(string username, string password)
    {
        await Pages.LoginPage.LoginAsync(username, password);
        await Page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    [Then(@"I should be redirected to the inventory page")]
    public async Task ThenIShouldBeRedirectedToTheInventoryPage()
    {
        await Page.WaitForURLAsync("**/inventory.html", new PageWaitForURLOptions { Timeout = 10000 });
        var url = Page.Url;
        Assert.That(url, Does.Contain("inventory"));
    }

    [Then(@"the inventory page should be displayed")]
    public async Task ThenTheInventoryPageShouldBeDisplayed()
    {
        var isLoaded = await Pages.InventoryPage.IsPageLoadedAsync();
        Assert.That(isLoaded, Is.True);
    }

    [Then(@"I should see an error message")]
    public async Task ThenIShouldSeeAnErrorMessage()
    {
        var isVisible = await Pages.LoginPage.IsErrorMessageVisibleAsync();
        Assert.That(isVisible, Is.True);
    }

    [Then(@"the error message should contain ""(.*)""")]
    public async Task ThenTheErrorMessageShouldContain(string expectedText)
    {
        var errorMessage = await Pages.LoginPage.GetErrorMessageAsync();
        Assert.That(errorMessage, Does.Contain(expectedText).IgnoreCase);
    }
}

