---
name: tmm
description: Powerfully simple tmux session management with the tmm CLI. Use when you need fast session creation, listing, opening/switching, renaming, removing, exiting, running commands in-session, reading session output, or sending key presses for agent-driven terminal control.
---

Tmux is a great tool for managing multiple terminal sessions. This can enable better behavior around background tasks, users ability to resume a session, and users ability to pick up a session from another device (like their phone) via ssh.

The `tmm` command makes working with tmux easier for both AI agents and humans: create sessions, list/switch sessions, rename/remove sessions, run commands inside a session, tail session output, and send direct keys.

**Important:** You may need escalated permissions to access the tmux socket. In sandboxed environments, tmux commands can appear to succeed but return no data.

## Commands

**Session Info:**
`tmm ls` lists all tmux sessions.
`tmm which` displays the tmux session name when you are inside tmux or "Not in a tmux session" when not inside a tmux session.

**Attaching to Sessions:**
`tmm <session name>` eg. `tmm spring-dev-server` attaches to a tmux session.
`tmm new <session name>` creates a new tmux session and attaches to it. Use `-b` or `--background` to create a new session in the background without attaching to it.

**Managing Sessions:**
`tmm rename <old> <new>` changes the name of a specific session.
`tmm rename <new>` will rename the current/active tmux session. When you are in a tmux session this renames it and leaves you in the session.
`tmm remove <session name>` will close/destroy a tmux session by name.
`tmm exit --detach` allows you to detach from the current/active tmux session. When you are in a tmux session you can use `-d` or `--detach` to detach and keep that session running in background.
`tmm exit --kill` allows you to detach from the current/active tmux session and remove the session. When you are in a tmux session you can use `-k` or `--kill` to detach and close/destroy that session.

**Agent Interaction Commands:**
`tmm run <session> -- <cmd>` types and executes a command in the target session shell, then returns newly-added terminal lines with a session wrapper.
`tmm tail <session>` prints the last 10 lines from the active pane in the session (also wrapped).
`tmm tail <session> -l 100` prints the last 100 lines (`-l` / `--lines`).
`tmm keys <session> <key>` sends key tokens directly via `tmux send-keys` with no implicit Enter.
`tmm keys <session> -l "pwd"` sends literal text only; combine with `tmm keys <session> Enter` to submit.

**Run/Keys Timeout Behavior:**
- `run` and `keys` wait up to 5 seconds for command activity to settle.
- On timeout they still print captured output and exit with code `124`.

## Quick Workflows

### Open an existing session

1. Run `tmm ls`.
2. Select an exact session name from stdout.
3. Run `tmm <session>`.

### Create a session without switching to it

1. Run `tmm new <session> --background`.
2. Optionally run `tmm ls` to verify creation.

### Exit current session in automation

1. Run `tmm which` when identity confirmation is required.
2. Run `tmm exit --detach` to leave the session running, or `tmm exit --kill` to remove it.

### Run command and inspect output

1. Run `tmm run <session> -- <cmd>`.
2. Read output between the wrapper lines:
   `tmm - <session> ...`
   `END - <session> ...`

### Interactive flow with keys

1. Use `tmm run <session> -- <cmd>` to start an interactive program if needed.
2. Send control/navigation keys with `tmm keys <session> C-c`, `tmm keys <session> Enter`, etc.
3. Use `tmm tail <session> -l <n>` to inspect current state at any point.
