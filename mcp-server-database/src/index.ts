#!/usr/bin/env node

import dotenv from "dotenv";
const originalLog = console.log;
console.log = () => {};
dotenv.config({ debug: false });
console.log = originalLog;

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Pool as PgPool } from "pg";
import mysql from "mysql2/promise";
import sqlite3 from "sqlite3";
import { exit } from "node:process";

interface ConnectionConfig {
  type: "postgresql" | "mysql" | "sqlite";
  name: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  filename?: string;
}

interface QueryResult {
  success: boolean;
  data?: any[];
  rowCount?: number;
  columns?: string[];
  error?: string;
  executionTime?: number;
}

let connections: Map<string, any> = new Map();
let lastQueryResult: QueryResult | null = null;
let queryHistory: Array<{ query: string; result: QueryResult; timestamp: Date }> = [];
const MAX_HISTORY = 50;

// PostgreSQL
async function connectPostgres(config: ConnectionConfig): Promise<void> {
  let pgConfig: any;
  
  // Check if PG_DATABASE is a connection string (URI) or individual parameters
  const pgDatabase = config.database || process.env.PG_DATABASE;
  
  if (pgDatabase && pgDatabase.startsWith("postgresql://")) {
    // Use connection string directly - pg library will parse it
    // Add SSL support for connection strings
    pgConfig = {
      connectionString: pgDatabase,
      ssl: process.env.PG_SSL === 'true' ? true : { rejectUnauthorized: false },
    };
  } else {
    // Use individual parameters
    pgConfig = {
      host: config.host || process.env.PG_HOST,
      port: config.port || parseInt(process.env.PG_PORT || "5432"),
      user: config.user || process.env.PG_USER,
      password: config.password || process.env.PG_PASSWORD,
      database: pgDatabase,
      ssl: process.env.PG_SSL === 'true' || process.env.PG_SSLMODE === 'require' 
        ? { rejectUnauthorized: false } 
        : false,
    };
  }
  
  const pool = new PgPool(pgConfig);
  connections.set(config.name, pool);
}

async function queryPostgres(
  connName: string,
  sql: string,
  params?: any[]
): Promise<QueryResult> {
  const start = Date.now();
  try {
    const pool = connections.get(connName) as PgPool | undefined;
    if (!pool) return { success: false, error: `Connection '${connName}' not found` };

    const result = await pool.query(sql, params);
    return {
      success: true,
      data: result.rows,
      rowCount: result.rowCount || 0,
      columns: (result.fields || []).map((f: any) => f.name),
      executionTime: Date.now() - start,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      executionTime: Date.now() - start,
    };
  }
}

// MySQL
async function connectMysql(config: ConnectionConfig): Promise<void> {
  const pool = mysql.createPool({
    host: config.host || process.env.MYSQL_HOST,
    port: config.port || parseInt(process.env.MYSQL_PORT || "3306"),
    user: config.user || process.env.MYSQL_USER,
    password: config.password || process.env.MYSQL_PASSWORD,
    database: config.database || process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
  });
  connections.set(config.name, pool);
}

async function queryMysql(
  connName: string,
  sql: string,
  params?: any[]
): Promise<QueryResult> {
  const start = Date.now();
  try {
    const pool = connections.get(connName) as any;
    if (!pool) return { success: false, error: `Connection '${connName}' not found` };

    const [rows, fields] = await pool.execute(sql, params || []);
    const fieldArray = Array.isArray(fields) ? fields : [];
    return {
      success: true,
      data: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : 0,
      columns: fieldArray.map((f: any) => f.name),
      executionTime: Date.now() - start,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      executionTime: Date.now() - start,
    };
  }
}

// SQLite
function connectSqlite(config: ConnectionConfig): void {
  const db = new sqlite3.Database(
    config.filename || process.env.SQLITE_FILE || ":memory:"
  );
  connections.set(config.name, db);
}

async function querySqlite(
  connName: string,
  sql: string,
  params?: any[]
): Promise<QueryResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    try {
      const db = connections.get(connName) as sqlite3.Database | undefined;
      if (!db) {
        resolve({
          success: false,
          error: `Connection '${connName}' not found`,
          executionTime: Date.now() - start,
        });
        return;
      }

      if (sql.trim().toUpperCase().startsWith("SELECT")) {
        db.all(sql, params || [], (err: any, rows: any[]) => {
          if (err) {
            resolve({
              success: false,
              error: err.message,
              executionTime: Date.now() - start,
            });
          } else {
            const rowArray = Array.isArray(rows) ? rows : [];
            resolve({
              success: true,
              data: rowArray,
              rowCount: rowArray.length,
              columns: rowArray.length > 0 ? Object.keys(rowArray[0]) : [],
              executionTime: Date.now() - start,
            });
          }
        });
      } else {
        db.run(sql, params || [], function (this: any, err: any) {
          if (err) {
            resolve({
              success: false,
              error: err.message,
              executionTime: Date.now() - start,
            });
          } else {
            resolve({
              success: true,
              rowCount: this.changes,
              executionTime: Date.now() - start,
            });
          }
        });
      }
    } catch (error: any) {
      resolve({
        success: false,
        error: error.message,
        executionTime: Date.now() - start,
      });
    }
  });
}

