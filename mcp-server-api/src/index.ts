#!/usr/bin/env node

import dotenv from "dotenv";
// Suppress dotenv's console output during loading
const originalLog = console.log;
console.log = () => {};
dotenv.config({ debug: false });
console.log = originalLog;

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance, AxiosResponse, AxiosError } from "axios";
import { Buffer } from "node:buffer";
import { exit } from "node:process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { exec } from "node:child_process";

// API request state management
interface ApiResponse {
  status: number;
  headers: Record<string, any>;
  body: any;
  time: number;
  url: string;
  method: string;
}

let lastResponse: ApiResponse | null = null;
let axiosInstance: AxiosInstance;
const cookies: Record<string, string> = {};
const authTokens: Record<string, string> = {};
let defaultHeaders: Record<string, string> = {
  "Content-Type": "application/json",
};

// Report step tracking
interface ApiReportStep {
  stepNumber: number;
  timestamp: string;
  toolName: string;
  // Request details (for HTTP tools)
  method?: string;
  url?: string;
  requestHeaders?: Record<string, any>;
  requestBody?: any;
  queryParams?: Record<string, any>;
  // Response details (for HTTP tools)
  responseStatus?: number;
  responseHeaders?: Record<string, any>;
  responseBody?: any;
  responseTime?: number;
  // Result
  result: "pass" | "fail" | "info";
  message: string;
  error?: string;
}

let reportSteps: ApiReportStep[] = [];
let reportStartTime: number = 0;

// Initialize axios instance
function initializeAxios() {
  axiosInstance = axios.create({
    validateStatus: () => true, // Don't throw on any status code
    timeout: 30000,
  });
}

initializeAxios();

// Sensitive data masking
const SENSITIVE_HEADERS = [
  "authorization",
  "x-api-key",
  "x-auth-token",
  "api-key",
  "token",
  "password",
  "secret",
  "jwt",
  "bearer",
];

const SENSITIVE_FIELDS = ["password", "token", "secret", "api_key", "apiKey", "auth_token", "authToken", "bearer"];

function maskSensitiveValue(value: string, headerName?: string): string {
  if (!value || typeof value !== "string") return value;

  // Check if header is sensitive
  if (headerName && SENSITIVE_HEADERS.includes(headerName.toLowerCase())) {
    const length = value.length;
    if (length <= 4) return "***";
    // Show first 4 chars and last 4 chars
    return `${value.substring(0, 4)}...${value.substring(length - 4)}`;
  }

  return value;
}

