#!/usr/bin/env node

/**
 * MCP Test Runner for CI/CD
 * 
 * Programmatically starts an MCP server, sends tool calls, collects results,
 * and exits with the appropriate code (0 = pass, 1 = fail).
 * 
 * Usage:
 *   node test-runner.mjs --server api --scenarios ./scenarios/api-tests.json
 *   node test-runner.mjs --server ui  --scenarios ./scenarios/ui-tests.json
 *   node test-runner.mjs --server db  --scenarios ./scenarios/db-tests.json
 */

import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── CLI Args ───
const args = process.argv.slice(2);
const serverType = getArg("--server");
const scenariosPath = getArg("--scenarios");
const verbose = args.includes("--verbose");

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

if (!serverType || !scenariosPath) {
  console.error("Usage: node test-runner.mjs --server <api|ui|db> --scenarios <path-to-json>");
  process.exit(1);
}

// ─── Server Paths ───
const SERVER_PATHS = {
  api: resolve(__dirname, "../mcp-server-api/build/index.js"),
  ui: resolve(__dirname, "../mcp-server-playwright/build/index.js"),
  db: resolve(__dirname, "../mcp-server-database/build/index.js"),
};

const serverPath = SERVER_PATHS[serverType];
if (!serverPath || !existsSync(serverPath)) {
  console.error(`❌ Server not found: ${serverPath}`);
  console.error(`   Run 'npm run build' in mcp-server-${serverType === "ui" ? "playwright" : serverType === "db" ? "database" : serverType} first`);
  process.exit(1);
}

// ─── Load Scenarios ───
const scenariosFile = resolve(scenariosPath);
if (!existsSync(scenariosFile)) {
  console.error(`❌ Scenarios file not found: ${scenariosFile}`);
  process.exit(1);
}

const scenarios = JSON.parse(readFileSync(scenariosFile, "utf-8"));
console.log(`\n📋 Loaded ${scenarios.length} test scenario(s) from ${scenariosPath}\n`);

// ─── MCP JSON-RPC Protocol ───
let messageId = 0;

function createMessage(method, params = {}) {
  return {
    jsonrpc: "2.0",
    id: ++messageId,
    method,
    params,
  };
}

