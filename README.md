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
tmm new <name>       # Create a new session
tmm rename           # Select a session and rename it
tmm rename <new>     # Rename the current session (inside tmux)
tmm rename <old> <new> # Rename a session directly
tmm exit [-k|--kill] # Exit current session (prompt by default, kill with flag)
tmm remove           # Select sessions to remove (multiselect)
tmm remove <name>    # Remove a session by name
tmm ls               # List sessions (non-interactive)
tmm which            # Show current session name
tmm help             # Show help
```

## Requirements

- [bun](https://bun.sh)
- [tmux](https://github.com/tmux/tmux)
- [fzf](https://github.com/junegunn/fzf)
