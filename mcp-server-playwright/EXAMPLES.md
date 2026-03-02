# Example Usage Guide

This document provides practical examples of using the MCP Playwright Server.

## Quick Start Example

Here's a simple workflow that demonstrates the basic capabilities:

### 1. Launch Browser and Create Page
```
Tool: launch_browser
Arguments: {
  "browserType": "chromium",
  "headless": true,
  "viewportWidth": 1920,
  "viewportHeight": 1080
}

Tool: new_page
Arguments: {
  "pageId": "main"
}
```

### 2. Navigate and Interact
```
Tool: navigate
Arguments: {
  "url": "https://www.saucedemo.com",
  "waitUntil": "networkidle"
}

Tool: fill
Arguments: {
  "selector": "#user-name",
  "text": "standard_user"
}

Tool: fill
Arguments: {
  "selector": "#password",
  "text": "secret_sauce"
}

Tool: click
Arguments: {
  "selector": "#login-button"
}
```

### 3. Verify and Extract Data
```
Tool: wait_for_selector
Arguments: {
  "selector": ".inventory_list",
  "state": "visible",
  "timeout": 5000
}

Tool: get_text
Arguments: {
  "selector": ".title"
}

Tool: count_elements
Arguments: {
  "selector": ".inventory_item"
}
```

### 4. Take Screenshot and Close
```
Tool: screenshot
Arguments: {
  "path": "./screenshots/inventory.png",
  "fullPage": true
}

Tool: close_browser
Arguments: {}
```

## Advanced Examples

### Example: Multi-Page Shopping Flow
```
1. launch_browser (headless: false)
2. new_page (pageId: "shop")
3. navigate to e-commerce site
4. fill search box
5. press "Enter"
6. wait_for_selector for results
7. click first product
8. new_page (pageId: "comparison")
9. navigate to competitor site
10. switch_page to "shop"
11. click "Add to Cart"
12. list_pages (to see all tabs)
```

### Example: Form Testing
```
1. launch_browser
2. new_page
3. navigate to form page
4. fill text input
5. select_option from dropdown
6. check checkbox
7. press "Tab" (to move focus)
8. type with delay (simulate human typing)
9. wait_for_timeout (2000)
10. click submit
11. wait_for_load_state ("networkidle")
12. is_visible for success message
```

### Example: Web Scraping
```
1. launch_browser (headless: true)
2. new_page
3. navigate to target site
4. wait_for_selector for content
5. evaluate JavaScript to extract data
6. count_elements for pagination
7. Loop through pages:
   - get_text from elements
   - click next button
   - wait_for_load_state
8. close_browser
```

### Example: Visual Testing
```
1. launch_browser (chromium)
2. new_page
3. navigate to page
4. set_viewport_size (1920x1080)
5. screenshot (desktop.png)
6. set_viewport_size (375x667)
7. screenshot (mobile.png)
8. emulate_media (colorScheme: "dark")
9. screenshot (dark-mode.png)
10. close_browser
```

### Example: Cookie Management
```
1. launch_browser
2. new_page
3. add_cookie (name: "session", value: "abc123", domain: ".example.com")
4. add_cookie (name: "preferences", value: "theme=dark")
5. navigate to site
6. get_cookies
7. navigate to different page
8. get_cookies (check persistence)
9. clear_cookies
10. reload (verify cookies cleared)
```

### Example: Complex Interactions
```
1. launch_browser
2. new_page
3. navigate to drag-drop page
4. drag_and_drop (sourceSelector: "#item1", targetSelector: "#dropzone")
5. wait_for_timeout (1000)
6. hover over element
7. wait_for_selector for tooltip
8. get_text from tooltip
9. press "Escape" (close tooltip)
10. screenshot
```

## Common Patterns

### Wait for Element Then Interact
```
1. wait_for_selector (selector, state: "visible")
2. is_enabled (selector)
3. click (selector)
```

### Fill Form with Validation
```
1. fill (selector, text)
2. press (selector, "Tab")
3. wait_for_timeout (500)
4. get_attribute (selector, "class") // Check for error class
```

### Navigate with Retry
```
1. navigate (url)
2. wait_for_load_state ("networkidle")
3. is_visible (expectedElement)
4. If not visible: reload and repeat
```

### Extract Table Data
```
1. count_elements ("table tr")
2. For each row:
   - get_text from each cell
   - Build data structure
3. evaluate to extract all at once
```

## Selector Tips

### Best Practices
- Use data-testid attributes when available: `[data-testid="submit"]`
- Prefer specific selectors over generic ones
- Use text selectors for unique text: `text="Sign In"`
- Combine selectors for specificity: `form >> button[type="submit"]`

### Common Selectors
```
CSS ID: #login-button
CSS Class: .btn-primary
Attribute: [name="username"]
Text: text="Click Here"
XPath: xpath=//button[contains(text(), 'Submit')]
Nested: div.form >> input[type="text"]
```

## Error Recovery

### Handle Timeouts
```
1. Try: wait_for_selector (timeout: 5000)
2. If fails: check is_visible
3. If not visible: reload page
4. Retry wait_for_selector
```

### Verify Before Action
```
1. is_visible (element)
2. is_enabled (element)
3. If both true: click (element)
4. Else: log error and skip
```

## Performance Tips

1. **Use appropriate wait conditions**:
   - `networkidle` for SPAs
   - `load` for traditional pages
   - `domcontentloaded` for fast operations

2. **Minimize timeouts**: Use shorter timeouts for elements that should be quick

3. **Batch operations**: Perform multiple gets/checks before interactions

4. **Headless mode**: Run headless for faster execution

5. **Viewport size**: Smaller viewports render faster

## Integration Examples

### With Test Frameworks
Use the MCP server through an MCP client to:
- Generate test cases from manual exploration
- Validate test results against live pages
- Debug failing tests interactively

### With AI Assistants
- "Navigate to saucedemo and login as standard_user"
- "Find all products and create a list with names and prices"
- "Fill the checkout form with test data"
- "Take screenshots of each step for documentation"

### With CI/CD
- Run the server in headless mode
- Execute browser operations as part of deployment verification
- Generate visual regression screenshots
- Validate production deployments

## Troubleshooting

### Common Issues

**Browser not launching**:
- Ensure Playwright browsers are installed: `npx playwright install`
- Check system dependencies

**Element not found**:
- Verify selector is correct
- Increase timeout
- Check if element is in iframe
- Wait for proper load state

**Screenshots are blank**:
- Ensure page is fully loaded
- Use fullPage: true for long pages
- Check viewport size

**Multiple pages confusion**:
- Use list_pages to see all open pages
- Always specify pageId when switching
- Track current page in your workflow

## Best Practices

1. **Always close browser**: Clean up resources when done
2. **Use meaningful page IDs**: Makes multi-page workflows easier
3. **Wait appropriately**: Don't rush interactions
4. **Verify before action**: Check visibility/enabled state
5. **Handle errors gracefully**: Expect timeouts and missing elements
6. **Take screenshots for debugging**: Visual proof of state
7. **Use specific selectors**: Avoid ambiguous selectors
8. **Test in both modes**: Verify headless and headed behavior

## Next Steps

- Integrate with your MCP client (Claude Desktop, etc.)
- Build custom workflows for your use cases
- Combine with other MCP servers for complex automation
- Create reusable patterns and templates
