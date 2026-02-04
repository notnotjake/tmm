#!/usr/bin/env bun
import { $ } from "bun";
import * as p from "@clack/prompts";
import kleur from "kleur";

const styles = {
  title: kleur.bold().cyan,
  muted: kleur.dim,
  label: kleur.green,
};

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function getSessions(): Promise<{ name: string; label: string }[]> {
  const raw = await $`tmux list-sessions -F "#{session_name}|#{session_activity}" 2>/dev/null`
    .text()
    .catch(() => "");

  if (!raw.trim()) return [];

  return raw.trim().split("\n").map((line) => {
    const parts = line.split("|");
    const name = parts[0] ?? "";
    const activity = parts[1] ?? "0";
    const date = formatDate(parseInt(activity));
    return { name, label: `${name} ${styles.muted(`(${date})`)}` };
  });
}

function printHelp() {
  console.log(`${styles.title("tmm")} ${styles.muted("- tmux session manager")}`);
  console.log("");
  console.log(`  ${styles.label("tmm")}                    Select and attach to a session`);
  console.log(`  ${styles.label("tmm")} new ${styles.muted("<name>")}        Create a new session`);
  console.log(`  ${styles.label("tmm")} remove              Select sessions to remove`);
  console.log(`  ${styles.label("tmm")} help                Show this help`);
}

const args = process.argv.slice(2);

// Handle help
if (args[0] === "help" || args[0] === "-h" || args[0] === "--help") {
  printHelp();
  process.exit(0);
}

// Handle subcommands
if (args[0] === "new") {
  const sessionName = args[1];
  if (!sessionName) {
    console.log("Usage: tmm new <session-name>");
    process.exit(1);
  }
  await $`tmux new-session -s ${sessionName}`;
  process.exit(0);
}

if (args[0] === "remove") {
  const sessions = await getSessions();

  if (sessions.length === 0) {
    console.log("No tmux sessions found");
    process.exit(0);
  }

  const selected = await p.multiselect({
    message: "Select sessions to remove",
    options: sessions.map((s) => ({ value: s.name, label: s.label })),
  });

  if (p.isCancel(selected) || selected.length === 0) {
    p.cancel("No sessions removed");
    process.exit(0);
  }

  for (const session of selected) {
    await $`tmux kill-session -t ${session}`.quiet();
    console.log(kleur.red(`Removed: ${session}`));
  }

  process.exit(0);
}

// Default: list and attach
const sessions = await getSessions();

if (sessions.length === 0) {
  console.log("No tmux sessions found");
  process.exit(0);
}

// Format for fzf: label on each line
const fzfInput = sessions.map((s) => s.label).join("\n");

// Pipe to fzf for selection
const selection = await $`echo ${fzfInput} | fzf --ansi`.text().catch(() => "");

if (!selection.trim()) {
  process.exit(0); // User cancelled
}

// Extract session name (first word before space)
const sessionName = selection.split(" ")[0];

// Attach
await $`tmux attach -t ${sessionName}`;
