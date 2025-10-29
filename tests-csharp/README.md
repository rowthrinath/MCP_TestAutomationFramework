# C# SpecFlow Test Suite

This directory contains the C# SpecFlow test suite for the QA Hiring challenge, providing an alternative to the TypeScript/Playwright implementation.

## Overview

This test suite uses:
- **C#** (.NET 9.0)
- **SpecFlow** for Behavior-Driven Development (BDD)
- **Playwright** for browser automation
- **NUnit** as the test framework

## Project Structure

```
tests-csharp/
├── Features/              # SpecFlow feature files
│   ├── Login.feature
│   ├── Inventory.feature
│   ├── Cart.feature
│   ├── Checkout.feature
│   ├── ProblemUser.feature
│   ├── PerformanceGlitchUser.feature
│   └── E2E.feature
├── StepDefinitions/      # Step definition implementations
│   ├── Hooks.cs          # Setup and teardown
│   ├── LoginSteps.cs
│   ├── InventorySteps.cs
│   ├── CartSteps.cs
│   ├── CheckoutSteps.cs
│   └── PerformanceSteps.cs
├── Pages/                # Page Object Models
│   ├── BasePage.cs
│   ├── LoginPage.cs
│   ├── InventoryPage.cs
│   ├── CartPage.cs
│   ├── CheckoutPage.cs
│   ├── CheckoutOverviewPage.cs
│   └── CheckoutCompletePage.cs
├── Utils/                # Utilities
│   └── PageManager.cs
├── TestData.cs           # Test data and user definitions
├── specflow.json         # SpecFlow configuration
└── Tests.CSharp.csproj   # Project file
```

## Prerequisites

1. **.NET SDK 9.0** or later
2. **Playwright browsers** (installed via `playwright install` or first test run)

## Installation

### Restore NuGet Packages

```bash
cd tests-csharp
dotnet restore
```

### Install Playwright Browsers

```bash
dotnet build
playwright install chromium
```

Or let Playwright install automatically on first run.

## Running Tests

**Note:** When running tests from the `tests-csharp` folder, you must specify the project file explicitly: `dotnet test Tests.CSharp.csproj`

### Run All Tests

```bash
# From tests-csharp folder
dotnet test Tests.CSharp.csproj

# Or from project root
dotnet test tests-csharp/Tests.CSharp.csproj
```

### Run Specific Feature

```bash
dotnet test Tests.CSharp.csproj --filter "FullyQualifiedName~Login"
```

### Run Tests with Tags

```bash
# Run only standard_user scenarios
dotnet test Tests.CSharp.csproj --filter "FullyQualifiedName~@standard_user"

# Run only locked_out_user scenarios
dotnet test Tests.CSharp.csproj --filter "FullyQualifiedName~@locked_out_user"
```

### Run with Verbose Output

```bash
dotnet test Tests.CSharp.csproj --verbosity normal
```

### Run Tests with LivingDoc Report (Auto-Launch)

**On macOS/Linux:**
```bash
./scripts/test-with-livingdoc.sh
```

**On Windows (PowerShell):**
```powershell
.\scripts\test-with-livingdoc.ps1
```

This will:
1. Run all tests
2. Generate LivingDoc report automatically
3. Launch the report in your default browser

**Generate LivingDoc Report Manually:**

After running tests, you can generate the report separately:

```bash
# macOS/Linux
./scripts/generate-livingdoc.sh

# Windows
.\scripts\generate-livingdoc.ps1
```

### LivingDoc Reporting

SpecFlow+ LivingDoc generates living documentation from your feature files and test results, providing:
- Visual representation of all features and scenarios
- Test execution status and results
- Step definition mappings
- Tags and categorization

**Installation:**

The LivingDoc plugin is included as a NuGet package. If you need the CLI tool:

```bash
dotnet tool install --global SpecFlow.Plus.LivingDoc.CLI --version 3.9.57
```

**Report Location:**

LivingDoc reports are generated in `TestResults/LivingDoc.html`

### Run Tests Across Multiple Browsers (Parallel Execution)

Similar to Playwright's project-based parallel execution, you can run tests across multiple browsers in parallel.

#### Option 1: Single Browser (via Environment Variable)

```bash
# Run with Chromium
BROWSER=chromium dotnet test Tests.CSharp.csproj

# Run with Firefox
BROWSER=firefox dotnet test Tests.CSharp.csproj

# Run with mobile Chrome emulation
BROWSER=mobile-chrome HEADLESS=true dotnet test Tests.CSharp.csproj

# Run with mobile Safari emulation  
BROWSER=mobile-safari HEADLESS=true dotnet test Tests.CSharp.csproj
```

#### Option 2: Run in Parallel Across All Browsers (Recommended)

**On macOS/Linux:**
```bash
./scripts/run-parallel.sh
```

**On Windows (PowerShell):**
```powershell
.\scripts\run-parallel.ps1
```

This will run tests simultaneously across:
- Chromium
- Firefox
- WebKit (if available)

Each browser test run generates separate result files:
- `test-results-chromium.trx`
- `test-results-firefox.trx`
- `test-results-webkit.trx`

#### Option 3: Manual Parallel Execution

You can also run multiple browsers manually in separate terminals:

**Terminal 1:**
```bash
BROWSER=chromium HEADLESS=true dotnet test Tests.CSharp.csproj --logger "trx;LogFileName=chromium.trx"
```

**Terminal 2:**
```bash
BROWSER=firefox HEADLESS=true dotnet test Tests.CSharp.csproj --logger "trx;LogFileName=firefox.trx"
```

