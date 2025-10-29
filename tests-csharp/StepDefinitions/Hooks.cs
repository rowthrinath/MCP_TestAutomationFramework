using Microsoft.Playwright;
using NUnit.Framework;
using TechTalk.SpecFlow;
using Tests.CSharp.Utils;
using System.IO;
using System.Linq;

namespace Tests.CSharp.StepDefinitions;

[Binding]
public class Hooks
{
    private readonly ScenarioContext _scenarioContext;
    private IPlaywright? _playwright;
    private IBrowser? _browser;
    private IBrowserContext? _context;
    private IPage? _page;
    private PageManager? _pages;

    public Hooks(ScenarioContext scenarioContext)
    {
        _scenarioContext = scenarioContext;
    }

    [BeforeScenario]
    public async Task BeforeScenario()
    {
        // Load environment variables from .env file
        EnvLoader.Load();
        
        var browserType = BrowserConfig.GetBrowserTypeFromEnvironment();
        _playwright = await Playwright.CreateAsync();
        
        var browserTypeInstance = BrowserConfig.GetBrowserType(_playwright, browserType);
        var launchOptions = BrowserConfig.GetLaunchOptions(browserType);
        
        _browser = await browserTypeInstance.LaunchAsync(launchOptions);
        
        // For mobile browsers, use device emulation
        var contextOptions = BrowserConfig.GetContextOptions(browserType, _playwright);
        if (contextOptions != null)
        {
            _context = await _browser.NewContextAsync(contextOptions);
            _page = await _context.NewPageAsync();
        }
        else
        {
            _page = await _browser.NewPageAsync();
        }
        
        _pages = new PageManager(_page);

        _scenarioContext.Set(_page, "page");
        _scenarioContext.Set(_pages, "pages");
        _scenarioContext.Set(_browser, "browser");
        _scenarioContext.Set(_playwright, "playwright");
        _scenarioContext.Set(browserType, "browserType");
        
        if (_context != null)
        {
            _scenarioContext.Set(_context, "context");
        }
    }

