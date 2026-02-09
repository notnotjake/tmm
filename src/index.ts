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

async function createSession(sessionName: string): Promise<void> {
  await $`tmux new-session -d -s ${sessionName}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function buildRunCommand(commandArgs: string[]): string {
  if (commandArgs.length === 1) {
    return commandArgs[0] ?? "";
  }

  return commandArgs.map((arg) => shellEscape(arg)).join(" ");
}

function splitLines(value: string): string[] {
  if (!value) return [];
  return value.split("\n");
}

function diffLines(before: string, after: string): string {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  let idx = 0;

  while (idx < beforeLines.length && idx < afterLines.length) {
    if (beforeLines[idx] !== afterLines[idx]) {
      break;
    }
    idx += 1;
  }

  return afterLines.slice(idx).join("\n").trimEnd();
}

function formatRunBoundary(label: string, width = 40, fillChar = "═"): string {
  const padLength = Math.max(0, width - label.length - 1);
  if (padLength === 0) {
    return label;
  }

  return `${label} ${fillChar.repeat(padLength)}`;
}

function printSessionOutput(options: {
  sessionName: string;
  output?: string;
  topMessage?: string;
}): void {
  const { sessionName, output, topMessage } = options;
  const runHeader = kleur.bold().cyan(formatRunBoundary(`tmm - ${sessionName}`, 40, "⌄"));
  const runFooter = kleur.bold().blue(formatRunBoundary(`END - ${sessionName}`, 40, "⌃"));

  if (topMessage) {
    console.log(kleur.dim(topMessage));
  }

  console.log(runHeader);

  if (output) {
    console.log(output);
  }

  console.log(runFooter);
}

async function getActivePaneId(sessionName: string): Promise<string> {
  const paneId = await $`tmux display-message -p -t ${sessionName}:. "#{pane_id}"`.text().catch(() => "");
  return paneId.trim();
}

async function capturePane(paneId: string, start: string): Promise<string> {
  const output = await $`tmux capture-pane -p -t ${paneId} -S ${start}`.text();
  return output.replaceAll("\r", "");
}

async function getPaneCurrentCommand(paneId: string): Promise<string> {
  const command = await $`tmux display-message -p -t ${paneId} "#{pane_current_command}"`.text().catch(() => "");
  return command.trim();
}

async function sendKeysToPane(paneId: string, keys: string[]): Promise<void> {
  const proc = Bun.spawn({
    cmd: ["tmux", "send-keys", "-t", paneId, ...keys],
    stdout: "ignore",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;

  if (exitCode === 0) return;

  const stderr = proc.stderr ? (await new Response(proc.stderr).text()).trim() : "";
  throw new Error(stderr || `tmux send-keys failed with exit code ${exitCode}`);
}

async function executeAndPrintPaneDiff(options: {
  paneId: string;
  sessionName: string;
  action: () => Promise<void>;
  timeoutMs?: number;
  stableMs?: number;
  timeoutMessage: string;
}): Promise<number> {
  const {
    paneId,
    sessionName,
    action,
    timeoutMs = 5000,
    stableMs = 500,
    timeoutMessage,
  } = options;

  const beforePane = await capturePane(paneId, "-50000").catch(() => "");
  const shellCommand = await getPaneCurrentCommand(paneId);

  await action();

  const deadline = Date.now() + timeoutMs;
  const startedAt = Date.now();
  let changedFromShell = false;
  let lastShellSeenAt = 0;
  let timedOut = true;

  while (Date.now() < deadline) {
    const currentCommand = await getPaneCurrentCommand(paneId);

    if (currentCommand !== shellCommand) {
      changedFromShell = true;
      lastShellSeenAt = 0;
      await sleep(100);
      continue;
    }

    // If pane_current_command did not change (very short action), allow
    // completion once we have a brief grace period and stable shell state.
    if (!changedFromShell && Date.now() - startedAt < 250) {
      await sleep(100);
      continue;
    }

    if (lastShellSeenAt === 0) {
      lastShellSeenAt = Date.now();
    }

    if (Date.now() - lastShellSeenAt >= stableMs) {
      timedOut = false;
      break;
    }

    await sleep(100);
  }

  const afterPane = await capturePane(paneId, "-50000").catch(() => "");
  const diffOutput = diffLines(beforePane, afterPane);
  printSessionOutput({
    sessionName,
    output: diffOutput || undefined,
    topMessage: timedOut ? timeoutMessage : undefined,
  });

  return timedOut ? 124 : 0;
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
  await createSession(sessionName);
  if (!openInBackground) {
    await openSession(sessionName);
  }
  process.exit(0);
}

if (args[0] === "run") {
  const runArgs = args.slice(1);
  const separatorIndex = runArgs.indexOf("--");

  if (separatorIndex !== 1 || runArgs.length < 3) {
    printCommandHelp("run");
    process.exit(1);
  }

  const sessionName = runArgs[0]!;
  const commandArgs = runArgs.slice(separatorIndex + 1);
  if (commandArgs.length === 0) {
    printCommandHelp("run");
    process.exit(1);
  }

  const sessions = await getSessions();
  const matched = findSessionByName(sessions, sessionName);

  if (!matched) {
    console.log(`Session not found: ${sessionName}`);
    process.exit(1);
  }

  const paneId = await getActivePaneId(matched.name);
  if (!paneId) {
    console.log(`Could not resolve active pane for session: ${matched.name}`);
    process.exit(1);
  }

  const commandText = buildRunCommand(commandArgs);
  let exitCode = 1;
  try {
    exitCode = await executeAndPrintPaneDiff({
      paneId,
      sessionName: matched.name,
      action: async () => {
        await $`tmux send-keys -t ${paneId} -l ${commandText}`;
        await $`tmux send-keys -t ${paneId} C-m`;
      },
      timeoutMs: 5000,
      stableMs: 500,
      timeoutMessage: "Key send timed out after 5s; showing output captured so far.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run command in session";
    console.log(message);
    process.exit(1);
  }

  process.exit(exitCode);
}

if (args[0] === "tail") {
  const tailArgs = args.slice(1);
  if (tailArgs.length === 0) {
    printCommandHelp("tail");
    process.exit(1);
  }

  const sessionName = tailArgs[0]!;
  let lineCount = 10;

  for (let i = 1; i < tailArgs.length; i += 1) {
    const arg = tailArgs[i];

    if (arg === "-l" || arg === "--lines") {
      const nextValue = tailArgs[i + 1];
      if (!nextValue) {
        printCommandHelp("tail");
        process.exit(1);
      }

      const parsed = Number.parseInt(nextValue, 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        console.log("Line count must be a positive integer");
        process.exit(1);
      }

      lineCount = parsed;
      i += 1;
      continue;
    }

    printCommandHelp("tail");
    process.exit(1);
  }

  const sessions = await getSessions();
  const matched = findSessionByName(sessions, sessionName);

  if (!matched) {
    console.log(`Session not found: ${sessionName}`);
    process.exit(1);
  }

  const paneId = await getActivePaneId(matched.name);
  if (!paneId) {
    console.log(`Could not resolve active pane for session: ${matched.name}`);
    process.exit(1);
  }

  const paneOutput = await capturePane(paneId, `-${lineCount}`).catch(() => "");
  printSessionOutput({
    sessionName: matched.name,
    output: paneOutput.trimEnd() || undefined,
  });

  process.exit(0);
}

if (args[0] === "keys") {
  const keysArgs = args.slice(1);
  if (keysArgs.length < 2) {
    printCommandHelp("keys");
    process.exit(1);
  }

  const sessionName = keysArgs[0]!;
  const rawKeyTokens = keysArgs.slice(1);
  const keyTokens = rawKeyTokens[0] === "--" ? rawKeyTokens.slice(1) : rawKeyTokens;
  if (keyTokens.length === 0) {
    printCommandHelp("keys");
    process.exit(1);
  }

  const sessions = await getSessions();
  const matched = findSessionByName(sessions, sessionName);

  if (!matched) {
    console.log(`Session not found: ${sessionName}`);
    process.exit(1);
  }

  const paneId = await getActivePaneId(matched.name);
  if (!paneId) {
    console.log(`Could not resolve active pane for session: ${matched.name}`);
    process.exit(1);
  }

  let exitCode = 1;
  try {
    exitCode = await executeAndPrintPaneDiff({
      paneId,
      sessionName: matched.name,
      action: async () => {
        await sendKeysToPane(paneId, keyTokens);
      },
      timeoutMs: 5000,
      stableMs: 500,
      timeoutMessage: "Key send timed out after 5s; showing output captured so far.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send keys";
    console.log(message);
    process.exit(1);
  }

  process.exit(exitCode);
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
  let openOrCreate = false;
  const positionalArgs: string[] = [];

  for (const arg of args) {
    if (arg === "-p" || arg === "--present") {
      openOrCreate = true;
      continue;
    }

    if (arg.startsWith("-")) {
      printCommandHelp("open");
      process.exit(1);
    }

    positionalArgs.push(arg);
  }

  if (positionalArgs.length !== 1) {
    printCommandHelp("open");
    process.exit(1);
  }

  const targetSessionName = positionalArgs[0]!;
  const sessions = await getSessions();
  const matched = findSessionByName(sessions, targetSessionName);

  if (!matched) {
    if (openOrCreate) {
      console.log(`creating and opening tmux session ${targetSessionName}`);
      await createSession(targetSessionName);
      await openSession(targetSessionName);
      process.exit(0);
    }

    console.log(`Session not found: ${targetSessionName}`);
    process.exit(1);
  }

  if (openOrCreate) {
    console.log(`opening existing tmux session ${matched.name}`);
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
