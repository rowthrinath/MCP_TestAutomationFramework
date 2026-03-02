# Troubleshooting Guide

## Installation Issues

### Problem: npm install fails
**Symptoms**: Error messages during dependency installation

**Solutions**:
1. Check Node.js version: `node -v` (must be 18+)
2. Clear npm cache: `npm cache clean --force`
3. Delete node_modules and package-lock.json
4. Run `npm install` again
5. Try using `npm install --legacy-peer-deps`

### Problem: TypeScript compilation fails
**Symptoms**: Build errors, type errors

**Solutions**:
1. Verify TypeScript installation: `npx tsc --version`
2. Check tsconfig.json is valid
3. Delete build folder and rebuild: `rm -rf build && npm run build`
4. Check for syntax errors in src/index.ts

### Problem: Playwright browsers not installed
**Symptoms**: "Executable doesn't exist" errors

**Solutions**:
```bash
# Install all browsers
npx playwright install

# Install specific browser
npx playwright install chromium

# Install with dependencies (Linux)
npx playwright install --with-deps
```

## Runtime Issues

### Problem: "No active page" error
**Symptoms**: Tools fail with "No active page" message

**Solutions**:
1. Ensure you called `launch_browser` first
2. Create a page with `new_page`
3. Verify page wasn't closed
4. Use `list_pages` to check active pages

**Example**:
```
1. launch_browser
2. new_page
3. navigate (url)  // Now this will work
```

### Problem: "Browser not launched" error
**Symptoms**: Operations fail before browser is ready

**Solutions**:
1. Always call `launch_browser` first
2. Check if previous browser session was closed properly
3. Verify browser launched successfully

### Problem: Timeout errors
**Symptoms**: "waiting for selector" timeout, "navigation timeout"

**Solutions**:
1. Increase timeout parameter: `timeout: 60000`
2. Check if selector is correct
3. Verify element exists on page
4. Use correct wait state: `waitUntil: "networkidle"`
5. Check network connectivity

**Example**:
```
// Instead of default 30s timeout
wait_for_selector({
  selector: ".slow-loading",
  timeout: 60000
})
```

### Problem: Selector not found
**Symptoms**: "No node found for selector" errors

**Solutions**:
1. Verify selector syntax is correct
2. Check if element is in iframe
3. Use browser DevTools to test selector
4. Wait for page to load: `wait_for_load_state`
5. Try alternative selectors:
   - Text: `text="Button Text"`
   - Data attribute: `[data-testid="submit"]`
   - CSS: `#id`, `.class`

**Debug steps**:
```
1. get_content  // Get full HTML
2. Inspect HTML for correct selector
3. Try simpler selector first
4. Add explicit wait before selector
```

### Problem: Element not visible/clickable
**Symptoms**: "Element is not visible", "Element is outside viewport"

**Solutions**:
1. Check visibility first: `is_visible(selector)`
2. Wait for element: `wait_for_selector(selector, state: "visible")`
3. Scroll to element: Use `evaluate` to scroll
4. Check if element is covered by another element
5. Increase viewport size

**Example**:
```
1. wait_for_selector (selector, state: "visible")
2. is_visible (selector)  // Verify
3. click (selector)
```

## MCP Integration Issues

### Problem: Server not connecting to MCP client
**Symptoms**: Server not listed, connection errors

**Solutions**:
1. Verify configuration path is absolute
2. Check server built successfully: `npm run build`
3. Test server directly: `npm start`
4. Check MCP client logs
5. Restart MCP client