// ─── Start MCP Server as Child Process ───
async function runTests() {
  const startTime = Date.now();
  let totalSteps = 0;
  let passedSteps = 0;
  let failedSteps = 0;
  const results = [];

  console.log(`🚀 Starting MCP server: ${serverType}`);
  console.log(`   Path: ${serverPath}\n`);

  const serverProcess = spawn("node", [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  let buffer = "";

  // Collect stderr for server logs
  serverProcess.stderr.on("data", (data) => {
    if (verbose) console.log(`   [server] ${data.toString().trim()}`);
  });

  // Promise-based message send/receive
  function sendMessage(msg) {
    return new Promise((resolvePromise, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for response to message ${msg.id}`));
      }, 30000);

      const handler = (data) => {
        buffer += data.toString();
        // MCP uses newline-delimited JSON
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const response = JSON.parse(line);
            if (response.id === msg.id) {
              clearTimeout(timeout);
              serverProcess.stdout.removeListener("data", handler);
              resolvePromise(response);
            }
          } catch {
            // Not valid JSON yet, keep buffering
          }
        }
      };

      serverProcess.stdout.on("data", handler);

      const payload = JSON.stringify(msg) + "\n";
      serverProcess.stdin.write(payload);
    });
  }

  try {
    // Initialize MCP session
    const initMsg = createMessage("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "ci-test-runner", version: "1.0.0" },
    });
    const initResp = await sendMessage(initMsg);
    if (verbose) console.log("✅ MCP session initialized\n");

    // Send initialized notification
    const notif = JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n";
    serverProcess.stdin.write(notif);

    // List available tools
    const listMsg = createMessage("tools/list", {});
    const toolsResp = await sendMessage(listMsg);
    const availableTools = toolsResp.result?.tools?.map((t) => t.name) || [];
    console.log(`🔧 Available tools (${availableTools.length}): ${availableTools.slice(0, 8).join(", ")}${availableTools.length > 8 ? "..." : ""}\n`);

    // Execute each scenario
    for (let si = 0; si < scenarios.length; si++) {
      const scenario = scenarios[si];
      console.log(`\n${"═".repeat(60)}`);
      console.log(`📝 Scenario ${si + 1}/${scenarios.length}: ${scenario.name}`);
      if (scenario.description) console.log(`   ${scenario.description}`);
      console.log(`${"═".repeat(60)}\n`);

      const scenarioResults = { name: scenario.name, steps: [], passed: true };

      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        totalSteps++;

        // Variable substitution in args
        const resolvedArgs = resolveVariables(step.args || {}, results);

        const callMsg = createMessage("tools/call", {
          name: step.tool,
          arguments: resolvedArgs,
        });

        const stepStart = Date.now();
        let response;
        try {
          response = await sendMessage(callMsg);
        } catch (err) {
          failedSteps++;
          const stepResult = {
            tool: step.tool,
            status: "FAIL",
            error: err.message,
            duration: Date.now() - stepStart,
          };
          scenarioResults.steps.push(stepResult);
          scenarioResults.passed = false;
          console.log(`   ❌ Step ${i + 1}: ${step.tool} — ${err.message}`);
          if (step.stopOnFail !== false) break;
          continue;
        }

        const duration = Date.now() - stepStart;
        const content = response.result?.content?.[0]?.text || "";
        const isError = response.result?.isError === true;

        // Check assertions
        let assertionPassed = true;
        let assertionMessage = "";
        if (step.assert) {
          if (step.assert.contains && !content.includes(step.assert.contains)) {
            assertionPassed = false;
            assertionMessage = `Expected response to contain "${step.assert.contains}"`;
          }
          if (step.assert.notContains && content.includes(step.assert.notContains)) {
            assertionPassed = false;
            assertionMessage = `Expected response NOT to contain "${step.assert.notContains}"`;
          }
          if (step.assert.statusCode) {
            const statusMatch = content.match(/Status:\s*(\d+)/);
            if (statusMatch && parseInt(statusMatch[1]) !== step.assert.statusCode) {
              assertionPassed = false;
              assertionMessage = `Expected status ${step.assert.statusCode}, got ${statusMatch[1]}`;
            }
          }
        }

        const stepPassed = !isError && assertionPassed;

        if (stepPassed) {
          passedSteps++;
          console.log(`   ✅ Step ${i + 1}: ${step.tool} (${duration}ms)`);
        } else {
          failedSteps++;
          scenarioResults.passed = false;
          const reason = isError ? content.substring(0, 100) : assertionMessage;
          console.log(`   ❌ Step ${i + 1}: ${step.tool} — ${reason} (${duration}ms)`);
        }

        if (verbose && content) {
          console.log(`      Response: ${content.substring(0, 200)}${content.length > 200 ? "..." : ""}`);
        }

        // Store result for variable extraction
        const stepResult = {
          tool: step.tool,
          status: stepPassed ? "PASS" : "FAIL",
          response: content,
          duration,
        };
        scenarioResults.steps.push(stepResult);

        // Extract variables for later steps
        if (step.extract) {
          for (const [varName, pattern] of Object.entries(step.extract)) {
            const regex = new RegExp(pattern);
            const match = content.match(regex);
            if (match) {
              process.env[`_VAR_${varName}`] = match[1] || match[0];
              if (verbose) console.log(`      Extracted: ${varName} = ${match[1] || match[0]}`);
            }
          }
        }

        // Stop on failure unless explicitly told to continue
        if (!stepPassed && step.stopOnFail !== false) {
          console.log(`   ⏹️  Stopping scenario due to step failure`);
          break;
        }
      }

      results.push(scenarioResults);
    }

    // ─── Generate report if tool is available ───
    if (availableTools.includes("generate_report")) {
      console.log(`\n📊 Generating report...`);
      const reportMsg = createMessage("tools/call", {
        name: "generate_report",
        arguments: { title: `CI/CD Test Run — ${new Date().toISOString().split("T")[0]}` },
      });
      try {
        const reportResp = await sendMessage(reportMsg);
        const reportContent = reportResp.result?.content?.[0]?.text || "";
        console.log(`   ${reportContent.split("\n").slice(0, 3).join("\n   ")}`);
      } catch {
        console.log(`   ⚠️  Report generation timed out (non-blocking)`);
      }
    }

    // ─── Summary ───
    const totalDuration = Date.now() - startTime;
    const allPassed = failedSteps === 0;

    console.log(`\n${"═".repeat(60)}`);
    console.log(`📊 TEST RESULTS SUMMARY`);
    console.log(`${"═".repeat(60)}`);
    console.log(`   Total Steps:  ${totalSteps}`);
    console.log(`   ✅ Passed:    ${passedSteps}`);
    console.log(`   ❌ Failed:    ${failedSteps}`);
    console.log(`   ⏱️  Duration:  ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`   📈 Pass Rate: ${totalSteps > 0 ? ((passedSteps / totalSteps) * 100).toFixed(1) : 0}%`);
    console.log(`${"═".repeat(60)}`);

    if (allPassed) {
      console.log(`\n🎉 ALL TESTS PASSED\n`);
    } else {
      console.log(`\n💥 ${failedSteps} TEST(S) FAILED\n`);
    }

    // Kill server process
    serverProcess.kill("SIGTERM");

    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error(`\n💥 Fatal error: ${error.message}\n`);
    serverProcess.kill("SIGTERM");
    process.exit(1);
  }
}

// ─── Variable Substitution ───
// Replaces {{VAR_NAME}} in step args with previously extracted values
function resolveVariables(obj, results) {
  const str = JSON.stringify(obj);
  const resolved = str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const envVal = process.env[`_VAR_${varName}`];
    if (envVal) return envVal;
    // Check environment variables directly
    if (process.env[varName]) return process.env[varName];
    return match;
  });
  return JSON.parse(resolved);
}

// ─── Run ───
runTests();
