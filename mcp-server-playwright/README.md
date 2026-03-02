# MCP Server for Playwright Browser Automation

A comprehensive Model Context Protocol (MCP) server that provides tools for performing all browser operations using Playwright. This server enables AI assistants to automate browser interactions, perform web scraping, testing, and any other browser-based automation tasks.

## Features

This MCP server provides 45+ tools covering all major browser operations:

### Browser Management
- **launch_browser**: Launch Chromium, Firefox, or WebKit browsers
- **close_browser**: Close the browser instance
- **new_page**: Create new browser tabs/pages
- **close_page**: Close specific pages
- **switch_page**: Switch between open pages
- **list_pages**: List all open pages with URLs and titles

### Navigation
- **navigate**: Navigate to URLs
- **go_back**: Go back in browser history
- **go_forward**: Go forward in browser history
- **reload**: Reload the current page
- **get_url**: Get current page URL
- **get_title**: Get page title
- **get_content**: Get full HTML content

### Element Interactions
- **click**: Click elements with various options (button type, click count)
- **fill**: Fill input fields
- **type**: Type text character by character
- **press**: Press keyboard keys
- **select_option**: Select options in dropdowns
- **check**: Check checkboxes/radio buttons
- **uncheck**: Uncheck checkboxes
- **hover**: Hover over elements
- **drag_and_drop**: Drag and drop between elements

### Element Queries
- **get_text**: Get text content of elements
- **get_attribute**: Get element attributes
- **get_property**: Get JavaScript properties
- **is_visible**: Check if element is visible
- **is_enabled**: Check if element is enabled
- **is_checked**: Check if checkbox is checked
- **count_elements**: Count elements matching selector

### Waiting & Synchronization
- **wait_for_selector**: Wait for elements to appear
- **wait_for_timeout**: Wait for specific duration
- **wait_for_load_state**: Wait for page load states

### Screenshots & PDFs
- **screenshot**: Take full page or element screenshots
- **pdf**: Generate PDFs (Chromium only)

### Advanced Features
- **evaluate**: Execute JavaScript in page context
- **set_viewport_size**: Change viewport dimensions
- **emulate_media**: Emulate media types and color schemes
- **add_cookie**: Add cookies to browser context
- **get_cookies**: Retrieve cookies
- **clear_cookies**: Clear all cookies

## Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Setup

1. **Clone or navigate to the project directory:**
```bash
cd mcp-server-playwright
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
```bash
npm run build
```

4. **Install Playwright browsers (first time only):**
```bash
npx playwright install
```

## Usage

### Running the Server

The server communicates via stdio and is designed to be used with MCP clients.

```bash
npm start
```

Or directly:
```bash
node build/index.js
```

### Configuration for Claude Desktop (or other MCP clients)

Add to your MCP client configuration (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": [
        "/Users/rowthrinathnatarajan/Projects/automationframeworks-mcp/mcp-server-playwright/build/index.js"
      ]
    }
  }
}
```

## Example Workflows

### Example 1: Basic Web Navigation and Scraping

```
1. launch_browser with headless=true
2. new_page
3. navigate to "https://example.com"
4. wait_for_selector with selector="h1"
5. get_text from "h1"
6. screenshot with path="example.png"
7. close_browser
```

### Example 2: Form Interaction

```
1. launch_browser with headless=false
2. new_page
3. navigate to "https://example.com/form"
4. fill selector="#username" with "testuser"
5. fill selector="#password" with "password123"
6. click selector="button[type='submit']"
7. wait_for_load_state with state="networkidle"
8. get_title
```

### Example 3: Multi-Page Management

```
1. launch_browser
2. new_page with pageId="google"
3. navigate to "https://google.com"
4. new_page with pageId="github"
5. navigate to "https://github.com"
6. list_pages
7. switch_page to pageId="google"
8. get_url
```

### Example 4: Testing and Assertions

```
1. launch_browser
2. new_page
3. navigate to "https://example.com"
4. is_visible selector=".login-button"
5. is_enabled selector=".login-button"
6. click selector=".login-button"
7. wait_for_selector selector=".dashboard" with state="visible"
```

## Tool Reference

### Browser Lifecycle

#### launch_browser
Launches a browser instance.

**Parameters:**
- `browserType` (string): "chromium", "firefox", or "webkit" (default: "chromium")
- `headless` (boolean): Run in headless mode (default: true)
- `viewportWidth` (number): Viewport width in pixels (default: 1280)
- `viewportHeight` (number): Viewport height in pixels (default: 720)

#### close_browser
Closes the browser and all pages.

#### new_page
Creates a new page/tab.

**Parameters:**
- `pageId` (string, optional): Custom ID for the page

**Returns:** Page ID

#### close_page
Closes a specific page.

**Parameters:**
- `pageId` (string, optional): ID of page to close (defaults to current page)

#### switch_page
Switches to a different page.

**Parameters:**
- `pageId` (string, required): ID of page to switch to

#### list_pages
Lists all open pages with their IDs, URLs, and titles.

### Navigation

#### navigate
Navigates to a URL.

**Parameters:**
- `url` (string, required): URL to navigate to
- `waitUntil` (string): "load", "domcontentloaded", "networkidle", or "commit" (default: "load")

#### go_back / go_forward / reload
Navigate browser history or reload page.

#### get_url / get_title / get_content
Retrieve page information.

### Element Interactions

#### click
Clicks an element.

**Parameters:**
- `selector` (string, required): Element selector
- `button` (string): "left", "right", or "middle" (default: "left")
- `clickCount` (number): Number of clicks (default: 1)
- `timeout` (number): Timeout in ms (default: 30000)