**Configuration check**:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": ["/absolute/path/to/build/index.js"]
    }
  }
}
```

### Problem: Tools not appearing
**Symptoms**: Server connects but no tools available

**Solutions**:
1. Restart MCP client
2. Check server logs for errors
3. Verify build completed: check `build/index.js` exists
4. Test with `list_tools` request

### Problem: Tool calls fail silently
**Symptoms**: No response or generic errors

**Solutions**:
1. Check server logs (stderr output)
2. Verify parameters are correct
3. Test with simpler tool first (e.g., `get_url`)
4. Check for type mismatches in parameters

## Browser Issues

### Problem: Browser doesn't launch
**Symptoms**: Timeout or crash on launch

**Solutions**:
1. Check system dependencies (Linux):
   ```bash
   npx playwright install-deps
   ```
2. Try different browser: `browserType: "firefox"`
3. Use headless mode: `headless: true`
4. Check system resources (RAM, CPU)
5. Close other browsers/processes

### Problem: Headless vs headed behavior differs
**Symptoms**: Works in headed, fails in headless

**Solutions**:
1. Check viewport size (headless has different default)
2. Add explicit waits
3. Use `wait_for_load_state("networkidle")`
4. Screenshot in headless to debug
5. Some sites block headless browsers - set user agent

### Problem: Browser crashes
**Symptoms**: Unexpected browser closure, crash errors

**Solutions**:
1. Update Playwright: `npm update playwright`
2. Reinstall browsers: `npx playwright install --force`
3. Check system resources
4. Reduce concurrent operations
5. Close browser properly after use

## Page Management Issues

### Problem: Can't switch pages
**Symptoms**: "Page with ID not found"

**Solutions**:
1. Use `list_pages` to see available pages
2. Verify pageId is correct (case-sensitive)
3. Check if page was closed
4. Create page if it doesn't exist

### Problem: Multiple pages confusion
**Symptoms**: Operations happening on wrong page

**Solutions**:
1. Always use explicit pageIds
2. Call `list_pages` regularly
3. Switch to correct page before operations
4. Track current page in your workflow

## Performance Issues

### Problem: Operations are slow
**Symptoms**: High latency, timeouts

**Solutions**:
1. Use headless mode
2. Reduce viewport size
3. Use `wait_for_load_state("domcontentloaded")` instead of "networkidle"
4. Minimize waits and timeouts
5. Close unused pages

### Problem: Memory leaks
**Symptoms**: Memory usage grows over time

**Solutions**:
1. Always close browser when done
2. Close unused pages: `close_page`
3. Clear cookies periodically: `clear_cookies`
4. Restart server periodically for long sessions

## Screenshot/PDF Issues

### Problem: Screenshots are blank/white
**Symptoms**: Empty or white images

**Solutions**:
1. Wait for content: `wait_for_load_state("networkidle")`
2. Add delay: `wait_for_timeout(1000)`
3. Use `fullPage: false` for viewport only
4. Check if page actually loaded

### Problem: PDF generation fails
**Symptoms**: "PDF is not supported" error

**Solutions**:
1. PDFs only work with Chromium: `browserType: "chromium"`
2. Verify page is loaded
3. Check write permissions for path
4. Use absolute path for file

## Cookie Issues

### Problem: Cookies not persisting
**Symptoms**: Cookies disappear between navigations

**Solutions**:
1. Add cookies before navigation
2. Use correct domain: `domain: ".example.com"`
3. Check cookie path: `path: "/"`
4. Verify cookie not expired

### Problem: Can't get cookies
**Symptoms**: Empty cookie list

**Solutions**:
1. Navigate to page first
2. Specify correct URLs parameter
3. Check if cookies were set
4. Some cookies are httpOnly (can't be read by JS)

## JavaScript Execution Issues

### Problem: evaluate() fails
**Symptoms**: "Evaluation failed" errors

**Solutions**:
1. Check JavaScript syntax
2. Ensure page is loaded
3. Use page context, not Node context
4. Return serializable data (no functions, DOM nodes)

**Example**:
```javascript
// Good
evaluate({ script: "document.title" })

// Good
evaluate({ script: "Array.from(document.querySelectorAll('h1')).map(el => el.textContent)" })

// Bad - returns DOM node
evaluate({ script: "document.querySelector('h1')" })
```

## General Debugging Tips

### Enable verbose logging
Add console.error statements to src/index.ts:
```typescript
console.error("Tool called:", name);
console.error("Arguments:", JSON.stringify(args));
```

### Test incrementally
1. Start with simple tools
2. Test browser launch first
3. Test single page operations
4. Add complexity gradually

### Use screenshots liberally
Take screenshots at each step to verify state:
```
1. navigate (url)
2. screenshot (path: "step1.png")
3. click (selector)
4. screenshot (path: "step2.png")
```

### Check element state before action
```
1. wait_for_selector (selector)
2. is_visible (selector)
3. is_enabled (selector)
4. click (selector)
```

### Simplify selectors
Start with simple selectors and add specificity:
```
Try: "button"
Then: ".submit-button"  
Then: "form >> button.submit"
```

## Getting Help

### Check documentation
1. README.md - Full reference
2. EXAMPLES.md - Usage patterns
3. QUICK_REFERENCE.md - Tool summary
4. This file - Troubleshooting

### Debug checklist
- [ ] Node.js 18+ installed?
- [ ] Dependencies installed? (`npm install`)
- [ ] Project built? (`npm run build`)
- [ ] Playwright browsers installed? (`npx playwright install`)
- [ ] Browser launched before operations?
- [ ] Page created before navigation?
- [ ] Correct selector syntax?
- [ ] Sufficient timeout?
- [ ] Element visible before interaction?

### Test basic workflow
```bash
# Install and build
npm install
npm run build

# Test Playwright directly
npx playwright --version

# Run a simple test with MCP client:
1. launch_browser (headless: true)
2. new_page
3. navigate (url: "https://example.com")
4. get_title
5. close_browser
```

If this works, your setup is correct!

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "No active page" | No page created | Call `new_page` first |
| "Browser not launched" | No browser | Call `launch_browser` first |
| "Timeout 30000ms exceeded" | Element not found | Increase timeout or fix selector |
| "Executable doesn't exist" | Browsers not installed | Run `npx playwright install` |
| "Cannot find module" | Dependencies missing | Run `npm install` |
| "Page closed" | Page was closed | Create new page |
| "Target closed" | Browser crashed | Relaunch browser |

## Still Having Issues?

1. Check Playwright documentation: https://playwright.dev
2. Check MCP SDK documentation
3. Review server logs (stderr)
4. Test Playwright directly (outside MCP)
5. Simplify workflow to isolate issue
6. Create minimal reproduction case
