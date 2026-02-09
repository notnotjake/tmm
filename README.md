# tmm

`tmm` is a powerfully simple tmux session manager for humans and AI agents.

It exists to remove friction from everyday tmux work: jumping between sessions, creating new ones, renaming, cleaning up old sessions, and quickly seeing where you are (`tmm which`) when your tmux status bar is hidden.

## Why use it

- Short commands for common session tasks.
- Interactive flows when you want speed without remembering exact names.
- Script-friendly commands for automation and agents.
- Works both inside tmux (switch client) and outside tmux (attach).

## Install

Requirements:

- [bun](https://bun.sh)
- [tmux](https://github.com/tmux/tmux)
- [fzf](https://github.com/junegunn/fzf)

```bash
bun install
bun link
```

## Install Skill

```bash
bunx skills add https://github.com/notnotjake/tmm --skill tmm
```

## Command Reference

| Command                          | Description                                   |
| -------------------------------- | --------------------------------------------- |
| `tmm`                            | Open session interactively with fuzzy search. |
| `tmm <session>`                  | Open a session by name.                       |
| `tmm new <session>`              | Create a new session.                         |
| `tmm <session> -p`               | Open a session or create it if missing.       |
| `tmm rename`                     | Rename a session.                             |
| `tmm remove <session>`           | Remove a session.                             |
| `tmm exit`                       | Exit the current session.                     |
| `tmm tail <session>`             | Show recent output from a session.            |
| `tmm run <session> -- <command>` | Run a command inside a session.               |
| `tmm keys <session> <key>`       | Send key input to a session.                  |
| `tmm ls`                         | List all session names.                       |
| `tmm which`                      | Show the current session name.                |
| `tmm help`                       | Show help.                                    |

### Open and create sessions

**Open session**

Description: Open an existing session. With no args, shows an interactive picker.

Syntax:

```bash
tmm
tmm <session>
tmm <session> -p
tmm <session> --present
```

Example:

```bash
tmm api
```

**Create session**

Description: Create a new session and open it, or create it in the background.

Syntax:

```bash
tmm new <session>
tmm new <session> -b
tmm new <session> --background
```

Example:

```bash
tmm new worker --background
```

**Open or create session**

Description: Open a session if it exists. If it does not exist, create it and then open it.

Example:

```bash
tmm ai-chat -p
```

### Change sessions

**Rename session**

Description: Rename interactively, rename current session, or rename by old/new names.

Syntax:

```bash
tmm rename
tmm rename <new>
tmm rename <old> <new>
```

Example:

```bash
tmm rename api api-v2
```

**Remove sessions**

Description: Remove one session by name, or select multiple interactively.

Syntax:

```bash
tmm remove
tmm remove <session>
```

Example:

```bash
tmm remove scratch
```

**Exit current session**

Description: Leave the current session (detach) or close it (kill).

Syntax:

```bash
tmm exit
tmm exit --detach
tmm exit --kill
```

Example:

```bash
tmm exit --detach
```

### Automate/session I/O

**Tail session output**

Description: Print recent scrollback from the active pane in a session.

Syntax:

```bash
tmm tail <session>
tmm tail <session> -l <lines>
tmm tail <session> --lines <lines>
```

Example:

```bash
tmm tail api --lines 100
```

**Run command in a session**

Description: Send a command to the session's active pane and print newly added output.

Syntax:

```bash
tmm run <session> -- <command...>
```

Example:

```bash
tmm run api -- npm test
```

**Send keys to a session**

Description: Send tmux key tokens directly (no Enter is added automatically).

Syntax:

```bash
tmm keys <session> <key...>
tmm keys <session> -- <key...>
```

Example:

```bash
tmm keys api C-c
```

### Inspect sessions

**List sessions**

Description: Print all tmux session names (non-interactive).

Syntax:

```bash
tmm ls
```

Example:

```bash
tmm ls
```

**Show current session**

Description: Print the current tmux session name (useful when status bar is hidden).

Syntax:

```bash
tmm which
```

Example:

```bash
tmm which
```

### Help

**Show help**

Description: Show global help or command-specific help.

Syntax:

```bash
tmm help [command]
tmm <command> --help
```

Example:

```bash
tmm tail --help
```
