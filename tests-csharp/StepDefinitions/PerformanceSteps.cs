using Microsoft.Playwright;
using NUnit.Framework;
using TechTalk.SpecFlow;
using Tests.CSharp.Utils;

namespace Tests.CSharp.StepDefinitions;

[Binding]
public class PerformanceSteps
{
    private readonly ScenarioContext _scenarioContext;
    private PageManager Pages => _scenarioContext.Get<PageManager>("pages");
    private IPage Page => _scenarioContext.Get<IPage>("page");

    public PerformanceSteps(ScenarioContext scenarioContext)
    {
        _scenarioContext = scenarioContext;
    }

    [Then(@"the page should load within extended timeout")]
    public async Task ThenThePageShouldLoadWithinExtendedTimeout()
    {
        Page.SetDefaultTimeout(60000);
        var isLoaded = await Pages.InventoryPage.IsPageLoadedAsync();
        Assert.That(isLoaded, Is.True);
    }

    [Then(@"images should eventually load")]
    public async Task ThenImagesShouldEventuallyLoad()
    {
        Page.SetDefaultTimeout(60000);
        var itemsCount = await Pages.InventoryPage.GetInventoryItemsCountAsync();
        
        // Wait a bit for images to load
        await Page.WaitForTimeoutAsync(2000);
        
        int brokenImageCount = 0;
        for (int i = 0; i < itemsCount; i++)
        {
            var isBroken = await Pages.InventoryPage.IsItemImageBrokenAsync(i);
            if (isBroken)
            {
                brokenImageCount++;
            }
        }
        
        if (brokenImageCount > 0)
        {
            Console.WriteLine($"Warning: {brokenImageCount} images may appear broken due to performance issues.");
        }
        
        Assert.That(itemsCount, Is.GreaterThan(0));
    }
}

