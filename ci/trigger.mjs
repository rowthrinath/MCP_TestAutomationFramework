#!/usr/bin/env node

/**
 * CI/CD Trigger Script
 * 
 * Triggers GitHub Actions workflows from the command line.
 * Can be called by Claude Code, Claude Desktop, or any automation.
 * 
 * Usage:
 *   node ci/trigger.mjs --suite all
 *   node ci/trigger.mjs --suite api-only --env staging
 *   node ci/trigger.mjs --suite ui-only --prompt "Test the login page"
 *   node ci/trigger.mjs --status           # Check last run status
 *   node ci/trigger.mjs --list             # List recent runs
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);

// ─── Parse Arguments ───
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const suite = getArg("--suite") || "all";
const env = getArg("--env") || "staging";
const prompt = getArg("--prompt") || "";
const showStatus = args.includes("--status");
const listRuns = args.includes("--list");
const watchRun = args.includes("--watch");

const WORKFLOW_FILE = "qa-automation.yml";

// ─── Helper ───
function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8", cwd: process.cwd() }).trim();
  } catch (err) {
    return err.stderr || err.message;
  }
}

function ghAvailable() {
  try {
    execSync("gh --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ghAuthenticated() {
  try {
    execSync("gh auth status", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ─── Commands ───

if (!ghAvailable()) {
  console.error("❌ GitHub CLI (gh) not installed.");
  console.error("   Install: brew install gh");
  process.exit(1);
}

if (!ghAuthenticated()) {
  console.error("❌ GitHub CLI not authenticated.");
  console.error("   Run: gh auth login");
  process.exit(1);
}

// List recent workflow runs
if (listRuns) {
  console.log("\n📋 Recent CI/CD Runs:\n");
  const output = run(`gh run list --workflow=${WORKFLOW_FILE} --limit 10`);
  console.log(output);
  process.exit(0);
}

// Check status of last run
if (showStatus) {
  console.log("\n🔍 Last CI/CD Run Status:\n");
  const output = run(`gh run list --workflow=${WORKFLOW_FILE} --limit 1 --json status,conclusion,name,createdAt,updatedAt,headBranch,url`);
  try {
    const runs = JSON.parse(output);
    if (runs.length > 0) {
      const r = runs[0];
      const icon = r.conclusion === "success" ? "✅" : r.conclusion === "failure" ? "❌" : "🔄";
      console.log(`   ${icon} Status: ${r.status} (${r.conclusion || "in progress"})`);
      console.log(`   📝 Name: ${r.name}`);
      console.log(`   🌿 Branch: ${r.headBranch}`);
      console.log(`   🕐 Started: ${r.createdAt}`);
      console.log(`   🔗 URL: ${r.url}`);
    } else {
      console.log("   No runs found for this workflow.");
    }
  } catch {
    console.log(output);
  }
  process.exit(0);
}

// Trigger the workflow
console.log("\n🚀 Triggering CI/CD Pipeline");
console.log(`   Suite:       ${suite}`);
console.log(`   Environment: ${env}`);
if (prompt) console.log(`   Prompt:      ${prompt}`);
console.log();

let triggerCmd = `gh workflow run ${WORKFLOW_FILE}`;
triggerCmd += ` -f test_suite=${suite}`;
triggerCmd += ` -f environment=${env}`;
if (prompt) triggerCmd += ` -f test_prompt="${prompt.replace(/"/g, '\\"')}"`;

const result = run(triggerCmd);
if (result) {
  console.log(result);
}

console.log("✅ Workflow triggered successfully!\n");

// Wait a moment for the run to appear
await new Promise(r => setTimeout(r, 3000));

// Show the run URL
const runsOutput = run(`gh run list --workflow=${WORKFLOW_FILE} --limit 1 --json url,status,databaseId`);
try {
  const runs = JSON.parse(runsOutput);
  if (runs.length > 0) {
    console.log(`   🔗 Run URL: ${runs[0].url}`);
    console.log(`   📊 Status:  ${runs[0].status}`);

    if (watchRun) {
      console.log(`\n⏳ Watching run progress...\n`);
      const watchOutput = run(`gh run watch ${runs[0].databaseId}`);
      console.log(watchOutput);
    } else {
      console.log(`\n   💡 To watch progress: node ci/trigger.mjs --status`);
      console.log(`   💡 Or open the URL above in your browser`);
    }
  }
} catch {
  console.log("   Check status: node ci/trigger.mjs --status");
}

console.log();