#### fill
Fills an input field.

**Parameters:**
- `selector` (string, required): Input selector
- `text` (string, required): Text to fill
- `timeout` (number): Timeout in ms (default: 30000)

#### type
Types text character by character.

**Parameters:**
- `selector` (string, required): Element selector
- `text` (string, required): Text to type
- `delay` (number): Delay between keystrokes in ms (default: 0)
- `timeout` (number): Timeout in ms (default: 30000)

#### press
Presses a keyboard key.

**Parameters:**
- `selector` (string, optional): Element to focus first
- `key` (string, required): Key to press (e.g., "Enter", "Tab", "Control+A")
- `timeout` (number): Timeout in ms (default: 30000)

#### select_option
Selects an option in a `<select>` element.

**Parameters:**
- `selector` (string, required): Select element selector
- `value` (string, required): Value to select
- `timeout` (number): Timeout in ms (default: 30000)

#### check / uncheck
Checks or unchecks checkboxes.

**Parameters:**
- `selector` (string, required): Checkbox selector
- `timeout` (number): Timeout in ms (default: 30000)

#### hover
Hovers over an element.

**Parameters:**
- `selector` (string, required): Element selector
- `timeout` (number): Timeout in ms (default: 30000)

#### drag_and_drop
Drags one element to another.

**Parameters:**
- `sourceSelector` (string, required): Source element
- `targetSelector` (string, required): Target element
- `timeout` (number): Timeout in ms (default: 30000)

### Element Queries

#### get_text
Gets text content of an element.

**Parameters:**
- `selector` (string, required): Element selector
- `timeout` (number): Timeout in ms (default: 30000)

**Returns:** Text content

#### get_attribute
Gets an attribute value.

**Parameters:**
- `selector` (string, required): Element selector
- `attribute` (string, required): Attribute name
- `timeout` (number): Timeout in ms (default: 30000)

**Returns:** Attribute value

#### get_property
Gets a JavaScript property value.

**Parameters:**
- `selector` (string, required): Element selector
- `property` (string, required): Property name
- `timeout` (number): Timeout in ms (default: 30000)

**Returns:** Property value (JSON)

#### is_visible / is_enabled / is_checked
Checks element state.

**Parameters:**
- `selector` (string, required): Element selector
- `timeout` (number): Timeout in ms (default: 30000)

**Returns:** Boolean (as JSON string)

#### count_elements
Counts elements matching a selector.

**Parameters:**
- `selector` (string, required): Element selector

**Returns:** Number of elements

### Waiting

#### wait_for_selector
Waits for an element to reach a specific state.

**Parameters:**
- `selector` (string, required): Element selector
- `state` (string): "attached", "detached", "visible", or "hidden" (default: "visible")
- `timeout` (number): Timeout in ms (default: 30000)

#### wait_for_timeout
Waits for a specific duration.

**Parameters:**
- `timeout` (number, required): Time to wait in ms

#### wait_for_load_state
Waits for page to reach a load state.

**Parameters:**
- `state` (string): "load", "domcontentloaded", or "networkidle" (default: "load")
- `timeout` (number): Timeout in ms (default: 30000)

### Screenshots & PDFs

#### screenshot
Takes a screenshot.

**Parameters:**
- `path` (string, required): File path to save screenshot
- `selector` (string, optional): Element to screenshot
- `fullPage` (boolean): Capture full scrollable page (default: false)
- `type` (string): "png" or "jpeg" (default: "png")

#### pdf
Generates a PDF (Chromium only).

**Parameters:**
- `path` (string, required): File path to save PDF
- `format` (string): Paper format (default: "A4")
- `printBackground` (boolean): Print backgrounds (default: false)

### Advanced

#### evaluate
Executes JavaScript in page context.

**Parameters:**
- `script` (string, required): JavaScript code to execute

**Returns:** Result (as JSON)

#### set_viewport_size
Sets viewport dimensions.

**Parameters:**
- `width` (number, required): Width in pixels
- `height` (number, required): Height in pixels

#### emulate_media
Emulates media type or color scheme.

**Parameters:**
- `media` (string): "screen", "print", or "null"
- `colorScheme` (string): "light", "dark", "no-preference", or "null"

#### add_cookie
Adds a cookie.

**Parameters:**
- `name` (string, required): Cookie name
- `value` (string, required): Cookie value
- `domain` (string, required): Cookie domain
- `path` (string): Cookie path (default: "/")

#### get_cookies
Retrieves cookies.

**Parameters:**
- `urls` (array of strings, optional): URLs to get cookies for

**Returns:** Array of cookies (as JSON)

#### clear_cookies
Clears all cookies.

## Selectors

Playwright supports various selector strategies:

- **CSS**: `button.submit`, `#login-form`, `div > p`
- **Text**: `text=Click me`, `text="Exact text"`
- **XPath**: `xpath=//button[@type="submit"]`
- **Data attributes**: `[data-testid="submit-button"]`
- **Combined**: `div >> text=Submit`

## Error Handling

All tools return error information in the response if an operation fails. Common errors include:

- "No active page": You need to create a page with `new_page` first
- "Browser not launched": You need to launch a browser first
- Timeout errors: Element not found within the timeout period
- Selector errors: Invalid or non-existent selector

## Development

### Project Structure

```
mcp-server-playwright/
├── src/
│   └── index.ts          # Main server implementation
├── build/                # Compiled JavaScript output
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

### Building

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Support

For issues, questions, or contributions, please open an issue on the project repository.

## Credits

Built with:
- [Playwright](https://playwright.dev/) - Browser automation library
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol) - MCP implementation