**Terminal 3:**
```bash
BROWSER=mobile-chrome HEADLESS=true dotnet test Tests.CSharp.csproj --logger "trx;LogFileName=mobile-chrome.trx"
```

### Parallel Execution Configuration

The test suite is configured for parallel execution:
- `AssemblyInfo.cs` contains `[Parallelizable(ParallelScope.Fixtures)]` 
- `LevelOfParallelism(3)` allows up to 3 fixtures to run concurrently
- Each browser instance runs in isolation to prevent conflicts

### Browser Configuration

Browsers are configured via the `BROWSER` environment variable:
- `chromium` or `chrome` - Chrome/Chromium browser
- `firefox` - Firefox browser
- `webkit` or `safari` - WebKit/Safari (currently falls back to Chromium)
- `mobile-chrome` - Mobile Chrome emulation (Pixel 5)
- `mobile-safari` - Mobile Safari emulation (iPhone 12)

## Test Features

### 1. Login Feature
- Successful login with different user types
- Failed login scenarios
- Error message validation

### 2. Inventory Feature
- View inventory items
- Add/remove items from cart
- Sort functionality
- Navigation

### 3. Cart Feature
- View cart items
- Item details validation
- Remove items
- Continue shopping
- Proceed to checkout

### 4. Checkout Feature
- Fill checkout information
- View order summary
- Complete order
- Cancel checkout

### 5. Problem User Feature
- Login with problem user
- Handle broken images gracefully
- Complete shopping flow despite issues

### 6. Performance Glitch User Feature
- Login with performance glitch user
- Handle slow loading times
- Complete shopping flow with extended timeouts

### 7. End-to-End Feature
- Complete full shopping journey

## Tag Usage

Use tags to categorize and filter tests:

- `@standard_user` - Tests for standard user
- `@locked_out_user` - Tests for locked out user
- `@problem_user` - Tests for problem user
- `@performance_glitch_user` - Tests for performance glitch user
- `@e2e` - End-to-end scenarios

## Page Object Model

The project follows the Page Object Model (POM) design pattern:

- **BasePage**: Common functionality for all pages
- **Specific Pages**: Login, Inventory, Cart, Checkout, etc.
- **PageManager**: Centralized access to all page objects

## Configuration

### Environment Variables (.env)

The test suite supports configuration via `.env` file. Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

**Environment Variables:**

- `BROWSER`: Browser to use (`chromium`, `firefox`, `webkit`, `mobile-chrome`, `mobile-safari`)
- `HEADLESS`: Run browsers headless (`true` or `false`, default: `true`)
- `BASE_URL`: Base URL for tests (default: `https://qa-challenge.codesubmit.io`)
- `CLEANUP_BROWSERS`: Enable aggressive browser cleanup (`true` or `false`, default: `false`)
- `NUMBER_OF_TEST_WORKERS`: Number of parallel test workers (default: `1`)

**Example `.env` file:**

```env
BROWSER=chromium
HEADLESS=true
BASE_URL=https://qa-challenge.codesubmit.io
CLEANUP_BROWSERS=false
NUMBER_OF_TEST_WORKERS=1
```

**Note:** Environment variables set in the system or via command line take precedence over `.env` file values.

### specflow.json

Configuration file for SpecFlow settings including:
- Generator options
- Runtime behavior
- Tracing options
- LivingDoc generator settings with screenshots folder: `TestResults/Screenshots`

### Test Data

User credentials and test configuration are defined in `TestData.cs`:

- `Users.Standard`
- `Users.LockedOut`
- `Users.Problem`
- `Users.PerformanceGlitch`

Base URL is loaded from `BASE_URL` environment variable (via `.env` file) or defaults to `https://qa-challenge.codesubmit.io`

## Screenshots on Failure

The test suite automatically captures screenshots when a scenario fails. Screenshots are:

- **Automatic**: Captured automatically when a step fails
- **Full Page**: Full page screenshots for complete context
- **Organized**: Stored in `TestResults/Screenshots/` with descriptive filenames
- **LivingDoc Integration**: Screenshots are automatically included in LivingDoc reports

### Screenshot Details

- **Location**: `TestResults/Screenshots/`
- **Format**: PNG
- **Naming**: `{ScenarioTitle}_{Timestamp}.png`
- **Full Page**: Complete page capture for debugging

### Manual Screenshots

You can also capture screenshots manually in step definitions:

```csharp
var screenshotPath = await Pages.InventoryPage.TakeScreenshotAsync("custom-screenshot");
```

## Best Practices

1. **Page Object Model**: All page interactions are abstracted into page objects
2. **Step Definitions**: Reusable steps for common actions
3. **Hooks**: Setup and teardown handled in `Hooks.cs`
4. **Error Handling**: Graceful handling of timeouts and failures (especially for problem/performance users)
5. **Tags**: Use tags for organizing and filtering tests
6. **Screenshots**: Automatically captured on failure for debugging

## Troubleshooting

### Browser Not Found

```bash
playwright install chromium
```

### SpecFlow Code Generation Errors

```bash
dotnet clean
dotnet build
```

### Tests Fail Due to Timeouts

For performance glitch user tests, timeouts are automatically extended to 60 seconds.

## Differences from TypeScript Suite

- Uses SpecFlow for BDD-style feature files
- C# Page Objects instead of TypeScript classes
- NUnit assertions instead of Playwright expect
- Same test coverage and scenarios

## Integration with CI/CD

The C# tests can be integrated into CI/CD pipelines:

```bash
# Run tests in CI
dotnet test Tests.CSharp.csproj --configuration Release --logger "trx;LogFileName=test-results.trx"
```

Test results will be available in TRX format for reporting.

