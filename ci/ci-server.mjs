#!/usr/bin/env node

/**
 * MCP CI/CD Agent Server
 * 
 * Exposes CI/CD operations as MCP tools so Claude Desktop can:
 * - Trigger GitHub Actions workflows
 * - Check run status
 * - List recent runs
 * - Run tests locally via the test runner
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { exit } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const DEFAULT_WORKFLOW = "qa-automation.yml";

// ─── State ───

let defaultRepo = "";      // e.g. "RowthCodes/my-project"
let defaultWorkflow = DEFAULT_WORKFLOW;

// ─── Helpers ───

function run(cmd, cwd = PROJECT_ROOT) {
  try {
    return { success: true, output: execSync(cmd, { encoding: "utf-8", cwd, timeout: 120000 }).trim() };
  } catch (err) {
    return { success: false, output: err.stderr?.trim() || err.message };
  }
}

/** Build the `-R owner/repo` flag from args or default */
function repoFlag(argsRepo) {
  const repo = argsRepo || defaultRepo;
  return repo ? `-R ${repo}` : "";
}

/** Build the workflow file reference */
function workflowRef(argsWorkflow) {
  return argsWorkflow || defaultWorkflow;
}

function ghAvailable() {
  try { execSync("gh --version", { stdio: "ignore" }); return true; } catch { return false; }
}

function ghAuthenticated() {
  try { execSync("gh auth status 2>&1", { stdio: "ignore" }); return true; } catch { return false; }
}

// ─── Common Schema Properties ───

const repoProperty = {
  repo: {
    type: "string",
    description: "GitHub repo in owner/repo format (e.g. 'RowthCodes/my-app'). Uses default repo if not provided. Set default with ci_set_default_repo.",
  },
};

const workflowProperty = {
  workflow: {
    type: "string",
    description: "Workflow filename (e.g. 'ci.yml'). Default: qa-automation.yml. Set default with ci_set_default_repo.",
  },
};

// ─── Tool Definitions ───

