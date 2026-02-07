# tmm

Minimal tmux session manager. Fuzzy-find sessions to attach, create new ones, or bulk remove.

## Install

```bash
bun install
bun link
```

## Usage

```
tmm                  # Select and open a session (attach/switch)
tmm <name>           # Open a session by name (attach/switch)
tmm new <name>       # Create and open a new session (attach/switch)
tmm new <name> -b    # Create a new session in the background (same as --background)
tmm rename           # Select a session and rename it
tmm rename <new>     # Rename the current session (inside tmux)
tmm rename <old> <new> # Rename a session directly
tmm exit [-d|--detach|-k|--kill] # Exit current session (prompt by default, or non-interactive with --detach/--kill)
tmm remove           # Select sessions to remove (multiselect)
tmm remove <name>    # Remove a session by name
tmm ls               # List sessions (non-interactive)
tmm which            # Show current session name
tmm help [command]   # Show help (or command-specific help)
tmm <command> --help # Show command-specific help
```

## Requirements

- [bun](https://bun.sh)
- [tmux](https://github.com/tmux/tmux)
- [fzf](https://github.com/junegunn/fzf)
