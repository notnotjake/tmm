# tmm

Minimal tmux session manager. Fuzzy-find sessions to attach, create new ones, or bulk remove.

## Install

```bash
bun install
bun link
```

## Usage

```
tmm                  # Select and attach to a session (fzf)
tmm new <name>       # Create a new session
tmm rename           # Select a session and rename it
tmm rename <old> <new> # Rename a session directly
tmm remove           # Select sessions to remove (multiselect)
tmm which            # Show current session name
tmm help             # Show help
```

## Requirements

- [bun](https://bun.sh)
- [tmux](https://github.com/tmux/tmux)
- [fzf](https://github.com/junegunn/fzf)
