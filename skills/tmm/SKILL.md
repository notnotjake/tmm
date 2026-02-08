---
name: tmm
description: Powerfully simple tmux session management with the tmm CLI. Use when you need fast session creation, listing, opening/switching, renaming, removing, or exiting, especially for frequent session swaps and rename workflows by humans or AI agents.
---

Tmux is a great tool for managing multiple terminal sessions. This can enable better behavior around background tasks, users ability to resume a session, and users ability to pick up a session from another device (like their phone) via ssh.

The `tmm` command makes working with tmux easier both for you the AI agent as well as human computer users. Common tasks are more token effecient and easier: create sessions, list sessions, switch sessions, rename sessions and clean up sessions.

**Important: to run these commands, you probably need escelated permissions so that it executes with access to the tmux socket. Running within sandbox may incorrectly result in no output with exit code 0.**

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

## Quick Workflows

### Open an existing session

1. Run `tmm ls`.
2. Select an exact session name from stdout.
3. Run `tmm <session-name>`.

### Create a session without switching to it

1. Run `tmm new <session-name> --background`.
2. Optionally run `tmm ls` to verify creation.

### Exit current session in automation

1. Run `tmm which` when identity confirmation is required.
2. Run `tmm exit --detach` to leave the session running, or `tmm exit --kill` to remove it.
