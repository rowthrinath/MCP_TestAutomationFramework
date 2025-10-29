# Playwright Test Suite

This directory contains the Playwright TypeScript test suite for the QA Hiring challenge.

## Overview

This test suite uses:
- **TypeScript** for type-safe test code
- **Playwright** for browser automation and testing
- **Page Object Model** pattern for maintainable test code

## Project Structure

```
tests-playwright/
├── *.spec.ts              # Test specification files
├── fixtures/              # Test fixtures and data
│   ├── test-data.ts
│   └── test-fixtures.ts
├── pages/                 # Page Object Models
│   ├── base-page.ts
│   ├── login-page.ts
│   ├── inventory-page.ts
│   ├── cart-page.ts
│   ├── checkout-page.ts
│   ├── checkout-overview-page.ts
│   └── checkout-complete-page.ts
├── utils/                 # Utilities
│   └── page-manager.ts
├── playwright.config.ts   # Playwright configuration
├── package.json           # NPM scripts for running tests
└── README.md              # This file
```

## Prerequisites

1. **Node.js** (v18 or later recommended)
2. **npm** or **yarn**
3. **Playwright browsers** (installed automatically on first run)

## Installation

### Install Dependencies

From the **project root** (one level up):

```bash
cd ..
npm install
```

Or install Playwright specifically:

```bash
cd ..
npm install @playwright/test
```

### Install Playwright Browsers

```bash
cd ..
npx playwright install
```

Or:

```bash
cd ..
npm run install:browsers
```

## Running Tests

### From This Folder (tests-playwright)

You can run tests directly from this folder using the local `package.json`:

**Note:** Make sure dependencies are installed in the parent directory first.

```bash
# Run all tests
npm test

# Run tests in headed mode (visible browser)
npm run test:headed

# Run tests in debug mode
npm run test:debug

# Run tests in UI mode
npm run test:ui

# View test report
npm run test:report
```

### From Project Root

You can also run tests from the project root:

```bash
cd ../..
npm test
```

### Run Specific Test Files

```bash
# From this folder
npx playwright test login.spec.ts

# From project root
npm test -- login.spec.ts
```

### Run Tests for Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Configuration

### Environment Variables

Tests can be configured using environment variables. Create a `.env` file in the **project root** (one level up):

```env
BASE_URL=https://qa-challenge.codesubmit.io
HEADLESS=true
SCREENSHOT_ONLY_ON_FAILURE=true
VIDEO_RETAIN_ON_FAILURE=true
ACTION_TIMEOUT=30000
NAVIGATION_TIMEOUT=30000
RETRIES=0
WORKERS=1
FORBID_ONLY=false
```

### Playwright Configuration

The `playwright.config.ts` in this folder is configured to:
- Load `.env` from the project root
- Output test results to parent directories
- Support multiple browsers (Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari)
- Generate HTML, JSON, and JUnit reports

## Test Reports

Test reports are generated in the parent directory:
- **HTML Report**: `../playwright-report/`
- **JSON Results**: `../test-results/results.json`
- **JUnit XML**: `../test-results/results.xml`

View the HTML report:

```bash
npm run test:report
```

Or from project root:

```bash
npm run test:report
```

## Test Features

### 1. Login Tests
- Successful login scenarios
- Failed login scenarios
- Error message validation

### 2. Inventory Tests
- View inventory items
- Add/remove items from cart
- Sort functionality (name, price)
- Navigation

### 3. Cart Tests
- View cart items
- Item details validation
- Remove items
- Continue shopping
- Proceed to checkout

### 4. Checkout Tests
- Fill checkout information
- View order summary
- Complete order
- Form validation

### 5. Problem User Tests
- Handle broken images gracefully
- Complete shopping flow despite issues

### 6. Performance Glitch User Tests
- Handle slow loading times
- Complete shopping flow with extended timeouts

### 7. End-to-End Tests
- Complete full shopping journey

## Page Object Model

The project follows the Page Object Model (POM) design pattern:

- **BasePage**: Common functionality for all pages
- **Specific Pages**: Login, Inventory, Cart, Checkout, etc.
- **PageManager**: Centralized access to all page objects

## Best Practices

1. **Page Object Model**: All page interactions are abstracted into page objects
2. **Type Safety**: TypeScript ensures type safety throughout the codebase
3. **Fixtures**: Reusable test data and fixtures
4. **Error Handling**: Graceful handling of timeouts and failures
5. **Screenshots**: Automatically captured on failure
6. **Isolation**: Each test is isolated and can run independently

## Troubleshooting

### Browser Not Found

```bash
cd ..
npx playwright install
```

### Dependencies Not Found

Make sure to install dependencies from the project root:

```bash
cd ..
npm install
```

### Tests Fail Due to Timeouts

Check your network connection and increase timeout in `.env`:

```env
ACTION_TIMEOUT=60000
NAVIGATION_TIMEOUT=60000
```

### TypeScript Errors

Make sure TypeScript is installed and the project is properly configured:

```bash
cd ..
npm install typescript @types/node
```

## Differences from C# Suite

- Uses TypeScript instead of C#
- Uses Playwright's built-in test framework instead of SpecFlow
- Same test coverage and scenarios