function maskHeaders(headers: Record<string, any>): Record<string, any> {
  const masked: Record<string, any> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
      masked[key] = maskSensitiveValue(value, key);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

function maskObject(obj: any, depth: number = 0): any {
  if (depth > 10) return obj; // Prevent infinite recursion
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => maskObject(item, depth + 1));
  }

  const masked: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      if (typeof value === "string") {
        masked[key] = maskSensitiveValue(value, key);
      } else {
        masked[key] = "***";
      }
    } else if (typeof value === "object") {
      masked[key] = maskObject(value, depth + 1);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

// Helper to get bearer token from environment or authTokens
function getBearerToken(tokenName: string = "DEFAULT"): string | null {
  // First check if token is in authTokens (set via set_auth_bearer tool)
  if (authTokens[tokenName]) {
    return authTokens[tokenName];
  }

  // Check environment variables
  const envTokenName = `BEARER_TOKEN${tokenName === "DEFAULT" ? "" : "_" + tokenName}`;
  const envToken = process.env[envTokenName];
  
  if (envToken) {
    return envToken;
  }

  // Fallback to generic BEARER_TOKEN
  if (tokenName !== "DEFAULT" && process.env.BEARER_TOKEN) {
    return process.env.BEARER_TOKEN;
  }

  return null;
}

// Utility functions
function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

function parseBody(body: any): any {
  if (typeof body === "string") {
    return isValidJSON(body) ? JSON.parse(body) : body;
  }
  return body;
}

function validateStatusCode(actual: number, expected: number | number[]): boolean {
  if (Array.isArray(expected)) {
    return expected.includes(actual);
  }
  return actual === expected;
}

function validateContentType(headers: Record<string, any>, expectedType: string): boolean {
  const contentType = (headers["content-type"] || headers["Content-Type"] || "").toLowerCase();
  return contentType.includes(expectedType.toLowerCase());
}

function validateJSONSchema(data: any, schema: Record<string, any>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Basic schema validation
  if (schema.type && typeof data !== schema.type) {
    errors.push(`Type mismatch: expected ${schema.type}, got ${typeof data}`);
  }

  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (!(field in data)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  if (schema.properties && typeof data === "object" && data !== null) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        const propDef = propSchema as Record<string, any>;
        if (propDef.type && typeof data[key] !== propDef.type) {
          errors.push(`Field '${key}': expected ${propDef.type}, got ${typeof data[key]}`);
        }
        if (propDef.enum && !propDef.enum.includes(data[key])) {
          errors.push(`Field '${key}': value must be one of ${propDef.enum.join(", ")}`);
        }
        if (propDef.minLength && typeof data[key] === "string" && data[key].length < propDef.minLength) {
          errors.push(`Field '${key}': minimum length is ${propDef.minLength}`);
        }
        if (propDef.maxLength && typeof data[key] === "string" && data[key].length > propDef.maxLength) {
          errors.push(`Field '${key}': maximum length is ${propDef.maxLength}`);
        }
        if (propDef.minimum && typeof data[key] === "number" && data[key] < propDef.minimum) {
          errors.push(`Field '${key}': minimum value is ${propDef.minimum}`);
        }
        if (propDef.maximum && typeof data[key] === "number" && data[key] > propDef.maximum) {
          errors.push(`Field '${key}': maximum value is ${propDef.maximum}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Tool definitions
const tools: Tool[] = [
  // HTTP Verb Tools
  {
    name: "http_get",
    description: "Send a GET request to a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to request" },
        headers: { type: "object", description: "Custom headers" },
        params: { type: "object", description: "Query parameters" },
        auth: { type: "string", description: "Bearer token for Authorization" },
        validateStatus: { type: "number", description: "Expected status code" },
      },
      required: ["url"],
    },
  },
  {
    name: "http_post",
    description: "Send a POST request to a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to request" },
        body: { type: "string", description: "Request body (JSON string or form data)" },
        headers: { type: "object", description: "Custom headers" },
        params: { type: "object", description: "Query parameters" },
        auth: { type: "string", description: "Bearer token for Authorization" },
        validateStatus: { type: "number", description: "Expected status code" },
      },
      required: ["url"],
    },
  },
  {
    name: "http_put",
    description: "Send a PUT request to a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to request" },
        body: { type: "string", description: "Request body (JSON string)" },
        headers: { type: "object", description: "Custom headers" },
        params: { type: "object", description: "Query parameters" },
        auth: { type: "string", description: "Bearer token for Authorization" },
        validateStatus: { type: "number", description: "Expected status code" },
      },
      required: ["url", "body"],
    },
  },
  {
    name: "http_patch",
    description: "Send a PATCH request to a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to request" },
        body: { type: "string", description: "Request body (JSON string)" },
        headers: { type: "object", description: "Custom headers" },
        params: { type: "object", description: "Query parameters" },
        auth: { type: "string", description: "Bearer token for Authorization" },
        validateStatus: { type: "number", description: "Expected status code" },
      },
      required: ["url", "body"],
    },
  },
  {
    name: "http_delete",
    description: "Send a DELETE request to a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to request" },
        headers: { type: "object", description: "Custom headers" },
        params: { type: "object", description: "Query parameters" },
        auth: { type: "string", description: "Bearer token for Authorization" },
        validateStatus: { type: "number", description: "Expected status code" },
      },
      required: ["url"],
    },
  },
  {
    name: "http_head",
    description: "Send a HEAD request to a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to request" },
        headers: { type: "object", description: "Custom headers" },
        params: { type: "object", description: "Query parameters" },
        auth: { type: "string", description: "Bearer token for Authorization" },
        validateStatus: { type: "number", description: "Expected status code" },
      },
      required: ["url"],
    },
  },
  {
    name: "http_options",
    description: "Send an OPTIONS request to a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to request" },
        headers: { type: "object", description: "Custom headers" },
        auth: { type: "string", description: "Bearer token for Authorization" },
        validateStatus: { type: "number", description: "Expected status code" },
      },
      required: ["url"],
    },
  },

  // Response Inspection Tools
  {
    name: "get_response_status",
    description: "Get the status code from the last response",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_response_headers",
    description: "Get all headers from the last response",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_response_body",
    description: "Get the body from the last response",
    inputSchema: {
      type: "object",
      properties: {
        jsonPath: { type: "string", description: "JSON path to extract specific value (e.g., 'user.id')" },
      },
    },
  },
  {
    name: "get_response_time",
    description: "Get the response time from the last request",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_full_response",
    description: "Get the complete last response (status, headers, body, time)",
    inputSchema: { type: "object", properties: {} },
  },

  // Response Validation Tools
  {
    name: "validate_status_code",
    description: "Validate the status code of the last response",
    inputSchema: {
      type: "object",
      properties: {
        expectedStatus: {
          type: "string",
          description: "Expected status code (single: '200' or multiple: '200,201,202')",
        },
      },
      required: ["expectedStatus"],
    },
  },
  {
    name: "validate_content_type",
    description: "Validate the content type of the last response",
    inputSchema: {
      type: "object",
      properties: {
        expectedType: {
          type: "string",
          enum: ["application/json", "text/plain", "text/html", "application/xml", "text/csv"],
          description: "Expected content type",
        },
      },
      required: ["expectedType"],
    },
  },
  {
    name: "validate_response_contains",
    description: "Validate that response body contains specific text or value",
    inputSchema: {
      type: "object",
      properties: {
        value: { type: "string", description: "Value to search for" },
        field: { type: "string", description: "Optional field to search in (JSON path)" },
      },
      required: ["value"],
    },
  },
  {
    name: "validate_response_not_contains",
    description: "Validate that response body does NOT contain specific text or value",
    inputSchema: {
      type: "object",
      properties: {
        value: { type: "string", description: "Value that should not be present" },
      },
      required: ["value"],
    },
  },

  // Schema Validation Tools
  {
    name: "validate_json_schema",
    description: "Validate response body against a JSON schema",
    inputSchema: {
      type: "object",
      properties: {
        schema: {
          type: "string",
          description: "JSON schema as a string",
        },
      },
      required: ["schema"],
    },
  },
  {
    name: "validate_required_fields",
    description: "Validate that response contains all required fields",
    inputSchema: {
      type: "object",
      properties: {
        fields: {
          type: "string",
          description: "Comma-separated list of required field names or JSON paths",
        },
      },
      required: ["fields"],
    },
  },
  {
    name: "validate_field_type",
    description: "Validate that a field in the response has the correct data type",
    inputSchema: {
      type: "object",
      properties: {
        field: { type: "string", description: "JSON path to the field" },
        expectedType: {
          type: "string",
          enum: ["string", "number", "boolean", "array", "object", "null"],
          description: "Expected data type",
        },
      },
      required: ["field", "expectedType"],
    },
  },
  {
    name: "validate_field_value",
    description: "Validate that a field has a specific value",
    inputSchema: {
      type: "object",
      properties: {
        field: { type: "string", description: "JSON path to the field" },
        expectedValue: { type: "string", description: "Expected value" },
        operator: {
          type: "string",
          enum: ["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "less_than"],
          description: "Comparison operator",
          default: "equals",
        },
      },
      required: ["field", "expectedValue"],
    },
  },
  {
    name: "validate_array_length",
    description: "Validate the length of an array field",
    inputSchema: {
      type: "object",
      properties: {
        field: { type: "string", description: "JSON path to the array field" },
        expectedLength: { type: "number", description: "Expected array length" },
        operator: {
          type: "string",
          enum: ["equals", "greater_than", "less_than", "greater_or_equal", "less_or_equal"],
          description: "Comparison operator",
          default: "equals",
        },
      },
      required: ["field", "expectedLength"],
    },
  },

  // Data Assertion Tools
  {
    name: "assert_field_exists",
    description: "Assert that a field exists in the response",
    inputSchema: {
      type: "object",
      properties: {
        field: { type: "string", description: "JSON path to the field" },
      },
      required: ["field"],
    },
  },
  {
    name: "assert_field_not_null",
    description: "Assert that a field is not null/empty",
    inputSchema: {
      type: "object",
      properties: {
        field: { type: "string", description: "JSON path to the field" },
      },
      required: ["field"],
    },
  },
  {
    name: "assert_field_null",
    description: "Assert that a field is null/empty",
    inputSchema: {
      type: "object",
      properties: {
        field: { type: "string", description: "JSON path to the field" },
      },
      required: ["field"],
    },
  },

  // Request Builder Tools
  {
    name: "set_default_header",
    description: "Set a default header for all subsequent requests",
    inputSchema: {
      type: "object",
      properties: {
        headerName: { type: "string", description: "Header name" },
        headerValue: { type: "string", description: "Header value" },
      },
      required: ["headerName", "headerValue"],
    },
  },
  {
    name: "set_auth_bearer",
    description: "Set Bearer token for subsequent requests. No parameters needed - automatically loads from BEARER_TOKEN in .env file. To override, pass token parameter.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Bearer token (OPTIONAL - loads from .env if not provided)" },
      },
      required: [],
    },
  },
  {
    name: "set_auth_basic",
    description: "Set Basic authentication for subsequent requests",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "Username" },
        password: { type: "string", description: "Password" },
      },
      required: ["username", "password"],
    },
  },
  {
    name: "add_cookie",
    description: "Add a cookie for subsequent requests",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Cookie name" },
        value: { type: "string", description: "Cookie value" },
      },
      required: ["name", "value"],
    },
  },
  {
    name: "clear_cookies",
    description: "Clear all stored cookies",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "clear_default_headers",
    description: "Clear all default headers except Content-Type",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_default_headers",
    description: "Get all currently set default headers",
    inputSchema: { type: "object", properties: {} },
  },

  // Comparison Tools
  {
    name: "compare_responses",
    description: "Compare current response with a previous response value",
    inputSchema: {
      type: "object",
      properties: {
        field: { type: "string", description: "JSON path to compare" },
        operator: {
          type: "string",
          enum: ["equals", "not_equals", "greater_than", "less_than", "contains"],
          description: "Comparison operator",
        },
        compareValue: { type: "string", description: "Value to compare against" },
      },
      required: ["field", "operator", "compareValue"],
    },
  },
  {
    name: "extract_value",
    description: "Extract a value from the response for later use",
    inputSchema: {
      type: "object",
      properties: {
        field: { type: "string", description: "JSON path to extract" },
        variableName: { type: "string", description: "Name to store the value as" },
      },
      required: ["field", "variableName"],
    },
  },

  // Report Tools
  {
    name: "generate_report",
    description: "Generate an HTML report of all API test steps with full request/response details including payloads, headers, and response JSON. Auto-opens in browser.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Report title (default: 'API Test Report')" },
      },
    },
  },
  {
    name: "clear_report",
    description: "Clear all recorded report steps and reset the report",
    inputSchema: { type: "object", properties: {} },
  },
];

// Helper function to get value from nested object
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, part) => {
    if (current && typeof current === "object") {
      return current[part];
    }
    return undefined;
  }, obj);
}

// Helper to add a report step
function addReportStep(step: Omit<ApiReportStep, "stepNumber" | "timestamp">): void {
  if (reportStartTime === 0) reportStartTime = Date.now();
  reportSteps.push({
    ...step,
    stepNumber: reportSteps.length + 1,
    timestamp: new Date().toISOString(),
  });
}

// Helper to format JSON for display (truncate very large payloads)
function formatJsonForReport(obj: any, maxLength: number = 50000): string {
  try {
    const str = JSON.stringify(obj, null, 2);
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + "\n... [truncated]";
    }
    return str;
  } catch {
    return String(obj);
  }
}

// Generate HTML report
function generateApiReportHtml(title: string): string {
  const totalSteps = reportSteps.length;
  const passed = reportSteps.filter(s => s.result === "pass").length;
  const failed = reportSteps.filter(s => s.result === "fail").length;
  const info = reportSteps.filter(s => s.result === "info").length;
  const totalDuration = reportStartTime > 0 ? Date.now() - reportStartTime : 0;
  const passRate = totalSteps > 0 ? ((passed / (passed + failed || 1)) * 100).toFixed(1) : "0.0";
  const httpSteps = reportSteps.filter(s => s.method && s.url);
  const avgResponseTime = httpSteps.length > 0
    ? Math.round(httpSteps.reduce((sum, s) => sum + (s.responseTime || 0), 0) / httpSteps.length)
    : 0;

  const stepsHtml = reportSteps.map((step, idx) => {
    const statusClass = step.result === "pass" ? "pass" : step.result === "fail" ? "fail" : "info";
    const statusIcon = step.result === "pass" ? "✓" : step.result === "fail" ? "✗" : "ℹ";
    const isHttpStep = step.method && step.url;
    const methodClass = (step.method || "").toLowerCase();

    let detailsHtml = "";
    if (isHttpStep) {
      detailsHtml = `
        <div class="step-details">
          <div class="endpoint">
            <span class="method-badge ${methodClass}">${step.method}</span>
            <span class="url">${escapeHtml(step.url || "")}</span>
            ${step.responseStatus ? `<span class="status-badge status-${Math.floor(step.responseStatus / 100)}xx">${step.responseStatus}</span>` : ""}
            ${step.responseTime ? `<span class="time-badge">${step.responseTime}ms</span>` : ""}
          </div>

          ${step.queryParams && Object.keys(step.queryParams).length > 0 ? `
          <div class="collapsible">
            <button class="collapsible-toggle" onclick="toggleCollapsible(this)">▶ Query Parameters</button>
            <div class="collapsible-content"><pre class="json-block">${escapeHtml(formatJsonForReport(step.queryParams))}</pre></div>
          </div>` : ""}

          ${step.requestHeaders && Object.keys(step.requestHeaders).length > 0 ? `
          <div class="collapsible">
            <button class="collapsible-toggle" onclick="toggleCollapsible(this)">▶ Request Headers</button>
            <div class="collapsible-content"><pre class="json-block">${escapeHtml(formatJsonForReport(step.requestHeaders))}</pre></div>
          </div>` : ""}

          ${step.requestBody !== undefined && step.requestBody !== null ? `
          <div class="collapsible">
            <button class="collapsible-toggle" onclick="toggleCollapsible(this)">▶ Request Body / Payload</button>
            <div class="collapsible-content"><pre class="json-block request-body">${escapeHtml(formatJsonForReport(step.requestBody))}</pre></div>
          </div>` : ""}

          ${step.responseHeaders && Object.keys(step.responseHeaders).length > 0 ? `
          <div class="collapsible">
            <button class="collapsible-toggle" onclick="toggleCollapsible(this)">▶ Response Headers</button>
            <div class="collapsible-content"><pre class="json-block">${escapeHtml(formatJsonForReport(step.responseHeaders))}</pre></div>
          </div>` : ""}

          ${step.responseBody !== undefined && step.responseBody !== null ? `
          <div class="collapsible open">
            <button class="collapsible-toggle" onclick="toggleCollapsible(this)">▼ Response Body / JSON</button>
            <div class="collapsible-content" style="display:block"><pre class="json-block response-body">${escapeHtml(formatJsonForReport(step.responseBody))}</pre></div>
          </div>` : ""}
        </div>`;
    }

    return `
      <div class="step ${statusClass}">
        <div class="step-header" onclick="toggleStep(this)">
          <div class="step-left">
            <span class="step-number">#${step.stepNumber}</span>
            <span class="status-icon ${statusClass}">${statusIcon}</span>
            <span class="tool-name">${escapeHtml(step.toolName)}</span>
          </div>
          <div class="step-right">
            ${isHttpStep ? `<span class="method-badge small ${methodClass}">${step.method}</span>` : ""}
            ${step.responseTime ? `<span class="time-badge small">${step.responseTime}ms</span>` : ""}
            <span class="step-time">${new Date(step.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
        <div class="step-body">
          <div class="step-message">${escapeHtml(step.message)}</div>
          ${step.error ? `<div class="step-error">${escapeHtml(step.error)}</div>` : ""}
          ${detailsHtml}
        </div>
      </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117; color: #c9d1d9; padding: 24px;
    }
    .report-header {
      text-align: center; padding: 32px; margin-bottom: 24px;
      background: linear-gradient(135deg, #161b22 0%, #1c2333 100%);
      border: 1px solid #30363d; border-radius: 12px;
    }
    .report-header h1 { font-size: 28px; color: #58a6ff; margin-bottom: 8px; }
    .report-header .subtitle { color: #8b949e; font-size: 14px; }

    .summary-cards {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px; margin-bottom: 24px;
    }
    .summary-card {
      background: #161b22; border: 1px solid #30363d; border-radius: 10px;
      padding: 20px; text-align: center;
    }
    .summary-card .value { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
    .summary-card .label { color: #8b949e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .summary-card.total .value { color: #58a6ff; }
    .summary-card.passed .value { color: #3fb950; }
    .summary-card.failed .value { color: #f85149; }
    .summary-card.info-card .value { color: #d2a8ff; }
    .summary-card.duration .value { color: #f0883e; }
    .summary-card.rate .value { color: #79c0ff; }
    .summary-card.avg-time .value { color: #56d364; }

    .step {
      background: #161b22; border: 1px solid #30363d; border-radius: 10px;
      margin-bottom: 12px; overflow: hidden; transition: all 0.2s;
    }
    .step:hover { border-color: #484f58; }
    .step.pass { border-left: 4px solid #3fb950; }
    .step.fail { border-left: 4px solid #f85149; }
    .step.info { border-left: 4px solid #d2a8ff; }

    .step-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 20px; cursor: pointer; user-select: none;
    }
    .step-header:hover { background: #1c2128; }
    .step-left, .step-right { display: flex; align-items: center; gap: 10px; }
    .step-number { color: #484f58; font-size: 13px; font-weight: 600; min-width: 30px; }
    .status-icon { font-size: 16px; font-weight: 700; }
    .status-icon.pass { color: #3fb950; }
    .status-icon.fail { color: #f85149; }
    .status-icon.info { color: #d2a8ff; }
    .tool-name { font-weight: 600; color: #c9d1d9; font-size: 14px; }
    .step-time { color: #484f58; font-size: 12px; }

    .step-body { display: none; padding: 0 20px 16px; }
    .step.expanded .step-body { display: block; }
    .step-message { color: #8b949e; font-size: 13px; margin-bottom: 12px; padding: 8px 12px; background: #0d1117; border-radius: 6px; }
    .step-error { color: #f85149; font-size: 13px; margin-bottom: 12px; padding: 8px 12px; background: #1c0d0d; border: 1px solid #3d1414; border-radius: 6px; }

    .step-details { margin-top: 8px; }
    .endpoint {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      background: #0d1117; border-radius: 8px; margin-bottom: 10px; flex-wrap: wrap;
    }
    .method-badge {
      padding: 4px 10px; border-radius: 4px; font-size: 12px;
      font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .method-badge.small { padding: 2px 6px; font-size: 10px; }
    .method-badge.get { background: #0d419d; color: #79c0ff; }
    .method-badge.post { background: #1a4d2e; color: #56d364; }
    .method-badge.put { background: #4d3800; color: #f0883e; }
    .method-badge.patch { background: #3d1f6e; color: #d2a8ff; }
    .method-badge.delete { background: #4d0d0d; color: #f85149; }
    .method-badge.head { background: #1c2128; color: #8b949e; }
    .method-badge.options { background: #1c2128; color: #8b949e; }
    .url { color: #c9d1d9; font-family: 'SF Mono', monospace; font-size: 13px; word-break: break-all; }

    .status-badge {
      padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;
    }
    .status-badge.status-2xx { background: #1a4d2e; color: #56d364; }
    .status-badge.status-3xx { background: #3d3800; color: #f0883e; }
    .status-badge.status-4xx { background: #4d1f0d; color: #f85149; }
    .status-badge.status-5xx { background: #4d0d0d; color: #ff7b72; }
    .time-badge {
      padding: 2px 8px; border-radius: 4px; font-size: 11px;
      background: #1c2128; color: #8b949e;
    }
    .time-badge.small { padding: 2px 6px; font-size: 10px; }

    .collapsible { margin-bottom: 6px; }
    .collapsible-toggle {
      background: none; border: none; color: #58a6ff; cursor: pointer;
      font-size: 12px; font-weight: 600; padding: 6px 0;
    }
    .collapsible-toggle:hover { color: #79c0ff; }
    .collapsible-content { display: none; margin-top: 4px; }
    .collapsible.open .collapsible-content { display: block; }

    .json-block {
      background: #0d1117; border: 1px solid #21262d; border-radius: 6px;
      padding: 12px 16px; font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 12px; line-height: 1.5; overflow-x: auto; color: #c9d1d9;
      max-height: 400px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word;
    }
    .json-block.request-body { border-left: 3px solid #58a6ff; }
    .json-block.response-body { border-left: 3px solid #3fb950; }

    .expand-all-bar {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; padding: 8px 0;
    }
    .expand-all-bar .section-title { color: #c9d1d9; font-size: 18px; font-weight: 600; }
    .expand-all-bar button {
      background: #21262d; border: 1px solid #30363d; color: #8b949e;
      padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 12px;
    }
    .expand-all-bar button:hover { background: #30363d; color: #c9d1d9; }

    .footer {
      text-align: center; padding: 20px; color: #484f58; font-size: 12px; margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>📡 ${escapeHtml(title)}</h1>
    <div class="subtitle">Generated on ${new Date().toLocaleString()} | MCP API Testing Server</div>
  </div>

  <div class="summary-cards">
    <div class="summary-card total"><div class="value">${totalSteps}</div><div class="label">Total Steps</div></div>
    <div class="summary-card passed"><div class="value">${passed}</div><div class="label">Passed</div></div>
    <div class="summary-card failed"><div class="value">${failed}</div><div class="label">Failed</div></div>
    <div class="summary-card info-card"><div class="value">${info}</div><div class="label">Info</div></div>
    <div class="summary-card duration"><div class="value">${totalDuration > 60000 ? (totalDuration / 60000).toFixed(1) + "m" : (totalDuration / 1000).toFixed(1) + "s"}</div><div class="label">Duration</div></div>
    <div class="summary-card rate"><div class="value">${passRate}%</div><div class="label">Pass Rate</div></div>
    <div class="summary-card avg-time"><div class="value">${avgResponseTime}ms</div><div class="label">Avg Response</div></div>
  </div>

  <div class="expand-all-bar">
    <span class="section-title">Test Steps</span>
    <div>
      <button onclick="expandAll()">Expand All</button>
      <button onclick="collapseAll()" style="margin-left: 8px;">Collapse All</button>
    </div>
  </div>

  ${stepsHtml}

  <div class="footer">
    MCP API Testing Report • ${totalSteps} steps • ${new Date().toISOString()}
  </div>

  <script>
    function toggleStep(header) {
      header.closest('.step').classList.toggle('expanded');
    }
    function toggleCollapsible(btn) {
      const c = btn.closest('.collapsible');
      c.classList.toggle('open');
      btn.textContent = c.classList.contains('open')
        ? btn.textContent.replace('▶', '▼')
        : btn.textContent.replace('▼', '▶');
    }
    function expandAll() {
      document.querySelectorAll('.step').forEach(s => s.classList.add('expanded'));
    }
    function collapseAll() {
      document.querySelectorAll('.step').forEach(s => s.classList.remove('expanded'));
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Create server
const server = new Server(
  {
    name: "mcp-server-api",
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
    // HTTP Verb Tools
    if (["http_get", "http_post", "http_put", "http_patch", "http_delete", "http_head", "http_options"].includes(name)) {
      const url = args?.url as string;
      const body = args?.body ? parseBody(args.body) : undefined;
      const method = name.replace("http_", "").toUpperCase();
      const params = args?.params as Record<string, any>;
      const auth = args?.auth as string;
      const validateStatus = args?.validateStatus as number;

      const headers = { ...defaultHeaders, ...(args?.headers as Record<string, string>) };

      if (auth) {
        headers["Authorization"] = `Bearer ${auth}`;
      }

      // Add cookies to headers
      if (Object.keys(cookies).length > 0) {
        headers["Cookie"] = Object.entries(cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; ");
      }

      const startTime = Date.now();
      const response: AxiosResponse = await axiosInstance({
        method: method as any,
        url,
        data: ["POST", "PUT", "PATCH"].includes(method) ? body : undefined,
        params,
        headers,
      });
      const duration = Date.now() - startTime;

      lastResponse = {
        status: response.status,
        headers: response.headers as Record<string, any>,
        body: response.data,
        time: duration,
        url,
        method,
      };

      const isStatusFail = validateStatus && response.status !== validateStatus;

      // Track report step with full request/response details
      addReportStep({
        toolName: name,
        method,
        url,
        requestHeaders: maskHeaders(headers),
        requestBody: body,
        queryParams: params,
        responseStatus: response.status,
        responseHeaders: response.headers as Record<string, any>,
        responseBody: response.data,
        responseTime: duration,
        result: isStatusFail ? "fail" : "pass",
        message: `${method} ${url} → ${response.status} (${duration}ms)`,
        error: isStatusFail ? `Status validation failed: expected ${validateStatus}, got ${response.status}` : undefined,
      });

      if (isStatusFail) {
        return {
          content: [
            {
              type: "text",
              text: `Status validation failed: expected ${validateStatus}, got ${response.status}\nResponse: ${JSON.stringify(response.data)}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `${method} ${url} - Status: ${response.status}\nResponse time: ${duration}ms\nBody: ${JSON.stringify(response.data)}`,
          },
        ],
      };
    }

    // Response Inspection Tools
    if (name === "get_response_status") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      addReportStep({ toolName: name, result: "info", message: `Status: ${lastResponse.status}` });
      return { content: [{ type: "text", text: String(lastResponse.status) }] };
    }

    if (name === "get_response_headers") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const maskedHeaders = maskHeaders(lastResponse.headers);
      addReportStep({ toolName: name, result: "info", message: `Retrieved response headers`, responseHeaders: lastResponse.headers });
      return { content: [{ type: "text", text: JSON.stringify(maskedHeaders, null, 2) }] };
    }

    if (name === "get_response_body") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const jsonPath = args?.jsonPath as string;
      const body = jsonPath ? getNestedValue(lastResponse.body, jsonPath) : lastResponse.body;
      const maskedBody = maskObject(body);
      addReportStep({ toolName: name, result: "info", message: jsonPath ? `Extracted body at path: ${jsonPath}` : "Retrieved full response body", responseBody: body });
      return { content: [{ type: "text", text: JSON.stringify(maskedBody) }] };
    }

    if (name === "get_response_time") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      addReportStep({ toolName: name, result: "info", message: `Response time: ${lastResponse.time}ms`, responseTime: lastResponse.time });
      return { content: [{ type: "text", text: `${lastResponse.time}ms` }] };
    }

    if (name === "get_full_response") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const maskedResponse = {
        ...lastResponse,
        headers: maskHeaders(lastResponse.headers),
        body: maskObject(lastResponse.body),
      };
      addReportStep({
        toolName: name, result: "info", message: `Full response: ${lastResponse.method} ${lastResponse.url} → ${lastResponse.status}`,
        method: lastResponse.method, url: lastResponse.url, responseStatus: lastResponse.status,
        responseHeaders: lastResponse.headers, responseBody: lastResponse.body, responseTime: lastResponse.time,
      });
      return { content: [{ type: "text", text: JSON.stringify(maskedResponse, null, 2) }] };
    }

    // Response Validation Tools
    if (name === "validate_status_code") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const expectedStatus = (args?.expectedStatus as string).split(",").map((s) => parseInt(s.trim()));
      const valid = validateStatusCode(lastResponse.status, expectedStatus);
      const msg = valid
        ? `✓ Status code validation passed (${lastResponse.status})`
        : `✗ Status code validation failed: expected ${expectedStatus.join(" or ")}, got ${lastResponse.status}`;
      addReportStep({ toolName: name, result: valid ? "pass" : "fail", message: msg });
      return { content: [{ type: "text", text: msg }], isError: !valid };
    }

    if (name === "validate_content_type") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const expectedType = args?.expectedType as string;
      const valid = validateContentType(lastResponse.headers, expectedType);
      const msg = valid ? `✓ Content-Type validation passed` : `✗ Content-Type validation failed: expected ${expectedType}`;
      addReportStep({ toolName: name, result: valid ? "pass" : "fail", message: msg });
      return { content: [{ type: "text", text: msg }], isError: !valid };
    }

    if (name === "validate_response_contains") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const value = args?.value as string;
      const field = args?.field as string;
      const searchIn = field ? getNestedValue(lastResponse.body, field) : lastResponse.body;
      const bodyStr = JSON.stringify(searchIn);
      const valid = bodyStr.includes(value);
      const msg = valid ? `✓ Response contains "${value}"` : `✗ Response does not contain "${value}"`;
      addReportStep({ toolName: name, result: valid ? "pass" : "fail", message: msg });
      return { content: [{ type: "text", text: msg }], isError: !valid };
    }

    if (name === "validate_response_not_contains") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const value = args?.value as string;
      const bodyStr = JSON.stringify(lastResponse.body);
      const valid = !bodyStr.includes(value);
      const msg = valid ? `✓ Response does not contain "${value}"` : `✗ Response contains "${value}"`;
      addReportStep({ toolName: name, result: valid ? "pass" : "fail", message: msg });
      return { content: [{ type: "text", text: msg }], isError: !valid };
    }

    // Schema Validation
    if (name === "validate_json_schema") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const schema = JSON.parse(args?.schema as string);
      const validation = validateJSONSchema(lastResponse.body, schema);
      const msg = validation.valid ? `✓ Schema validation passed` : `✗ Schema validation failed:\n${validation.errors.join("\n")}`;
      addReportStep({ toolName: name, result: validation.valid ? "pass" : "fail", message: msg, error: validation.valid ? undefined : validation.errors.join("; ") });
      return { content: [{ type: "text", text: msg }], isError: !validation.valid };
    }

    if (name === "validate_required_fields") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const fields = (args?.fields as string).split(",").map((f) => f.trim());
      const missing: string[] = [];
      for (const field of fields) {
        if (getNestedValue(lastResponse.body, field) === undefined) {
          missing.push(field);
        }
      }
      const valid = missing.length === 0;
      const msg = valid ? `✓ All required fields present` : `✗ Missing required fields: ${missing.join(", ")}`;
      addReportStep({ toolName: name, result: valid ? "pass" : "fail", message: msg });
      return { content: [{ type: "text", text: msg }], isError: !valid };
    }

    if (name === "validate_field_type") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const field = args?.field as string;
      const expectedType = args?.expectedType as string;
      const value = getNestedValue(lastResponse.body, field);
      const actualType = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
      const valid = actualType === expectedType;
      const msg = valid
        ? `✓ Field '${field}' has correct type (${expectedType})`
        : `✗ Field '${field}' type mismatch: expected ${expectedType}, got ${actualType}`;
      addReportStep({ toolName: name, result: valid ? "pass" : "fail", message: msg });
      return { content: [{ type: "text", text: msg }], isError: !valid };
    }

    if (name === "validate_field_value") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const field = args?.field as string;
      const expectedValue = args?.expectedValue as string;
      const operator = (args?.operator as string) || "equals";
      const actualValue = getNestedValue(lastResponse.body, field);
      const actualStr = String(actualValue);

      let valid = false;
      switch (operator) {
        case "equals": valid = actualStr === expectedValue; break;
        case "not_equals": valid = actualStr !== expectedValue; break;
        case "contains": valid = actualStr.includes(expectedValue); break;
        case "starts_with": valid = actualStr.startsWith(expectedValue); break;
        case "ends_with": valid = actualStr.endsWith(expectedValue); break;
        case "greater_than": valid = Number(actualValue) > Number(expectedValue); break;
        case "less_than": valid = Number(actualValue) < Number(expectedValue); break;
      }

      const msg = valid
        ? `✓ Field '${field}' validation passed (${operator})`
        : `✗ Field '${field}' validation failed: expected ${operator} ${expectedValue}, got ${actualValue}`;
      addReportStep({ toolName: name, result: valid ? "pass" : "fail", message: msg });
      return { content: [{ type: "text", text: msg }], isError: !valid };
    }

    if (name === "validate_array_length") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const field = args?.field as string;
      const expectedLength = args?.expectedLength as number;
      const operator = (args?.operator as string) || "equals";
      const value = getNestedValue(lastResponse.body, field);

      if (!Array.isArray(value)) {
        const msg = `✗ Field '${field}' is not an array`;
        addReportStep({ toolName: name, result: "fail", message: msg });
        return { content: [{ type: "text", text: msg }], isError: true };
      }

      const actualLength = value.length;
      let valid = false;
      switch (operator) {
        case "equals": valid = actualLength === expectedLength; break;
        case "greater_than": valid = actualLength > expectedLength; break;
        case "less_than": valid = actualLength < expectedLength; break;
        case "greater_or_equal": valid = actualLength >= expectedLength; break;
        case "less_or_equal": valid = actualLength <= expectedLength; break;
      }

      const msg = valid
        ? `✓ Array length validation passed (${actualLength} ${operator} ${expectedLength})`
        : `✗ Array length validation failed: expected length ${operator} ${expectedLength}, got ${actualLength}`;
      addReportStep({ toolName: name, result: valid ? "pass" : "fail", message: msg });
      return { content: [{ type: "text", text: msg }], isError: !valid };
    }

    // Data Assertion Tools
    if (name === "assert_field_exists") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const field = args?.field as string;
      const exists = getNestedValue(lastResponse.body, field) !== undefined;
      const msg = exists ? `✓ Field '${field}' exists` : `✗ Field '${field}' does not exist`;
      addReportStep({ toolName: name, result: exists ? "pass" : "fail", message: msg });
      return { content: [{ type: "text", text: msg }], isError: !exists };
    }

    if (name === "assert_field_not_null") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const field = args?.field as string;
      const value = getNestedValue(lastResponse.body, field);
      const valid = value !== null && value !== undefined && value !== "";
      const msg = valid ? `✓ Field '${field}' is not null/empty` : `✗ Field '${field}' is null or empty`;
      addReportStep({ toolName: name, result: valid ? "pass" : "fail", message: msg });
      return { content: [{ type: "text", text: msg }], isError: !valid };
    }

    if (name === "assert_field_null") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const field = args?.field as string;
      const value = getNestedValue(lastResponse.body, field);
      const valid = value === null || value === undefined || value === "";
      const msg = valid ? `✓ Field '${field}' is null/empty` : `✗ Field '${field}' is not null/empty`;
      addReportStep({ toolName: name, result: valid ? "pass" : "fail", message: msg });
      return { content: [{ type: "text", text: msg }], isError: !valid };
    }

    // Request Builder Tools
    if (name === "set_default_header") {
      const headerName = args?.headerName as string;
      const headerValue = args?.headerValue as string;
      defaultHeaders[headerName] = headerValue;
      const displayValue = maskSensitiveValue(headerValue, headerName);
      const msg = `✓ Header '${headerName}' set to '${displayValue}'`;
      addReportStep({ toolName: name, result: "info", message: msg });
      return { content: [{ type: "text", text: msg }] };
    }

    if (name === "set_auth_bearer") {
      let token = args?.token as string;
      
      // If no token provided, try to get from .env
      if (!token) {
        token = getBearerToken("DEFAULT") || "";
        if (!token) {
          const msg = `✗ No bearer token provided and no BEARER_TOKEN in .env file.`;
          addReportStep({ toolName: name, result: "fail", message: msg });
          return { content: [{ type: "text", text: `${msg} Usage: set_auth_bearer token: "your_token"` }] };
        }
      }
      
      defaultHeaders["Authorization"] = `Bearer ${token}`;
      const maskedToken = maskSensitiveValue(token, "authorization");
      const msg = `✓ Bearer token set (${maskedToken})`;
      addReportStep({ toolName: name, result: "info", message: msg });
      return { content: [{ type: "text", text: msg }] };
    }

    if (name === "set_auth_basic") {
      const username = args?.username as string;
      const password = args?.password as string;
      const base64 = Buffer.from(`${username}:${password}`).toString("base64");
      defaultHeaders["Authorization"] = `Basic ${base64}`;
      const msg = `✓ Basic auth set for user '${username}'`;
      addReportStep({ toolName: name, result: "info", message: msg });
      return { content: [{ type: "text", text: msg }] };
    }

    if (name === "add_cookie") {
      const cookieName = args?.name as string;
      const cookieValue = args?.value as string;
      cookies[cookieName] = cookieValue;
      const msg = `✓ Cookie '${cookieName}' added`;
      addReportStep({ toolName: name, result: "info", message: msg });
      return { content: [{ type: "text", text: msg }] };
    }

    if (name === "clear_cookies") {
      Object.keys(cookies).forEach((key) => delete cookies[key]);
      const msg = `✓ All cookies cleared`;
      addReportStep({ toolName: name, result: "info", message: msg });
      return { content: [{ type: "text", text: msg }] };
    }

    if (name === "clear_default_headers") {
      defaultHeaders = { "Content-Type": "application/json" };
      const msg = `✓ Default headers cleared`;
      addReportStep({ toolName: name, result: "info", message: msg });
      return { content: [{ type: "text", text: msg }] };
    }

    if (name === "get_default_headers") {
      const maskedHeaders = maskHeaders(defaultHeaders);
      addReportStep({ toolName: name, result: "info", message: "Retrieved default headers", requestHeaders: defaultHeaders });
      return { content: [{ type: "text", text: JSON.stringify(maskedHeaders, null, 2) }] };
    }

    // Comparison Tools
    if (name === "compare_responses") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const field = args?.field as string;
      const operator = args?.operator as string;
      const compareValue = args?.compareValue as string;
      const fieldValue = String(getNestedValue(lastResponse.body, field));

      let valid = false;
      switch (operator) {
        case "equals": valid = fieldValue === compareValue; break;
        case "not_equals": valid = fieldValue !== compareValue; break;
        case "greater_than": valid = Number(fieldValue) > Number(compareValue); break;
        case "less_than": valid = Number(fieldValue) < Number(compareValue); break;
        case "contains": valid = fieldValue.includes(compareValue); break;
      }

      const msg = valid ? `✓ Comparison passed` : `✗ Comparison failed: '${fieldValue}' ${operator} '${compareValue}'`;
      addReportStep({ toolName: name, result: valid ? "pass" : "fail", message: msg });
      return { content: [{ type: "text", text: msg }], isError: !valid };
    }

    if (name === "extract_value") {
      if (!lastResponse) { addReportStep({ toolName: name, result: "fail", message: "No response available" }); return { content: [{ type: "text", text: "No response available" }], isError: true }; }
      const field = args?.field as string;
      const variableName = args?.variableName as string;
      const value = getNestedValue(lastResponse.body, field);
      const msg = `✓ Extracted '${field}' into ${variableName}: ${JSON.stringify(value)}`;
      addReportStep({ toolName: name, result: "info", message: msg });
      return { content: [{ type: "text", text: msg }] };
    }

    // Report Tools
    if (name === "generate_report") {
      const title = (args?.title as string) || "API Test Report";

      if (reportSteps.length === 0) {
        return { content: [{ type: "text", text: "No test steps recorded. Run some API tests first, then generate the report." }] };
      }

      // Generate HTML
      const html = generateApiReportHtml(title);

      // Write to file
      const reportsDir = join(process.cwd(), "api-reports");
      if (!existsSync(reportsDir)) {
        mkdirSync(reportsDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").substring(0, 19);
      const reportFile = join(reportsDir, `api-report-${timestamp}.html`);
      writeFileSync(reportFile, html, "utf-8");

      // Auto-open in browser
      exec(`open "${reportFile}"`);

      const passed = reportSteps.filter(s => s.result === "pass").length;
      const failed = reportSteps.filter(s => s.result === "fail").length;
      const infoCount = reportSteps.filter(s => s.result === "info").length;
      const httpSteps = reportSteps.filter(s => s.method && s.url);

      return {
        content: [
          {
            type: "text",
            text: `📡 API Test Report Generated!\n\n` +
              `📊 Summary: ${reportSteps.length} steps | ✓ ${passed} passed | ✗ ${failed} failed | ℹ ${infoCount} info\n` +
              `🌐 HTTP Requests: ${httpSteps.length}\n` +
              `📁 Report: ${reportFile}\n` +
              `🔗 Opened in browser`,
          },
        ],
      };
    }

    if (name === "clear_report") {
      const count = reportSteps.length;
      reportSteps = [];
      reportStartTime = 0;
      return { content: [{ type: "text", text: `✓ Report cleared (${count} steps removed)` }] };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Track errors in report
    addReportStep({
      toolName: name,
      result: "fail",
      message: `Error executing ${name}`,
      error: errorMessage,
    });
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
  console.error("MCP API Testing Server running on stdio");
}
main().catch((error) => {
  console.error("Fatal error:", error);
  exit(1);
});