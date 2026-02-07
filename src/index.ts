#!/usr/bin/env bun
import { $ } from "bun";
import * as p from "@clack/prompts";
import kleur from "kleur";

const styles = {
  title: kleur.bold().blue,
  muted: kleur.dim,
  label: kleur.bold().blue,
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

function isInTmuxSession(): boolean {
  return Boolean(process.env.TMUX);
}

async function getCurrentSessionName(): Promise<string> {
  const sessionName = await $`tmux display-message -p "#S"`.text();
  return sessionName.trim();
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

function printHelp() {
  const pad = 27;
  const row = (cmd: string, styledCmd: string, desc: string) => {
    const padding = " ".repeat(pad - cmd.length);
    console.log(`  ${styledCmd}${padding}${desc}`);
  };
  console.log(`${styles.title("tmm")} ${styles.muted("- tmux session manager")}`);
  console.log("");
  row("tmm <name>", `${styles.label("tmm")} ${styles.muted("<name>")}`, "Open a session");
  row("tmm new <name>", `${styles.label("tmm")} new ${styles.muted("<name>")}`, "Create a new session");
  row("tmm rename <new>", `${styles.label("tmm")} rename ${styles.muted("<new>")}`, "Rename current session (inside tmux)");
  row("tmm rename <old> <new>", `${styles.label("tmm")} rename ${styles.muted("<old> <new>")}`, "Rename a session");
  row("tmm exit [-k|--kill]", `${styles.label("tmm")} exit ${styles.muted("[-k|--kill]")}`, "Exit current session (detach/remove)");
  row("tmm remove <name>", `${styles.label("tmm")} remove ${styles.muted("<name>")}`, "Remove sessions");
  row("tmm ls", `${styles.label("tmm")} ls`, "List sessions");
  row("tmm which", `${styles.label("tmm")} which`, "Show current session name");
  row("tmm help", `${styles.label("tmm")} help`, "Show this help");
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

if (args[0] === "which") {
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
    console.log("Usage: tmm exit [-k|--kill]");
    process.exit(1);
  }

  const killFlag = exitArgs[0];
  if (killFlag && killFlag !== "-k" && killFlag !== "--kill") {
    console.log("Usage: tmm exit [-k|--kill]");
    process.exit(1);
  }

  if (!isInTmuxSession()) {
    console.log("Not in a tmux session");
    process.exit(1);
  }

  const currentSessionName = await getCurrentSessionName();
  if (killFlag) {
    await $`tmux detach-client`;
    await $`tmux kill-session -t ${currentSessionName}`.quiet();
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

  await $`tmux detach-client`;
  await $`tmux kill-session -t ${currentSessionName}`.quiet();
  process.exit(0);
}

if (args[0] === "ls") {
  if (args.length > 1) {
    console.log("Usage: tmm ls");
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
    console.log("Usage: tmm remove [session-name]");
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
    console.log("Usage: tmm rename [new-session-name]");
    console.log("Usage: tmm rename <old-session-name> <new-session-name>");
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
    console.log("Usage: tmm [session-name]");
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
