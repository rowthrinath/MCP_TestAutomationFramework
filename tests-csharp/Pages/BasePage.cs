using Microsoft.Playwright;
using Tests.CSharp;
using System.IO;

namespace Tests.CSharp.Pages;

public class BasePage
{
    protected IPage Page { get; }

    public BasePage(IPage page)
    {
        Page = page;
    }

    public IPage PageInstance => Page;

    public async Task GotoAsync(string path = "")
    {
        var url = string.IsNullOrEmpty(path) 
            ? TestData.BaseUrl 
            : path.StartsWith("http") 
                ? path 
                : $"{TestData.BaseUrl}/{path.TrimStart('/')}";
        await Page.GotoAsync(url);
    }

    public async Task WaitForPageLoadAsync()
    {
        await Page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    public async Task WaitForElementAsync(ILocator locator, int timeout = 10000)
    {
        await locator.WaitForAsync(new LocatorWaitForOptions { Timeout = timeout });
    }

    public async Task<bool> IsElementVisibleAsync(ILocator locator)
    {
        try
        {
            await WaitForElementAsync(locator, 5000);
            return await locator.IsVisibleAsync();
        }
        catch
        {
            return false;
        }
    }

    public async Task ClickElementAsync(ILocator locator)
    {
        await WaitForElementAsync(locator);
        await locator.ClickAsync();
    }

    public async Task FillElementAsync(ILocator locator, string value)
    {
        await WaitForElementAsync(locator);
        await locator.FillAsync(value);
    }

    public async Task<string> GetElementTextAsync(ILocator locator)
    {
        await WaitForElementAsync(locator);
        var text = await locator.TextContentAsync();
        return text ?? string.Empty;
    }

    public async Task SelectOptionAsync(ILocator locator, string value)
    {
        await WaitForElementAsync(locator);
        await locator.SelectOptionAsync(value);
    }

    public async Task<string> TakeScreenshotAsync(string fileName)
    {
        var screenshotsDir = Path.Combine(Directory.GetCurrentDirectory(), "TestResults", "Screenshots");
        Directory.CreateDirectory(screenshotsDir);
        
        var screenshotPath = Path.Combine(screenshotsDir, $"{fileName}.png");
        await Page.ScreenshotAsync(new PageScreenshotOptions
        {
            Path = screenshotPath,
            FullPage = true
        });
        
        return screenshotPath;
    }
}

