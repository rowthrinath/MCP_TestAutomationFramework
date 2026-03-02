import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium, firefox, webkit, Browser, BrowserContext, Page } from "playwright";

// Browser state management
let browser: Browser | null = null;
let context: BrowserContext | null = null;
const pages: Map<string, Page> = new Map();
let currentPageId: string | null = null;

// Helper to get current page
function getCurrentPage(): Page {
  if (!currentPageId || !pages.has(currentPageId)) {
    throw new Error("No active page. Use new_page tool to create a page first.");
  }
  return pages.get(currentPageId)!;
}

// Tool definitions
const tools: Tool[] = [
  {
    name: "launch_browser",
    description: "Launch a browser instance (chromium, firefox, or webkit). Options include headless mode, viewport size, and more.",
    inputSchema: {
      type: "object",
      properties: {
        browserType: {
          type: "string",
          enum: ["chromium", "firefox", "webkit"],
          description: "Type of browser to launch",
          default: "chromium",
        },
        headless: {
          type: "boolean",
          description: "Run browser in headless mode",
          default: true,
        },
        viewportWidth: {
          type: "number",
          description: "Viewport width in pixels",
          default: 1280,
        },
        viewportHeight: {
          type: "number",
          description: "Viewport height in pixels",
          default: 720,
        },
      },
    },
  },
  {
    name: "close_browser",
    description: "Close the browser instance and all associated pages",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "new_page",
    description: "Create a new page/tab in the browser. Returns a page ID.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "Optional custom ID for the page. If not provided, a UUID will be generated.",
        },
      },
    },
  },
  {
    name: "close_page",
    description: "Close a specific page by ID",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "ID of the page to close. If not provided, closes the current page.",
        },
      },
    },
  },
  {
    name: "switch_page",
    description: "Switch to a different page by ID",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "ID of the page to switch to",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "list_pages",
    description: "List all open pages with their IDs and URLs",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "navigate",
    description: "Navigate to a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to navigate to",
        },
        waitUntil: {
          type: "string",
          enum: ["load", "domcontentloaded", "networkidle", "commit"],
          description: "When to consider navigation successful",
          default: "load",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "go_back",
    description: "Navigate back in browser history",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "go_forward",
    description: "Navigate forward in browser history",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "reload",
    description: "Reload the current page",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "click",
    description: "Click on an element specified by selector",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector, text selector, or other Playwright selector",
        },
        button: {
          type: "string",
          enum: ["left", "right", "middle"],
          description: "Mouse button to click",
          default: "left",
        },
        clickCount: {
          type: "number",
          description: "Number of times to click",
          default: 1,
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "fill",
    description: "Fill an input field with text",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the input field",
        },
        text: {
          type: "string",
          description: "Text to fill",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "type",
    description: "Type text into an element character by character",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the element",
        },
        text: {
          type: "string",
          description: "Text to type",
        },
        delay: {
          type: "number",
          description: "Delay between key presses in milliseconds",
          default: 0,
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "press",
    description: "Press a keyboard key",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the element (optional, focuses on element first)",
        },
        key: {
          type: "string",
          description: "Key to press (e.g., 'Enter', 'Tab', 'Escape', 'A', 'Control+A')",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["key"],
    },
  },
  {
    name: "select_option",
    description: "Select option(s) in a <select> element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the select element",
        },
        value: {
          type: "string",
          description: "Value to select (can be value, label, or index)",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "check",
    description: "Check a checkbox or radio button",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the checkbox/radio",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "uncheck",
    description: "Uncheck a checkbox",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the checkbox",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "get_text",
    description: "Get text content of an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the element",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "get_attribute",
    description: "Get an attribute value from an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the element",
        },
        attribute: {
          type: "string",
          description: "Name of the attribute to get",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector", "attribute"],
    },
  },
  {
    name: "get_property",
    description: "Get a JavaScript property value from an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the element",
        },
        property: {
          type: "string",
          description: "Name of the property to get",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector", "property"],
    },
  },
  {
    name: "is_visible",
    description: "Check if an element is visible",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the element",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "is_enabled",
    description: "Check if an element is enabled",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the element",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "is_checked",
    description: "Check if a checkbox or radio button is checked",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the element",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "count_elements",
    description: "Count the number of elements matching a selector",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the elements",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "wait_for_selector",
    description: "Wait for an element to appear in the DOM",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector to wait for",
        },
        state: {
          type: "string",
          enum: ["attached", "detached", "visible", "hidden"],
          description: "State to wait for",
          default: "visible",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "wait_for_timeout",
    description: "Wait for a specified amount of time",
    inputSchema: {
      type: "object",
      properties: {
        timeout: {
          type: "number",
          description: "Time to wait in milliseconds",
        },
      },
      required: ["timeout"],
    },
  },
  {
    name: "wait_for_load_state",
    description: "Wait for a specific load state",
    inputSchema: {
      type: "object",
      properties: {
        state: {
          type: "string",
          enum: ["load", "domcontentloaded", "networkidle"],
          description: "Load state to wait for",
          default: "load",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
    },
  },
  {
    name: "screenshot",
    description: "Take a screenshot of the page or an element",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to save the screenshot",
        },
        selector: {
          type: "string",
          description: "Optional selector to screenshot a specific element",
        },
        fullPage: {
          type: "boolean",
          description: "Capture full scrollable page",
          default: false,
        },
        type: {
          type: "string",
          enum: ["png", "jpeg"],
          description: "Image type",
          default: "png",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "pdf",
    description: "Generate a PDF of the page (Chromium only)",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to save the PDF",
        },
        format: {
          type: "string",
          enum: ["Letter", "Legal", "Tabloid", "Ledger", "A0", "A1", "A2", "A3", "A4", "A5", "A6"],
          description: "Paper format",
          default: "A4",
        },
        printBackground: {
          type: "boolean",
          description: "Print background graphics",
          default: false,
        },
      },
      required: ["path"],
    },
  },
  {
    name: "evaluate",
    description: "Execute JavaScript in the page context",
    inputSchema: {
      type: "object",
      properties: {
        script: {
          type: "string",
          description: "JavaScript code to execute",
        },
      },
      required: ["script"],
    },
  },
  {
    name: "get_url",
    description: "Get the current page URL",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_title",
    description: "Get the current page title",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_content",
    description: "Get the full HTML content of the page",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "hover",
    description: "Hover over an element",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Selector for the element",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "drag_and_drop",
    description: "Drag and drop from one element to another",
    inputSchema: {
      type: "object",
      properties: {
        sourceSelector: {
          type: "string",
          description: "Selector for the source element",
        },
        targetSelector: {
          type: "string",
          description: "Selector for the target element",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["sourceSelector", "targetSelector"],
    },
  },
  {
    name: "set_viewport_size",
    description: "Set the viewport size",
    inputSchema: {
      type: "object",
      properties: {
        width: {
          type: "number",
          description: "Viewport width in pixels",
        },
        height: {
          type: "number",
          description: "Viewport height in pixels",
        },
      },
      required: ["width", "height"],
    },
  },
  {
    name: "emulate_media",
    description: "Emulate media type or color scheme",
    inputSchema: {
      type: "object",
      properties: {
        media: {
          type: "string",
          enum: ["screen", "print", "null"],
          description: "Media type to emulate",
        },
        colorScheme: {
          type: "string",
          enum: ["light", "dark", "no-preference", "null"],
          description: "Color scheme to emulate",
        },
      },
    },
  },
  {
    name: "add_cookie",
    description: "Add a cookie to the browser context",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Cookie name",
        },
        value: {
          type: "string",
          description: "Cookie value",
        },
        domain: {
          type: "string",
          description: "Cookie domain",
        },
        path: {
          type: "string",
          description: "Cookie path",
          default: "/",
        },
      },
      required: ["name", "value", "domain"],
    },
  },
  {
    name: "get_cookies",
    description: "Get all cookies for the current page or a specific URL",
    inputSchema: {
      type: "object",
      properties: {
        urls: {
          type: "array",
          items: { type: "string" },
          description: "Optional URLs to get cookies for",
        },
      },
    },
  },
  {
    name: "clear_cookies",
    description: "Clear all cookies",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: "mcp-server-playwright",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "launch_browser": {
        if (browser) {
          return {
            content: [{ type: "text", text: "Browser already launched. Close it first if you want to launch a new one." }],
          };
        }

        const browserType = (args?.browserType as string) || "chromium";
        const headless = args?.headless !== false;
        const viewportWidth = (args?.viewportWidth as number) || 1280;
        const viewportHeight = (args?.viewportHeight as number) || 720;

        const browserEngine = browserType === "firefox" ? firefox : browserType === "webkit" ? webkit : chromium;
        browser = await browserEngine.launch({ headless });
        context = await browser.newContext({
          viewport: { width: viewportWidth, height: viewportHeight },
        });

        return {
          content: [{ type: "text", text: `Browser (${browserType}) launched successfully in ${headless ? "headless" : "headed"} mode` }],
        };
      }

      case "close_browser": {
        if (!browser) {
          return {
            content: [{ type: "text", text: "No browser to close" }],
          };
        }

        await browser.close();
        browser = null;
        context = null;
        pages.clear();
        currentPageId = null;

        return {
          content: [{ type: "text", text: "Browser closed successfully" }],
        };
      }

      case "new_page": {
        if (!context) {
          throw new Error("Browser not launched. Use launch_browser first.");
        }

        const pageId = (args?.pageId as string) || `page-${Date.now()}`;
        if (pages.has(pageId)) {
          throw new Error(`Page with ID ${pageId} already exists`);
        }

        const page = await context.newPage();
        pages.set(pageId, page);
        currentPageId = pageId;

        return {
          content: [{ type: "text", text: `New page created with ID: ${pageId}` }],
        };
      }

      case "close_page": {
        const pageId = (args?.pageId as string) || currentPageId;
        if (!pageId || !pages.has(pageId)) {
          throw new Error(`Page with ID ${pageId} not found`);
        }

        const page = pages.get(pageId)!;
        await page.close();
        pages.delete(pageId);

        if (currentPageId === pageId) {
          currentPageId = pages.size > 0 ? Array.from(pages.keys())[0] : null;
        }

        return {
          content: [{ type: "text", text: `Page ${pageId} closed. Current page: ${currentPageId || "none"}` }],
        };
      }

      case "switch_page": {
        const pageId = args?.pageId as string;
        if (!pages.has(pageId)) {
          throw new Error(`Page with ID ${pageId} not found`);
        }

        currentPageId = pageId;
        return {
          content: [{ type: "text", text: `Switched to page: ${pageId}` }],
        };
      }

      case "list_pages": {
        const pageList = await Promise.all(
          Array.from(pages.entries()).map(async ([id, page]) => ({
            id,
            url: page.url(),
            title: await page.title(),
            isCurrent: id === currentPageId,
          }))
        );

        return {
          content: [{ type: "text", text: JSON.stringify(pageList, null, 2) }],
        };
      }

      case "navigate": {
        const page = getCurrentPage();
        const url = args?.url as string;
        const waitUntil = (args?.waitUntil as any) || "load";

        await page.goto(url, { waitUntil });
        return {
          content: [{ type: "text", text: `Navigated to ${url}` }],
        };
      }

      case "go_back": {
        const page = getCurrentPage();
        await page.goBack();
        return {
          content: [{ type: "text", text: `Navigated back to ${page.url()}` }],
        };
      }

      case "go_forward": {
        const page = getCurrentPage();
        await page.goForward();
        return {
          content: [{ type: "text", text: `Navigated forward to ${page.url()}` }],
        };
      }

      case "reload": {
        const page = getCurrentPage();
        await page.reload();
        return {
          content: [{ type: "text", text: "Page reloaded" }],
        };
      }

      case "click": {
        const page = getCurrentPage();
        const selector = args?.selector as string;
        const button = (args?.button as any) || "left";
        const clickCount = (args?.clickCount as number) || 1;
        const timeout = (args?.timeout as number) || 30000;

        await page.click(selector, { button, clickCount, timeout });
        return {
          content: [{ type: "text", text: `Clicked on ${selector}` }],
        };
      }

      case "fill": {
        const page = getCurrentPage();
        const selector = args?.selector as string;
        const text = args?.text as string;
        const timeout = (args?.timeout as number) || 30000;

        await page.fill(selector, text, { timeout });
        return {
          content: [{ type: "text", text: `Filled ${selector} with text` }],
        };
      }

      case "type": {
        const page = getCurrentPage();
        const selector = args?.selector as string;
        const text = args?.text as string;
        const delay = (args?.delay as number) || 0;
        const timeout = (args?.timeout as number) || 30000;

        await page.type(selector, text, { delay, timeout });
        return {
          content: [{ type: "text", text: `Typed text into ${selector}` }],
        };
      }

      case "press": {
        const page = getCurrentPage();
        const selector = args?.selector as string;
        const key = args?.key as string;
        const timeout = (args?.timeout as number) || 30000;

        if (selector) {
          await page.press(selector, key, { timeout });
        } else {
          await page.keyboard.press(key);
        }
        return {
          content: [{ type: "text", text: `Pressed key: ${key}` }],
        };
      }

      case "select_option": {
        const page = getCurrentPage();
        const selector = args?.selector as string;
        const value = args?.value as string;
        const timeout = (args?.timeout as number) || 30000;

        await page.selectOption(selector, value, { timeout });
        return {
          content: [{ type: "text", text: `Selected option ${value} in ${selector}` }],
        };
      }

      case "check": {
        const page = getCurrentPage();
        const selector = args?.selector as string;
        const timeout = (args?.timeout as number) || 30000;

        await page.check(selector, { timeout });
        return {
          content: [{ type: "text", text: `Checked ${selector}` }],
        };
      }

      case "uncheck": {
        const page = getCurrentPage();
        const selector = args?.selector as string;
        const timeout = (args?.timeout as number) || 30000;

        await page.uncheck(selector, { timeout });
        return {
          content: [{ type: "text", text: `Unchecked ${selector}` }],
        };
      }

      case "get_text": {
        const page = getCurrentPage();
        const selector = args?.selector as string;
        const timeout = (args?.timeout as number) || 30000;

        const text = await page.textContent(selector, { timeout });
        return {
          content: [{ type: "text", text: text || "" }],
        };
      }

      case "get_attribute": {
        const page = getCurrentPage();
        const selector = args?.selector as string;
        const attribute = args?.attribute as string;
        const timeout = (args?.timeout as number) || 30000;

        const value = await page.getAttribute(selector, attribute, { timeout });
        return {
          content: [{ type: "text", text: value || "" }],
        };
      }

      case "get_property": {
        const page = getCurrentPage();
        const selector = args?.selector as string;
        const property = args?.property as string;
        const timeout = (args?.timeout as number) || 30000;

        const element = await page.waitForSelector(selector, { timeout });
        const value = await element?.evaluate((el, prop) => (el as any)[prop], property);
        return {
          content: [{ type: "text", text: JSON.stringify(value) }],
        };
      }

      case "is_visible": {
        const page = getCurrentPage();
        const selector = args?.selector as string;

        const isVisible = await page.isVisible(selector);
        return {
          content: [{ type: "text", text: JSON.stringify(isVisible) }],
        };
      }

      case "is_enabled": {
        const page = getCurrentPage();
        const selector = args?.selector as string;

        const isEnabled = await page.isEnabled(selector);
        return {
          content: [{ type: "text", text: JSON.stringify(isEnabled) }],
        };
      }

      case "is_checked": {
        const page = getCurrentPage();
        const selector = args?.selector as string;

        const isChecked = await page.isChecked(selector);
        return {
          content: [{ type: "text", text: JSON.stringify(isChecked) }],
        };
      }

      case "count_elements": {
        const page = getCurrentPage();
        const selector = args?.selector as string;

        const count = await page.locator(selector).count();
        return {
          content: [{ type: "text", text: JSON.stringify(count) }],
        };
      }

      case "wait_for_selector": {
        const page = getCurrentPage();
        const selector = args?.selector as string;
        const state = (args?.state as any) || "visible";
        const timeout = (args?.timeout as number) || 30000;

        await page.waitForSelector(selector, { state, timeout });
        return {
          content: [{ type: "text", text: `Element ${selector} is now ${state}` }],
        };
      }

      case "wait_for_timeout": {
        const page = getCurrentPage();
        const timeout = args?.timeout as number;

        await page.waitForTimeout(timeout);
        return {
          content: [{ type: "text", text: `Waited for ${timeout}ms` }],
        };
      }

      case "wait_for_load_state": {
        const page = getCurrentPage();
        const state = (args?.state as any) || "load";
        const timeout = (args?.timeout as number) || 30000;

        await page.waitForLoadState(state, { timeout });
        return {
          content: [{ type: "text", text: `Page reached ${state} state` }],
        };
      }

      case "screenshot": {
        const page = getCurrentPage();
        const path = args?.path as string;
        const selector = args?.selector as string;
        const fullPage = (args?.fullPage as boolean) || false;
        const type = (args?.type as "png" | "jpeg") || "png";

        if (selector) {
          const element = await page.locator(selector);
          await element.screenshot({ path, type });
        } else {
          await page.screenshot({ path, fullPage, type });
        }

        return {
          content: [{ type: "text", text: `Screenshot saved to ${path}` }],
        };
      }

      case "pdf": {
        const page = getCurrentPage();
        const path = args?.path as string;
        const format = (args?.format as any) || "A4";
        const printBackground = (args?.printBackground as boolean) || false;

        await page.pdf({ path, format, printBackground });
        return {
          content: [{ type: "text", text: `PDF saved to ${path}` }],
        };
      }

      case "evaluate": {
        const page = getCurrentPage();
        const script = args?.script as string;

        const result = await page.evaluate(script);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      }

      case "get_url": {
        const page = getCurrentPage();
        return {
          content: [{ type: "text", text: page.url() }],
        };
      }

      case "get_title": {
        const page = getCurrentPage();
        const title = await page.title();
        return {
          content: [{ type: "text", text: title }],
        };
      }

      case "get_content": {
        const page = getCurrentPage();
        const content = await page.content();
        return {
          content: [{ type: "text", text: content }],
        };
      }

      case "hover": {
        const page = getCurrentPage();
        const selector = args?.selector as string;
        const timeout = (args?.timeout as number) || 30000;

        await page.hover(selector, { timeout });
        return {
          content: [{ type: "text", text: `Hovered over ${selector}` }],
        };
      }

      case "drag_and_drop": {
        const page = getCurrentPage();
        const sourceSelector = args?.sourceSelector as string;
        const targetSelector = args?.targetSelector as string;
        const timeout = (args?.timeout as number) || 30000;

        await page.dragAndDrop(sourceSelector, targetSelector, { timeout });
        return {
          content: [{ type: "text", text: `Dragged ${sourceSelector} to ${targetSelector}` }],
        };
      }

      case "set_viewport_size": {
        const page = getCurrentPage();
        const width = args?.width as number;
        const height = args?.height as number;

        await page.setViewportSize({ width, height });
        return {
          content: [{ type: "text", text: `Viewport size set to ${width}x${height}` }],
        };
      }

      case "emulate_media": {
        const page = getCurrentPage();
        const media = args?.media as any;
        const colorScheme = args?.colorScheme as any;

        await page.emulateMedia({
          media: media === "null" ? null : media,
          colorScheme: colorScheme === "null" ? null : colorScheme,
        });
        return {
          content: [{ type: "text", text: `Media emulation updated` }],
        };
      }

      case "add_cookie": {
        if (!context) {
          throw new Error("Browser not launched");
        }

        const name = args?.name as string;
        const value = args?.value as string;
        const domain = args?.domain as string;
        const path = (args?.path as string) || "/";

        await context.addCookies([{ name, value, domain, path }]);
        return {
          content: [{ type: "text", text: `Cookie ${name} added` }],
        };
      }

      case "get_cookies": {
        if (!context) {
          throw new Error("Browser not launched");
        }

        const urls = args?.urls as string[];
        const cookies = await context.cookies(urls);
        return {
          content: [{ type: "text", text: JSON.stringify(cookies, null, 2) }],
        };
      }

      case "clear_cookies": {
        if (!context) {
          throw new Error("Browser not launched");
        }

        await context.clearCookies();
        return {
          content: [{ type: "text", text: "All cookies cleared" }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Playwright Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