const tools = [
  // ─── Repo Management ───
  {
    name: "ci_set_default_repo",
    description: "Set the default GitHub repository and workflow for all CI tools. Once set, you don't need to pass repo/workflow to every tool call.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "GitHub repo in owner/repo format (e.g. 'RowthCodes/my-app')",
        },
        workflow: {
          type: "string",
          description: "Workflow filename (e.g. 'ci.yml', 'test.yml'). Default: qa-automation.yml",
        },
      },
    },
  },
  {
    name: "ci_get_default_repo",
    description: "Show the currently configured default repo and workflow",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ci_list_repos",
    description: "List GitHub repositories you have access to. Helps discover repo names for targeting CI commands.",
    inputSchema: {
      type: "object",
      properties: {
        owner: {
          type: "string",
          description: "GitHub username or org to list repos for (optional — lists your repos by default)",
        },
        limit: { type: "number", description: "Number of repos to show (default: 15)", default: 15 },
      },
    },
  },
  {
    name: "ci_list_workflows",
    description: "List available workflows in a repository. Helps discover which workflow files exist.",
    inputSchema: {
      type: "object",
      properties: {
        ...repoProperty,
      },
    },
  },
  // ─── Pipeline Operations ───
  {
    name: "trigger_ci_pipeline",
    description: "Trigger a GitHub Actions workflow. Runs UI, API, and/or DB tests in the cloud on the specified repo.",
    inputSchema: {
      type: "object",
      properties: {
        ...repoProperty,
        ...workflowProperty,
        test_suite: {
          type: "string",
          enum: ["all", "api-only", "ui-only", "db-only"],
          description: "Which test suite to run",
          default: "all",
        },
        environment: {
          type: "string",
          enum: ["staging", "production"],
          description: "Target environment",
          default: "staging",
        },
        branch: {
          type: "string",
          description: "Branch to run on (default: repo's default branch)",
        },
        test_prompt: {
          type: "string",
          description: "Optional: Custom test prompt for Claude Agent mode in CI",
        },
      },
    },
  },
  {
    name: "ci_run_status",
    description: "Check the status of the last CI/CD pipeline run in a repo",
    inputSchema: {
      type: "object",
      properties: {
        ...repoProperty,
        ...workflowProperty,
      },
    },
  },
  {
    name: "ci_list_runs",
    description: "List recent CI/CD pipeline runs with their status for a repo",
    inputSchema: {
      type: "object",
      properties: {
        ...repoProperty,
        ...workflowProperty,
        limit: { type: "number", description: "Number of runs to show (default: 5)", default: 5 },
      },
    },
  },
  {
    name: "ci_watch_run",
    description: "Watch a running CI/CD pipeline until it completes and return the final result",
    inputSchema: {
      type: "object",
      properties: {
        ...repoProperty,
        run_id: { type: "string", description: "Run ID to watch (optional — watches latest if not provided)" },
      },
    },
  },
  {
    name: "ci_run_logs",
    description: "Get the logs from a CI/CD pipeline run",
    inputSchema: {
      type: "object",
      properties: {
        ...repoProperty,
        run_id: { type: "string", description: "Run ID (optional — gets latest if not provided)" },
        job: {
          type: "string",
          enum: ["test-api", "test-ui", "test-db", "build", "summary"],
          description: "Specific job to get logs for",
        },
      },
    },
  },
  {
    name: "ci_cancel_run",
    description: "Cancel a running CI/CD pipeline",
    inputSchema: {
      type: "object",
      properties: {
        ...repoProperty,
        run_id: { type: "string", description: "Run ID to cancel (optional — cancels latest if not provided)" },
      },
    },
  },
  {
    name: "run_tests_local",
    description: "Run MCP test scenarios locally (without CI). Uses the test runner to execute scenarios against an MCP server directly.",
    inputSchema: {
      type: "object",
      properties: {
        server: {
          type: "string",
          enum: ["api", "ui", "db"],
          description: "Which MCP server to test",
        },
        scenarios: {
          type: "string",
          description: "Path to scenarios JSON file (default: ci/scenarios/<server>-tests.json)",
        },
      },
      required: ["server"],
    },
  },
  {
    name: "ci_download_artifacts",
    description: "Download test report artifacts from the latest CI run",
    inputSchema: {
      type: "object",
      properties: {
        ...repoProperty,
        run_id: { type: "string", description: "Run ID (optional — downloads from latest if not provided)" },
      },
    },
  },
];

// ─── Create MCP Server ───