    [AfterStep]
    public async Task AfterStep(ScenarioContext scenarioContext)
    {
        // Capture screenshot immediately when a step fails
        // Check if the step failed by examining test errors in scenario context
        bool stepFailed = false;
        
        try
        {
            // Check if there's a test error (step failure sets this)
            if (scenarioContext.TestError != null)
            {
                stepFailed = true;
            }
            // Also check scenario execution status as fallback
            else if (scenarioContext.ScenarioExecutionStatus == ScenarioExecutionStatus.TestError ||
                     scenarioContext.ScenarioExecutionStatus == ScenarioExecutionStatus.BindingError)
            {
                stepFailed = true;
            }
        }
        catch
        {
            // If we can't determine status, assume not failed to avoid false positives
            stepFailed = false;
        }
        
        if (stepFailed)
        {
            try
            {
                // Only capture if we haven't already captured a screenshot for this scenario
                // This prevents multiple screenshots for the same failure
                if (!scenarioContext.ContainsKey("ScreenshotPath"))
                {
                    await CaptureScreenshotOnFailureAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Warning: Could not capture screenshot on step failure: {ex.Message}");
            }
        }
    }

    [AfterScenario]
    public async Task AfterScenario()
    {
        // Capture screenshot if scenario failed and no screenshot was already captured in AfterStep
        if (_scenarioContext.ScenarioExecutionStatus == ScenarioExecutionStatus.TestError ||
            _scenarioContext.ScenarioExecutionStatus == ScenarioExecutionStatus.BindingError)
        {
            try
            {
                // Only capture if AfterStep didn't already capture a screenshot
                if (!_scenarioContext.ContainsKey("ScreenshotPath"))
                {
                    await CaptureScreenshotOnFailureAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Warning: Could not capture screenshot: {ex.Message}");
            }
        }

        if (_page != null)
        {
            await _page.CloseAsync();
        }

        if (_context != null)
        {
            await _context.CloseAsync();
        }

        if (_browser != null)
        {
            await _browser.CloseAsync();
        }

        if (_playwright != null)
        {
            _playwright.Dispose();
        }
    }

    private async Task CaptureScreenshotOnFailureAsync()
    {
        if (_page == null) return;

        try
        {
            // Create screenshots directory
            var screenshotsDir = Path.Combine(Directory.GetCurrentDirectory(), "TestResults", "Screenshots");
            Directory.CreateDirectory(screenshotsDir);

            // Generate screenshot filename from scenario and step info
            var scenarioTitle = _scenarioContext.ScenarioInfo.Title;
            var stepText = _scenarioContext.StepContext.StepInfo?.Text ?? "UnknownStep";
            var timestamp = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
            
            // Create safe filename
            var safeTitle = string.Join("_", scenarioTitle.Split(Path.GetInvalidFileNameChars()));
            var safeStepText = string.Join("_", stepText.Split(Path.GetInvalidFileNameChars()).Take(5)); // Limit step text length
            var screenshotPath = Path.Combine(screenshotsDir, $"{safeTitle}_{safeStepText}_{timestamp}.png");

            // Take screenshot
            await _page.ScreenshotAsync(new PageScreenshotOptions
            {
                Path = screenshotPath,
                FullPage = true
            });

            // Store screenshot path in scenario context for LivingDoc
            _scenarioContext["ScreenshotPath"] = screenshotPath;
            _scenarioContext["ScreenshotFileName"] = Path.GetFileName(screenshotPath);

            // Also add relative path for LivingDoc
            var relativePath = Path.GetRelativePath(
                Path.Combine(Directory.GetCurrentDirectory(), "TestResults"),
                screenshotPath
            );
            _scenarioContext["ScreenshotRelativePath"] = relativePath;

            // Attach screenshot to NUnit test context for LivingDoc
            try
            {
                var stepInfo = _scenarioContext.StepContext.StepInfo?.Text ?? "Unknown Step";
                TestContext.AddTestAttachment(screenshotPath, $"Screenshot: {scenarioTitle} - Failed at: {stepInfo}");
            }
            catch
            {
                // TestContext might not be available in all contexts, ignore
            }

            Console.WriteLine($"Screenshot captured on failing step: {screenshotPath}");
            Console.WriteLine($"  Failed at step: {stepText}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to capture screenshot: {ex.Message}");
        }
    }

    [AfterTestRun]
    public static async Task AfterTestRun()
    {
        // Clean up any remaining browser processes
        try
        {
            await CleanupBrowsersAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Error during browser cleanup: {ex.Message}");
        }
    }

    private static async Task CleanupBrowsersAsync()
    {
        // Try to close any remaining Playwright browser processes
        // This is a safety net in case any browsers weren't properly closed during scenarios
        
        try
        {
            // Kill any lingering browser processes (Chrome, Firefox, Safari)
            // This ensures no orphaned browser processes remain after test run
            if (Environment.OSVersion.Platform == PlatformID.Unix || 
                Environment.OSVersion.Platform == PlatformID.MacOSX)
            {
                // macOS/Linux: Kill browser processes
                await KillBrowserProcessesUnixAsync();
            }
            else if (Environment.OSVersion.Platform == PlatformID.Win32NT)
            {
                // Windows: Kill browser processes
                await KillBrowserProcessesWindowsAsync();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Note: Could not clean up browser processes: {ex.Message}");
            // Non-critical - browsers may have already been closed
        }
    }

    private static async Task KillBrowserProcessesUnixAsync()
    {
        // Only kill Playwright-managed browser processes to avoid killing user browsers
        // Playwright browsers typically have specific flags that identify them
        var playwrightPatterns = new[] 
        { 
            "chrome.*remote-debugging-port",
            "chromium.*remote-debugging-port",
            "firefox.*-marionette",
            "playwright"
        };
        
        foreach (var pattern in playwrightPatterns)
        {
            try
            {
                var pkillProcess = new System.Diagnostics.Process
                {
                    StartInfo = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "pkill",
                        Arguments = $"-f \"{pattern}\"",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };
                
                pkillProcess.Start();
                await pkillProcess.WaitForExitAsync();
            }
            catch
            {
                // Ignore - process may not exist or pkill may not be available
            }
        }
        
        // Also try killing processes with Playwright in the command line
        try
        {
            var psProcess = new System.Diagnostics.Process
            {
                StartInfo = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "pgrep",
                    Arguments = "-f playwright",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            
            psProcess.Start();
            var output = await psProcess.StandardOutput.ReadToEndAsync();
            await psProcess.WaitForExitAsync();
            
            if (!string.IsNullOrEmpty(output))
            {
                var pids = output.Trim().Split('\n', StringSplitOptions.RemoveEmptyEntries);
                foreach (var pid in pids)
                {
                    try
                    {
                        var killProcess = new System.Diagnostics.Process
                        {
                            StartInfo = new System.Diagnostics.ProcessStartInfo
                            {
                                FileName = "kill",
                                Arguments = $"-9 {pid.Trim()}",
                                RedirectStandardOutput = true,
                                RedirectStandardError = true,
                                UseShellExecute = false,
                                CreateNoWindow = true
                            }
                        };
                        killProcess.Start();
                        await killProcess.WaitForExitAsync();
                    }
                    catch { /* Ignore */ }
                }
            }
        }
        catch
        {
            // Ignore if pgrep/kill not available
        }
    }

    private static async Task KillBrowserProcessesWindowsAsync()
    {
        // Only kill Playwright-managed browser processes
        // Use wmic to find processes with Playwright-specific command line arguments
        try
        {
            var wmicProcess = new System.Diagnostics.Process
            {
                StartInfo = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "wmic",
                    Arguments = "process where \"commandline like '%playwright%' or commandline like '%remote-debugging-port%' or commandline like '%-marionette%'\" get processid",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            
            wmicProcess.Start();
            var output = await wmicProcess.StandardOutput.ReadToEndAsync();
            await wmicProcess.WaitForExitAsync();
            
            var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
            foreach (var line in lines)
            {
                if (int.TryParse(line.Trim(), out int pid) && pid > 0)
                {
                    try
                    {
                        var killProcess = new System.Diagnostics.Process
                        {
                            StartInfo = new System.Diagnostics.ProcessStartInfo
                            {
                                FileName = "taskkill",
                                Arguments = $"/F /PID {pid}",
                                RedirectStandardOutput = true,
                                RedirectStandardError = true,
                                UseShellExecute = false,
                                CreateNoWindow = true
                            }
                        };
                        killProcess.Start();
                        await killProcess.WaitForExitAsync();
                    }
                    catch { /* Ignore */ }
                }
            }
        }
        catch
        {
            // Ignore if wmic not available - fallback to simpler approach only if CLEANUP_BROWSERS env var is set
            EnvLoader.Load();
            if (EnvLoader.GetEnvBool("CLEANUP_BROWSERS", false))
            {
                var processes = new[] { "chrome", "chromium", "firefox" };
                foreach (var process in processes)
                {
                    try
                    {
                        var taskkillProcess = new System.Diagnostics.Process
                        {
                            StartInfo = new System.Diagnostics.ProcessStartInfo
                            {
                                FileName = "taskkill",
                                Arguments = $"/F /FI \"WINDOWTITLE eq *playwright*\" /IM {process}.exe",
                                RedirectStandardOutput = true,
                                RedirectStandardError = true,
                                UseShellExecute = false,
                                CreateNoWindow = true
                            }
                        };
                        
                        taskkillProcess.Start();
                        await taskkillProcess.WaitForExitAsync();
                    }
                    catch { /* Ignore */ }
                }
            }
        }
    }
}

