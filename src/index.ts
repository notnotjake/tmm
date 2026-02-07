#!/usr/bin/env bun
import { $ } from "bun";
import * as p from "@clack/prompts";
import kleur from "kleur";
import {
  isHelpFlag,
  isNamedCommand,
  printCommandHelp,
  printMainHelp,
  resolveHelpTarget,
} from "./help";

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isInTmuxSession(): boolean {
  return Boolean(process.env.TMUX);
}

async function getCurrentSessionName(): Promise<string> {
  const sessionName = await $`tmux display-message -p "#S"`.text();
  return sessionName.trim();
}

async function getSessions(): Promise<{ name: string; label: string }[]> {
  const currentSessionName = isInTmuxSession()
    ? await getCurrentSessionName().catch(() => "")
    : "";

  const raw = await $`tmux list-sessions -F "#{session_name}|#{session_activity}" 2>/dev/null`
    .text()
    .catch(() => "");

  if (!raw.trim()) return [];

  return raw.trim().split("\n").map((line) => {
    const parts = line.split("|");
    const name = parts[0] ?? "";
    const activity = parts[1] ?? "0";
    const date = formatDate(parseInt(activity));
    const activeBadge = name === currentSessionName ? ` ${kleur.bold("Active")}` : "";
    return { name, label: `${name}${activeBadge} ${kleur.dim(`(${date})`)}` };
  });
}

function findSessionByName(
  sessions: { name: string; label: string }[],
  targetName: string,
): { name: string; label: string } | undefined {
  return sessions.find((session) => session.name === targetName);
}

async function selectSessionWithFzf(
  sessions: { name: string; label: string }[],
  prompt = "Select a session > ",
): Promise<string | null> {
  const fzfInput = sessions.map((s) => s.label).join("\n");
  const selection = await $`echo ${fzfInput} | fzf --ansi --prompt=${prompt}`.text().catch(() => "");
  const selectedLabel = selection.trim();
  if (!selectedLabel) return null;

  const matched = sessions.find((s) => s.label === selectedLabel);
  if (matched) return matched.name;

  // Fallback for unexpected formatting changes.
  return selectedLabel.split(" ")[0] ?? null;
}

async function renameSession(oldName: string, newName: string): Promise<void> {
  await $`tmux rename-session -t ${oldName} ${newName}`;
  console.log(kleur.green(`Renamed: ${oldName} -> ${newName}`));
}

async function openSession(sessionName: string): Promise<void> {
  if (isInTmuxSession()) {
    await $`tmux switch-client -t ${sessionName}`;
    return;
  }

  await $`tmux attach -t ${sessionName}`;
}

const args = process.argv.slice(2);
const command = args[0];

// Handle help
if (isHelpFlag(command)) {
  printMainHelp();
  process.exit(0);
}

if (command === "help") {
  const target = args[1];

  if (!target || isHelpFlag(target)) {
    printMainHelp();
    process.exit(0);
  }

  if (args.length > 2) {
    console.log("Usage: tmm help [command]");
    process.exit(1);
  }

  const resolvedTarget = resolveHelpTarget(target);
  if (!resolvedTarget) {
    console.log(`Unknown command: ${target}`);
    process.exit(1);
  }

  printCommandHelp(resolvedTarget, { detailed: false });
  process.exit(0);
}

if (isNamedCommand(command) && args.slice(1).some((arg) => isHelpFlag(arg))) {
  printCommandHelp(command);
  process.exit(0);
}

// Handle subcommands
if (args[0] === "new") {
  const newArgs = args.slice(1);
  let openInBackground = false;
  const positionalArgs: string[] = [];

  for (const arg of newArgs) {
    if (arg === "-b" || arg === "--background") {
      openInBackground = true;
      continue;
    }

    if (arg.startsWith("-")) {
      printCommandHelp("new");
      process.exit(1);
    }

    positionalArgs.push(arg);
  }

  if (positionalArgs.length !== 1) {
    printCommandHelp("new");
    process.exit(1);
  }

  const sessionName = positionalArgs[0]!;
  await $`tmux new-session -d -s ${sessionName}`;
  if (!openInBackground) {
    await openSession(sessionName);
  }
  process.exit(0);
}

if (args[0] === "which") {
  if (args.length > 1) {
    printCommandHelp("which");
    process.exit(1);
  }

  if (!isInTmuxSession()) {
    console.log("Not in a tmux session");
    process.exit(1);
  }
  console.log(await getCurrentSessionName());
  process.exit(0);
}

