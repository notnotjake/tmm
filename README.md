# tmm

`tmm` is a fast tmux session manager for humans and AI agents.

It exists to remove friction from everyday tmux work: jumping between sessions, creating new ones, renaming, cleaning up old sessions, and quickly seeing where you are (`tmm which`) when your tmux status bar is hidden.

## Why use it

- Short commands for common session tasks.
- Interactive flows when you want speed without remembering exact names.
- Script-friendly commands for automation and agents.
- Works both inside tmux (switch client) and outside tmux (attach).

## Install

```bash
bun install
bun link
```

## Usage

```bash
tmm                     # Fuzzy-select and open a session
tmm <name>              # Open a session by name
tmm new <name>          # Create and open a new session
tmm new <name> -b       # Create session in background

tmm rename              # Select a session and rename it
tmm rename <new>        # Rename current session (inside tmux)
tmm rename <old> <new>  # Rename a specific session

tmm remove              # Select one or more sessions to remove
tmm remove <name>       # Remove a specific session

tmm exit                # Prompt: detach or detach-and-remove current session
tmm exit --detach       # Detach from current session
tmm exit --kill         # Kill current session

tmm ls                  # List session names
tmm which               # Print current session name
tmm run <name> -- <cmd> # Run command in session and print newly added terminal lines
tmm tail <name>         # Show last 10 lines from session scrollback
tmm tail <name> -l 100  # Show last 100 lines from session scrollback
tmm keys <name> C-c     # Send key tokens directly and print newly added terminal lines
tmm keys <name> Enter   # Send Enter explicitly when needed
tmm keys <name> -l "npm run dev" # Send literal text without pressing Enter
tmm help [command]      # Show help
tmm <command> --help    # Show command-specific help
```

## Install Skill (for agents)

```bash
bunx skills add https://github.com/notnotjake/tmm --skill tmm
```

## Requirements

- [bun](https://bun.sh)
- [tmux](https://github.com/tmux/tmux)
- [fzf](https://github.com/junegunn/fzf)