const server = new Server(
  { name: "mcp-server-ci", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Pre-checks for gh-based commands
  const ghCommands = ["trigger_ci_pipeline", "ci_run_status", "ci_list_runs", "ci_watch_run", "ci_run_logs", "ci_cancel_run", "ci_download_artifacts", "ci_list_repos", "ci_list_workflows"];
  if (ghCommands.includes(name)) {
    if (!ghAvailable()) {
      return { content: [{ type: "text", text: "❌ GitHub CLI (gh) not installed.\n\nInstall: /opt/homebrew/bin/brew install gh\nThen: gh auth login" }], isError: true };
    }
    if (!ghAuthenticated()) {
      return { content: [{ type: "text", text: "❌ GitHub CLI not authenticated.\n\nRun: gh auth login\nChoose: GitHub.com → HTTPS → Login with browser" }], isError: true };
    }
  }

  try {
    // ─── Set Default Repo ───
    if (name === "ci_set_default_repo") {
      if (args?.repo) defaultRepo = args.repo;
      if (args?.workflow) defaultWorkflow = args.workflow;

      return {
        content: [{
          type: "text",
          text: `✅ Defaults updated:\n\n📦 Repo: ${defaultRepo || "(not set — uses local git repo)"}\n📄 Workflow: ${defaultWorkflow}\n\nAll CI tools will now target this repo unless overridden per-call.`,
        }],
      };
    }

    // ─── Get Default Repo ───
    if (name === "ci_get_default_repo") {
      // Also detect local git remote
      let localRepo = "";
      const remote = run("git remote get-url origin 2>/dev/null");
      if (remote.success) {
        const m = remote.output.match(/github\.com[:/](.+?)(?:\.git)?$/);
        if (m) localRepo = m[1];
      }

      return {
        content: [{
          type: "text",
          text: `📦 Current Defaults:\n\n🎯 Default Repo: ${defaultRepo || "(not set)"}\n📄 Default Workflow: ${defaultWorkflow}\n🏠 Local Git Repo: ${localRepo || "(not detected)"}\n\n${!defaultRepo ? "💡 Tip: Use ci_set_default_repo to set a target repo, or pass 'repo' to any tool." : ""}`,
        }],
      };
    }

    // ─── List Repos ───
    if (name === "ci_list_repos") {
      const limit = args?.limit || 15;
      const owner = args?.owner;

      let cmd;
      if (owner) {
        cmd = `gh repo list ${owner} --limit ${limit} --json name,owner,description,isPrivate,updatedAt,defaultBranchRef --jq '.[] | "\\(.isPrivate | if . then "🔒" else "🌐" end) \\(.owner.login)/\\(.name) — \\(.description // "no description") (updated: \\(.updatedAt[:10]))"'`;
      } else {
        cmd = `gh repo list --limit ${limit} --json name,owner,description,isPrivate,updatedAt --jq '.[] | "\\(.isPrivate | if . then "🔒" else "🌐" end) \\(.owner.login)/\\(.name) — \\(.description // "no description") (updated: \\(.updatedAt[:10]))"'`;
      }

      const result = run(cmd);
      if (!result.success) {
        return { content: [{ type: "text", text: `❌ ${result.output}` }], isError: true };
      }

      return {
        content: [{
          type: "text",
          text: `📦 Repositories${owner ? ` (${owner})` : ""}:\n\n${result.output}\n\n💡 Use ci_set_default_repo with repo="owner/name" to target a repo.`,
        }],
      };
    }

    // ─── List Workflows ───
    if (name === "ci_list_workflows") {
      const rf = repoFlag(args?.repo);
      const result = run(`gh workflow list ${rf} --json name,path,state --jq '.[] | "\\(.state == "active" | if . then "✅" else "⏸️" end) \\(.name) — \\(.path)"'`);
      if (!result.success) {
        return { content: [{ type: "text", text: `❌ ${result.output}` }], isError: true };
      }

      const targetRepo = args?.repo || defaultRepo || "(local)";
      return {
        content: [{
          type: "text",
          text: `📄 Workflows in ${targetRepo}:\n\n${result.output}\n\n💡 Use the filename (e.g. "ci.yml") with ci_set_default_repo or pass workflow="filename.yml" to trigger_ci_pipeline.`,
        }],
      };
    }

    // ─── Trigger Pipeline ───
    if (name === "trigger_ci_pipeline") {
      const rf = repoFlag(args?.repo);
      const wf = workflowRef(args?.workflow);
      const suite = args?.test_suite || "all";
      const env = args?.environment || "staging";
      const prompt = args?.test_prompt || "";
      const branch = args?.branch;

      let cmd = `gh workflow run ${wf} ${rf} -f test_suite=${suite} -f environment=${env}`;
      if (branch) cmd += ` --ref ${branch}`;
      if (prompt) cmd += ` -f test_prompt="${prompt.replace(/"/g, '\\"')}"`;

      const result = run(cmd);
      if (!result.success) {
        return { content: [{ type: "text", text: `❌ Failed to trigger pipeline:\n${result.output}` }], isError: true };
      }

      // Wait for run to appear
      await new Promise(r => setTimeout(r, 3000));

      // Get the run URL
      const runsResult = run(`gh run list ${rf} --workflow=${wf} --limit 1 --json url,status,databaseId,headBranch,createdAt`);
      let runInfo = "";
      if (runsResult.success) {
        try {
          const runs = JSON.parse(runsResult.output);
          if (runs.length > 0) {
            runInfo = `\n🔗 Run URL: ${runs[0].url}\n📊 Status: ${runs[0].status}\n🌿 Branch: ${runs[0].headBranch}\n🕐 Started: ${runs[0].createdAt}`;
          }
        } catch {}
      }

      const targetRepo = args?.repo || defaultRepo || "(local)";
      return {
        content: [{
          type: "text",
          text: `🚀 CI/CD Pipeline Triggered!\n\n📦 Repo: ${targetRepo}\n📄 Workflow: ${wf}\n📋 Suite: ${suite}\n🌍 Environment: ${env}${branch ? `\n🌿 Branch: ${branch}` : ""}${prompt ? `\n💬 Prompt: ${prompt}` : ""}${runInfo}\n\n💡 Use ci_run_status to check progress, or ci_watch_run to wait for completion.`,
        }],
      };
    }

    // ─── Run Status ───
    if (name === "ci_run_status") {
      const rf = repoFlag(args?.repo);
      const wf = workflowRef(args?.workflow);
      const result = run(`gh run list ${rf} --workflow=${wf} --limit 1 --json status,conclusion,name,createdAt,updatedAt,headBranch,url,databaseId,displayTitle`);
      if (!result.success) {
        return { content: [{ type: "text", text: `❌ Failed to get status:\n${result.output}` }], isError: true };
      }

      try {
        const runs = JSON.parse(result.output);
        if (runs.length === 0) {
          return { content: [{ type: "text", text: "ℹ️ No CI runs found for this workflow." }] };
        }
        const r = runs[0];
        const icon = r.conclusion === "success" ? "✅" : r.conclusion === "failure" ? "❌" : r.status === "in_progress" ? "🔄" : "⏳";
        const targetRepo = args?.repo || defaultRepo || "(local)";

        return {
          content: [{
            type: "text",
            text: `${icon} Last CI/CD Run — ${targetRepo}\n\n📝 Name: ${r.displayTitle || r.name}\n📊 Status: ${r.status}${r.conclusion ? ` (${r.conclusion})` : ""}\n🌿 Branch: ${r.headBranch}\n🕐 Started: ${r.createdAt}\n🕐 Updated: ${r.updatedAt}\n🔗 URL: ${r.url}\n🆔 Run ID: ${r.databaseId}`,
          }],
        };
      } catch {
        return { content: [{ type: "text", text: result.output }] };
      }
    }

    // ─── List Runs ───
    if (name === "ci_list_runs") {
      const rf = repoFlag(args?.repo);
      const wf = workflowRef(args?.workflow);
      const limit = args?.limit || 5;
      const result = run(`gh run list ${rf} --workflow=${wf} --limit ${limit} --json status,conclusion,displayTitle,createdAt,databaseId,url`);
      if (!result.success) {
        return { content: [{ type: "text", text: `❌ ${result.output}` }], isError: true };
      }

      try {
        const runs = JSON.parse(result.output);
        if (runs.length === 0) {
          return { content: [{ type: "text", text: "ℹ️ No CI runs found." }] };
        }

        const lines = runs.map((r, i) => {
          const icon = r.conclusion === "success" ? "✅" : r.conclusion === "failure" ? "❌" : r.status === "in_progress" ? "🔄" : "⏳";
          return `${icon} #${r.databaseId} | ${r.displayTitle || "QA Automation"} | ${r.status}${r.conclusion ? ` (${r.conclusion})` : ""} | ${r.createdAt}`;
        });

        const targetRepo = args?.repo || defaultRepo || "(local)";
        return { content: [{ type: "text", text: `📋 Recent CI/CD Runs — ${targetRepo} (${runs.length}):\n\n${lines.join("\n")}` }] };
      } catch {
        return { content: [{ type: "text", text: result.output }] };
      }
    }

    // ─── Watch Run ───
    if (name === "ci_watch_run") {
      const rf = repoFlag(args?.repo);
      const wf = workflowRef(args?.workflow);
      let runId = args?.run_id;
      if (!runId) {
        const latest = run(`gh run list ${rf} --workflow=${wf} --limit 1 --json databaseId`);
        try {
          const runs = JSON.parse(latest.output);
          runId = runs[0]?.databaseId;
        } catch {}
      }

      if (!runId) {
        return { content: [{ type: "text", text: "❌ No run found to watch." }], isError: true };
      }

      const result = run(`gh run watch ${runId} ${rf} --exit-status 2>&1`);
      const icon = result.success ? "✅" : "❌";

      return {
        content: [{
          type: "text",
          text: `${icon} CI Run #${runId} ${result.success ? "PASSED" : "FAILED"}\n\n${result.output}`,
        }],
        isError: !result.success,
      };
    }

    // ─── Run Logs ───
    if (name === "ci_run_logs") {
      const rf = repoFlag(args?.repo);
      const wf = workflowRef(args?.workflow);
      let runId = args?.run_id;
      const job = args?.job;

      if (!runId) {
        const latest = run(`gh run list ${rf} --workflow=${wf} --limit 1 --json databaseId`);
        try {
          const runs = JSON.parse(latest.output);
          runId = runs[0]?.databaseId;
        } catch {}
      }

      if (!runId) {
        return { content: [{ type: "text", text: "❌ No run found." }], isError: true };
      }

      let cmd = `gh run view ${runId} ${rf} --log 2>&1`;
      if (job) cmd = `gh run view ${runId} ${rf} --log --job $(gh run view ${runId} ${rf} --json jobs --jq '.jobs[] | select(.name | test("${job}"; "i")) | .databaseId') 2>&1`;

      // Log output can be huge — limit it
      const result = run(`${cmd} | tail -100`);
      return {
        content: [{
          type: "text",
          text: `📜 Logs for Run #${runId}${job ? ` (${job})` : ""}:\n\n${result.output}`,
        }],
      };
    }

    // ─── Cancel Run ───
    if (name === "ci_cancel_run") {
      const rf = repoFlag(args?.repo);
      const wf = workflowRef(args?.workflow);
      let runId = args?.run_id;
      if (!runId) {
        const latest = run(`gh run list ${rf} --workflow=${wf} --limit 1 --status in_progress --json databaseId`);
        try {
          const runs = JSON.parse(latest.output);
          runId = runs[0]?.databaseId;
        } catch {}
      }

      if (!runId) {
        return { content: [{ type: "text", text: "ℹ️ No running pipeline found to cancel." }] };
      }

      const result = run(`gh run cancel ${runId} ${rf}`);
      return {
        content: [{
          type: "text",
          text: result.success ? `🛑 Run #${runId} cancelled.` : `❌ Failed to cancel: ${result.output}`,
        }],
      };
    }

    // ─── Run Tests Locally ───
    if (name === "run_tests_local") {
      const serverType = args?.server;
      const defaultScenarios = `ci/scenarios/${serverType === "ui" ? "ui" : serverType === "db" ? "db" : "api"}-tests.json`;
      const scenarios = args?.scenarios || defaultScenarios;
      const scenariosPath = resolve(PROJECT_ROOT, scenarios);

      if (!existsSync(scenariosPath)) {
        return { content: [{ type: "text", text: `❌ Scenarios file not found: ${scenariosPath}` }], isError: true };
      }

      const runnerPath = resolve(PROJECT_ROOT, "ci/test-runner.mjs");
      const result = run(`node ${runnerPath} --server ${serverType} --scenarios ${scenariosPath}`);

      const icon = result.success ? "✅" : "❌";
      return {
        content: [{
          type: "text",
          text: `${icon} Local ${serverType.toUpperCase()} Tests ${result.success ? "PASSED" : "FAILED"}\n\n${result.output}`,
        }],
        isError: !result.success,
      };
    }

    // ─── Download Artifacts ───
    if (name === "ci_download_artifacts") {
      const rf = repoFlag(args?.repo);
      const wf = workflowRef(args?.workflow);
      let runId = args?.run_id;
      if (!runId) {
        const latest = run(`gh run list ${rf} --workflow=${wf} --limit 1 --json databaseId`);
        try {
          const runs = JSON.parse(latest.output);
          runId = runs[0]?.databaseId;
        } catch {}
      }

      if (!runId) {
        return { content: [{ type: "text", text: "❌ No run found." }], isError: true };
      }

      const downloadDir = resolve(PROJECT_ROOT, "ci-artifacts");
      const result = run(`gh run download ${runId} ${rf} --dir ${downloadDir} 2>&1`);

      if (result.success) {
        // List downloaded files
        const files = run(`find ${downloadDir} -type f | head -20`);
        return {
          content: [{
            type: "text",
            text: `📥 Artifacts downloaded to ci-artifacts/\n\n${files.output || "No files found"}`,
          }],
        };
      } else {
        return { content: [{ type: "text", text: `❌ Download failed:\n${result.output}` }], isError: true };
      }
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };

  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// ─── Start ───
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP CI/CD Agent Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  exit(1);
});