// Execute query dispatcher
async function executeQuery(
  dbType: string,
  connName: string,
  sql: string,
  params?: any[]
): Promise<QueryResult> {
  switch (dbType) {
    case "postgresql":
      return queryPostgres(connName, sql, params);
    case "mysql":
      return queryMysql(connName, sql, params);
    case "sqlite":
      return querySqlite(connName, sql, params);
    default:
      return { success: false, error: `Unknown database type: ${dbType}` };
  }
}

const server = new Server(
  {
    name: "mcp-server-database",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async (request: any) => {
  return { tools: listTools() };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  return callTool(request);
});

function listTools(): Tool[] {
  return [
    {
      name: "connect_postgresql",
      description: "Connect to PostgreSQL database. Supports connection strings (postgresql://...), SSL via PG_SSL=true or PG_SSLMODE=require env vars",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Connection name" },
          host: { type: "string", description: "Host (or PG_HOST env)" },
          port: { type: "number", description: "Port (default 5432)" },
          user: { type: "string", description: "Username (or PG_USER env)" },
          password: { type: "string", description: "Password (or PG_PASSWORD env)" },
          database: { type: "string", description: "Database name/URI (or PG_DATABASE env, can be postgresql://...)" },
        },
        required: ["name"],
      },
    },
    {
      name: "connect_mysql",
      description: "Connect to MySQL database",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Connection name" },
          host: { type: "string", description: "Host (or MYSQL_HOST env)" },
          port: { type: "number", description: "Port (default 3306)" },
          user: { type: "string", description: "Username (or MYSQL_USER env)" },
          password: { type: "string", description: "Password (or MYSQL_PASSWORD env)" },
          database: { type: "string", description: "Database name (or MYSQL_DATABASE env)" },
        },
        required: ["name"],
      },
    },
    {
      name: "connect_sqlite",
      description: "Connect to SQLite database",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Connection name" },
          filename: { type: "string", description: "File path (or SQLITE_FILE env)" },
        },
        required: ["name"],
      },
    },
    {
      name: "execute_query",
      description: "Execute SQL query",
      inputSchema: {
        type: "object",
        properties: {
          connection: { type: "string", description: "Connection name" },
          dbType: {
            type: "string",
            enum: ["postgresql", "mysql", "sqlite"],
            description: "Database type",
          },
          sql: { type: "string", description: "SQL query" },
          params: { type: "array", description: "Query parameters" },
        },
        required: ["connection", "dbType", "sql"],
      },
    },
    {
      name: "get_last_result",
      description: "Get last query result",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "get_history",
      description: "Get query history",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of records (default 10)" },
        },
        required: [],
      },
    },
    {
      name: "list_connections",
      description: "List active connections",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "disconnect",
      description: "Close a connection",
      inputSchema: {
        type: "object",
        properties: {
          connection: { type: "string", description: "Connection name" },
        },
        required: ["connection"],
      },
    },
    {
      name: "validate_result",
      description: "Validate query result",
      inputSchema: {
        type: "object",
        properties: {
          minRows: { type: "number", description: "Minimum rows" },
          maxRows: { type: "number", description: "Maximum rows" },
          exactRowCount: { type: "number", description: "Exact row count" },
          hasColumns: { type: "array", items: { type: "string" }, description: "Required columns" },
        },
        required: [],
      },
    },
    {
      name: "format_result",
      description: "Format result (json, csv, table)",
      inputSchema: {
        type: "object",
        properties: {
          format: {
            type: "string",
            enum: ["json", "csv", "table"],
            description: "Output format",
          },
        },
        required: ["format"],
      },
    },
  ];
}

