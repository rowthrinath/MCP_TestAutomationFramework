# Quick Reference - MCP Playwright Tools

## Browser Lifecycle
| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `launch_browser` | Start browser | browserType, headless |
| `close_browser` | Close browser | - |
| `new_page` | Create tab | pageId (optional) |
| `close_page` | Close tab | pageId (optional) |
| `switch_page` | Switch tabs | pageId |
| `list_pages` | List all tabs | - |

## Navigation
| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `navigate` | Go to URL | url, waitUntil |
| `go_back` | Back button | - |
| `go_forward` | Forward button | - |
| `reload` | Refresh page | - |
| `get_url` | Current URL | - |
| `get_title` | Page title | - |
| `get_content` | Full HTML | - |

## Interactions
| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `click` | Click element | selector, button, clickCount |
| `fill` | Fill input | selector, text |
| `type` | Type text | selector, text, delay |
| `press` | Press key | key, selector (optional) |
| `select_option` | Select dropdown | selector, value |
| `check` | Check box | selector |
| `uncheck` | Uncheck box | selector |
| `hover` | Hover element | selector |
| `drag_and_drop` | Drag & drop | sourceSelector, targetSelector |

## Queries
| Tool | Purpose | Key Parameters | Returns |
|------|---------|----------------|---------|
| `get_text` | Get text | selector | String |
| `get_attribute` | Get attribute | selector, attribute | String |
| `get_property` | Get property | selector, property | JSON |
| `is_visible` | Check visible | selector | Boolean |
| `is_enabled` | Check enabled | selector | Boolean |
| `is_checked` | Check checked | selector | Boolean |
| `count_elements` | Count elements | selector | Number |

## Waiting
| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `wait_for_selector` | Wait for element | selector, state, timeout |
| `wait_for_timeout` | Wait duration | timeout |
| `wait_for_load_state` | Wait for load | state, timeout |

## Capture
| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `screenshot` | Take screenshot | path, selector, fullPage |
| `pdf` | Generate PDF | path, format |

## Advanced
| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `evaluate` | Run JavaScript | script |
| `set_viewport_size` | Set viewport | width, height |
| `emulate_media` | Emulate media | media, colorScheme |
| `add_cookie` | Add cookie | name, value, domain |
| `get_cookies` | Get cookies | urls (optional) |
| `clear_cookies` | Clear cookies | - |

## Common Selector Types
```
CSS:        #id, .class, tag, [attribute]
Text:       text="Exact text"
XPath:      xpath=//div[@class='example']
Data attr:  [data-testid="submit"]
Combined:   div >> text=Submit
```

## Typical Workflow
```
1. launch_browser
2. new_page
3. navigate (url)
4. wait_for_selector (element)
5. interact (click/fill/etc)
6. verify (get_text/is_visible/etc)
7. screenshot (optional)
8. close_browser
```

## Wait States
- `load` - Page loaded event
- `domcontentloaded` - DOM ready
- `networkidle` - No network activity
- `commit` - Navigation committed

## Element States
- `attached` - In DOM
- `detached` - Not in DOM
- `visible` - Visible on page
- `hidden` - Not visible

## Browser Types
- `chromium` - Chrome/Edge
- `firefox` - Firefox
- `webkit` - Safari

## Common Timeouts
- Default: 30000ms (30s)
- Network: 30000ms
- Quick checks: 5000ms
- Long operations: 60000ms

## Error Handling
All tools return error messages if they fail:
- "No active page" → Need to create page first
- "Browser not launched" → Need to launch browser
- Timeout errors → Element not found in time
- Selector errors → Invalid selector

## Pro Tips
✓ Use specific selectors (data-testid preferred)
✓ Wait for elements before interacting
✓ Verify state before actions (is_visible, is_enabled)
✓ Use meaningful page IDs for multi-page workflows
✓ Take screenshots for debugging
✓ Close browser when done
✓ Handle timeouts appropriately

## Quick Example
```
launch_browser → headless: true
new_page → pageId: "test"
navigate → url: "https://example.com"
wait_for_selector → selector: "h1"
get_text → selector: "h1"
screenshot → path: "page.png"
close_browser
```