if (args[0] === "exit") {
  const exitArgs = args.slice(1);
  if (exitArgs.length > 1) {
    printCommandHelp("exit");
    process.exit(1);
  }

  const exitFlag = exitArgs[0];
  if (exitFlag && exitFlag !== "-d" && exitFlag !== "--detach" && exitFlag !== "-k" && exitFlag !== "--kill") {
    printCommandHelp("exit");
    process.exit(1);
  }

  if (!isInTmuxSession()) {
    console.log("Not in a tmux session");
    process.exit(1);
  }

  const currentSessionName = await getCurrentSessionName();
  if (exitFlag === "-k" || exitFlag === "--kill") {
    await $`tmux kill-session -t ${currentSessionName}`.quiet();
    process.exit(0);
  }

  if (exitFlag === "-d" || exitFlag === "--detach") {
    await $`tmux detach-client`;
    process.exit(0);
  }

  const action = await p.select({
    message: `Exit session "${currentSessionName}"`,
    options: [
      {
        value: "detach",
        label: "Detach",
        hint: "Leave session running",
      },
      {
        value: "detach-and-remove",
        label: "Detach and remove",
        hint: "Kill current session",
      },
    ],
  });

  if (p.isCancel(action)) {
    p.cancel("Session exit cancelled");
    process.exit(0);
  }

  if (action === "detach") {
    await $`tmux detach-client`;
    process.exit(0);
  }

  await $`tmux kill-session -t ${currentSessionName}`.quiet();
  process.exit(0);
}

if (args[0] === "ls") {
  if (args.length > 1) {
    printCommandHelp("ls");
    process.exit(1);
  }

  const sessions = await getSessions();

  if (sessions.length === 0) {
    process.exit(0);
  }

  for (const session of sessions) {
    console.log(session.name);
  }

  process.exit(0);
}

if (args[0] === "remove") {
  if (args.length > 2) {
    printCommandHelp("remove");
    process.exit(1);
  }

  const targetSessionName = args[1];
  if (targetSessionName) {
    const sessions = await getSessions();
    const matched = findSessionByName(sessions, targetSessionName);

    if (!matched) {
      console.log(`Session not found: ${targetSessionName}`);
      process.exit(1);
    }

    await $`tmux kill-session -t ${matched.name}`.quiet();
    console.log(kleur.red(`Removed: ${matched.name}`));
    process.exit(0);
  }

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

if (args[0] === "rename") {
  const renameArgs = args.slice(1);

  if (renameArgs.length > 2) {
    printCommandHelp("rename");
    process.exit(1);
  }

  const oldName = renameArgs[0];
  const newName = renameArgs[1];

  if (oldName && newName) {
    if (oldName === newName) {
      console.log("Old and new session names are the same");
      process.exit(1);
    }

    await renameSession(oldName, newName);
    process.exit(0);
  }

  if (oldName) {
    if (!isInTmuxSession()) {
      console.log("Not in a tmux session. Use one of:");
      console.log("  tmm rename <old-session-name> <new-session-name>");
      console.log("  tmm rename");
      process.exit(1);
    }

    const currentSessionName = await getCurrentSessionName();
    if (currentSessionName === oldName) {
      console.log("Old and new session names are the same");
      process.exit(1);
    }

    await renameSession(currentSessionName, oldName);
    process.exit(0);
  }

  const sessions = await getSessions();
  if (sessions.length === 0) {
    console.log("No tmux sessions found");
    process.exit(0);
  }

  const selected = await selectSessionWithFzf(sessions, "Rename session > ");
  if (!selected) {
    process.exit(0);
  }

  const updatedName = await p.text({
    message: `Enter new name for "${selected}"`,
    placeholder: "new-session-name",
    validate: (value) => {
      const trimmed = (value ?? "").trim();
      if (!trimmed) return "Session name is required";
      if (trimmed === selected) return "New session name must be different";
      return undefined;
    },
  });

  if (p.isCancel(updatedName)) {
    p.cancel("No session renamed");
    process.exit(0);
  }

  await renameSession(selected, updatedName.trim());
  process.exit(0);
}

if (args[0]) {
  if (args.length > 1) {
    printCommandHelp("open");
    process.exit(1);
  }

  const targetSessionName = args[0];
  const sessions = await getSessions();
  const matched = findSessionByName(sessions, targetSessionName);

  if (!matched) {
    console.log(`Session not found: ${targetSessionName}`);
    process.exit(1);
  }

  await openSession(matched.name);
  process.exit(0);
}

// Default: list and attach
const sessions = await getSessions();

if (sessions.length === 0) {
  console.log("No tmux sessions found");
  process.exit(0);
}

const sessionName = await selectSessionWithFzf(sessions);
if (!sessionName) {
  process.exit(0); // User cancelled
}

// Attach or switch
await openSession(sessionName);