async function callTool(request: any): Promise<any> {
  const { name, arguments: args } = request.params;
  const callArgs = (args || {}) as Record<string, any>;

  try {
    if (name === "connect_postgresql") {
      await connectPostgres(callArgs as ConnectionConfig);
      return {
        content: [{ type: "text", text: `✓ Connected to PostgreSQL as '${callArgs.name}'` }],
      };
    }

    if (name === "connect_mysql") {
      await connectMysql(callArgs as ConnectionConfig);
      return {
        content: [{ type: "text", text: `✓ Connected to MySQL as '${callArgs.name}'` }],
      };
    }

    if (name === "connect_sqlite") {
      connectSqlite(callArgs as ConnectionConfig);
      return {
        content: [{ type: "text", text: `✓ Connected to SQLite as '${callArgs.name}'` }],
      };
    }

    if (name === "execute_query") {
      const result = await executeQuery(callArgs.dbType, callArgs.connection, callArgs.sql, callArgs.params);
      lastQueryResult = result;
      queryHistory.push({ query: callArgs.sql, result, timestamp: new Date() });
      if (queryHistory.length > MAX_HISTORY) queryHistory.shift();

      return {
        content: [
          {
            type: "text",
            text: result.success
              ? `✓ Query executed\n${JSON.stringify(
                  {
                    rowCount: result.rowCount,
                    columns: result.columns,
                    executionTime: `${result.executionTime}ms`,
                  },
                  null,
                  2
                )}`
              : `✗ Error: ${result.error}`,
          },
        ],
      };
    }

    if (name === "get_last_result") {
      return {
        content: [
          {
            type: "text",
            text: lastQueryResult ? JSON.stringify(lastQueryResult, null, 2) : "No results",
          },
        ],
      };
    }

    if (name === "get_history") {
      const limit = callArgs.limit || 10;
      const hist = queryHistory.slice(-limit).map((h) => ({
        query: h.query.substring(0, 50) + "...",
        success: h.result.success,
        rowCount: h.result.rowCount,
        time: h.timestamp.toISOString(),
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(hist, null, 2) }],
      };
    }

    if (name === "list_connections") {
      const connList = Array.from(connections.keys());
      return {
        content: [
          {
            type: "text",
            text: connList.length > 0 ? `Connections:\n${connList.map((c) => `  - ${c}`).join("\n")}` : "No connections",
          },
        ],
      };
    }

    if (name === "disconnect") {
      const conn = connections.get(callArgs.connection);
      if (!conn) {
        return { content: [{ type: "text", text: `Connection not found` }] };
      }
      if (conn.end) await conn.end();
      if (conn.destroy) conn.destroy();
      connections.delete(callArgs.connection);
      return {
        content: [{ type: "text", text: `✓ Disconnected from '${callArgs.connection}'` }],
      };
    }

    if (name === "validate_result") {
      if (!lastQueryResult) {
        return { content: [{ type: "text", text: "No result to validate" }] };
      }
      const rowCount = lastQueryResult.rowCount || 0;
      let msg = "✓ Validation:\n";
      if (callArgs.exactRowCount !== undefined) {
        const pass = rowCount === callArgs.exactRowCount;
        msg += `  - Exact count (${callArgs.exactRowCount}): ${pass ? "✓" : "✗"} (got ${rowCount})\n`;
      }
      if (callArgs.minRows !== undefined) {
        const pass = rowCount >= callArgs.minRows;
        msg += `  - Min (${callArgs.minRows}): ${pass ? "✓" : "✗"}\n`;
      }
      if (callArgs.maxRows !== undefined) {
        const pass = rowCount <= callArgs.maxRows;
        msg += `  - Max (${callArgs.maxRows}): ${pass ? "✓" : "✗"}\n`;
      }
      if (callArgs.hasColumns) {
        const missing = callArgs.hasColumns.filter(
          (col: string) => !lastQueryResult!.columns?.includes(col)
        );
        msg += `  - Columns: ${missing.length === 0 ? "✓" : `✗ missing ${missing.join(", ")}`}\n`;
      }
      return { content: [{ type: "text", text: msg }] };
    }

    if (name === "format_result") {
      if (!lastQueryResult?.data) {
        return { content: [{ type: "text", text: "No data to format" }] };
      }
      const format = callArgs.format || "json";
      let output = "";

      if (format === "json") {
        output = JSON.stringify(lastQueryResult.data, null, 2);
      } else if (format === "csv") {
        if (lastQueryResult?.columns && lastQueryResult.columns.length > 0) {
          const cols = lastQueryResult.columns;
          output = cols.join(",") + "\n";
          output += (lastQueryResult.data || [])
            .map((row: any) => cols.map((col) => row[col]).join(","))
            .join("\n");
        }
      } else if (format === "table") {
        if (lastQueryResult?.columns && lastQueryResult.columns.length > 0) {
          const cols = lastQueryResult.columns;
          output = cols.join(" | ") + "\n";
          output += cols.map(() => "---").join("-+-") + "\n";
          output += (lastQueryResult.data || [])
            .map((row: any) => cols.map((col) => row[col]).join(" | "))
            .join("\n");
        }
      }

      return { content: [{ type: "text", text: output }] };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Error:", error);
  exit(1);
});
