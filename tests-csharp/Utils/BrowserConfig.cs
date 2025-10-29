using Microsoft.Playwright;

namespace Tests.CSharp.Utils;

public enum BrowserType
{
    Chromium,
    Firefox,
    WebKit,
    MobileChrome,
    MobileSafari
}

public static class BrowserConfig
{
    public static IBrowserType GetBrowserType(IPlaywright playwright, BrowserType type)
    {
        return type switch
        {
            BrowserType.Chromium => playwright.Chromium,
            BrowserType.Firefox => playwright.Firefox,
            BrowserType.WebKit => playwright.Chromium, // WebKit not available in this Playwright version
            BrowserType.MobileChrome => playwright.Chromium,
            BrowserType.MobileSafari => playwright.Chromium, // Using Chromium for mobile safari
            _ => playwright.Chromium
        };
    }

    public static BrowserTypeLaunchOptions GetLaunchOptions(BrowserType type)
    {
        EnvLoader.Load();
        
        // When HEADLESS=true, Headless should be true (browser runs in headless mode - NOT visible)
        // When HEADLESS=false, Headless should be false (browser is visible)
        var headlessValue = EnvLoader.GetEnvBool("HEADLESS", true);
        var headlessEnv = Environment.GetEnvironmentVariable("HEADLESS");
        
        Console.WriteLine($"[BrowserConfig] HEADLESS env var value: '{headlessEnv}' (resolved to: {headlessValue})");
        Console.WriteLine($"[BrowserConfig] Browser will run in {(headlessValue ? "headless" : "headed")} mode");
        
        return new BrowserTypeLaunchOptions
        {
            Headless = headlessValue
        };
    }

    public static BrowserNewContextOptions? GetContextOptions(BrowserType type, IPlaywright playwright)
    {
        return type switch
        {
            BrowserType.MobileChrome => playwright.Devices["Pixel 5"],
            BrowserType.MobileSafari => playwright.Devices["iPhone 12"],
            _ => null
        };
    }

    public static BrowserType GetBrowserTypeFromEnvironment()
    {
        EnvLoader.Load();
        var browser = EnvLoader.GetEnv("BROWSER", "chromium").ToLower();
        return browser switch
        {
            "chromium" or "chrome" => BrowserType.Chromium,
            "firefox" => BrowserType.Firefox,
            "webkit" or "safari" => BrowserType.WebKit,
            "mobile-chrome" => BrowserType.MobileChrome,
            "mobile-safari" => BrowserType.MobileSafari,
            _ => BrowserType.Chromium
        };
    }

    public static BrowserType[] GetAllBrowsers()
    {
        return new[]
        {
            BrowserType.Chromium,
            BrowserType.Firefox,
            BrowserType.WebKit
        };
    }

    public static BrowserType[] GetAllBrowsersIncludingMobile()
    {
        return new[]
        {
            BrowserType.Chromium,
            BrowserType.Firefox,
            BrowserType.WebKit,
            BrowserType.MobileChrome,
            BrowserType.MobileSafari
        };
    }
}

