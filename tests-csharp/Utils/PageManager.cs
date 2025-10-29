using Microsoft.Playwright;
using Tests.CSharp.Pages;

namespace Tests.CSharp.Utils;

public class PageManager
{
    private readonly IPage _page;

    public LoginPage LoginPage { get; }
    public InventoryPage InventoryPage { get; }
    public CartPage CartPage { get; }
    public CheckoutPage CheckoutPage { get; }
    public CheckoutOverviewPage CheckoutOverviewPage { get; }
    public CheckoutCompletePage CheckoutCompletePage { get; }

    public PageManager(IPage page)
    {
        _page = page;
        LoginPage = new LoginPage(page);
        InventoryPage = new InventoryPage(page);
        CartPage = new CartPage(page);
        CheckoutPage = new CheckoutPage(page);
        CheckoutOverviewPage = new CheckoutOverviewPage(page);
        CheckoutCompletePage = new CheckoutCompletePage(page);
    }
}

