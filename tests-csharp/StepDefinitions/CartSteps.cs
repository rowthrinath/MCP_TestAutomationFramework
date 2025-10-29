using Microsoft.Playwright;
using NUnit.Framework;
using TechTalk.SpecFlow;
using Tests.CSharp.Utils;

namespace Tests.CSharp.StepDefinitions;

[Binding]
public class CartSteps
{
    private readonly ScenarioContext _scenarioContext;
    private PageManager Pages => _scenarioContext.Get<PageManager>("pages");
    private IPage Page => _scenarioContext.Get<IPage>("page");

    public CartSteps(ScenarioContext scenarioContext)
    {
        _scenarioContext = scenarioContext;
    }

    [Given(@"I navigate to cart")]
    public async Task GivenINavigateToCart()
    {
        await Pages.InventoryPage.GoToCartAsync();
    }

    [Then(@"I should see the cart page")]
    public async Task ThenIShouldSeeTheCartPage()
    {
        var isLoaded = await Pages.CartPage.IsCartPageLoadedAsync();
        Assert.That(isLoaded, Is.True);
    }

    [Then(@"item at index (\d+) should have a title")]
    public async Task ThenItemAtIndexShouldHaveATitle(int index)
    {
        var title = await Pages.CartPage.GetItemTitleAsync(index);
        Assert.That(title, Is.Not.Empty);
    }

    [Then(@"item at index (\d+) should have a price")]
    public async Task ThenItemAtIndexShouldHaveAPrice(int index)
    {
        var price = await Pages.CartPage.GetItemPriceAsync(index);
        Assert.That(price, Is.Not.Empty);
    }

    [Then(@"item at index (\d+) should have quantity ""(.*)""")]
    public async Task ThenItemAtIndexShouldHaveQuantity(int index, string expectedQuantity)
    {
        var quantity = await Pages.CartPage.GetItemQuantityAsync(index);
        Assert.That(quantity, Is.EqualTo(expectedQuantity));
    }

    [When(@"I continue shopping")]
    public async Task WhenIContinueShopping()
    {
        await Pages.CartPage.ContinueShoppingAsync();
    }

    [When(@"I proceed to checkout")]
    public async Task WhenIProceedToCheckout()
    {
        await Pages.CartPage.ProceedToCheckoutAsync();
    }

    [When(@"I remove all items from cart")]
    public async Task WhenIRemoveAllItemsFromCart()
    {
        var itemsCount = await Pages.CartPage.GetCartItemsCountAsync();
        for (int i = 0; i < itemsCount; i++)
        {
            await Pages.CartPage.RemoveItemAsync(0);
        }
    }

    [Then(@"the cart should be empty")]
    public async Task ThenTheCartShouldBeEmpty()
    {
        var isEmpty = await Pages.CartPage.IsCartEmptyAsync();
        Assert.That(isEmpty, Is.True);
    }
}

