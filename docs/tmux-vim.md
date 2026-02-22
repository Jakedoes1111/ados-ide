# tmux + Vim Modal Layout Extension

This document covers the `theia-ide-modal-layout-ext` extension in `theia-app/theia-extensions/modal-layout`.

## Modes

The extension tracks an app-wide modal state:

- `normal`
- `insert`
- `visual`
- `command`

Mode transitions:

- `Escape` always returns to `normal`
- `i` from `normal` switches to `insert`
- `v` from `normal` switches to `visual`
- `:` from `normal` switches to `command`
- `Enter` in `command` returns to `normal`

In `normal` mode, `h/j/k/l` navigate pane focus.

## tmux Prefix

`Ctrl+B` arms a tmux-like prefix state with a timeout (default `1250ms`).
While pending, the status bar shows `[C-b]` and the next key triggers an action.

Prefix actions:

- `"` or `-`: split horizontal
- `%` or `\\`: split vertical
- `h/j/k/l`: focus left/down/up/right
- `x`: close current pane
- `s`: save layout profile
- `r`: load layout profile
- `i/v/:/n`: switch vim mode (`insert`/`visual`/`command`/`normal`)

## Commands

Registered command IDs:

- `modal-layout.prefix`
- `modal-layout.split.horizontal`
- `modal-layout.split.vertical`
- `modal-layout.focus.left`
- `modal-layout.focus.right`
- `modal-layout.focus.up`
- `modal-layout.focus.down`
- `modal-layout.close-pane`
- `modal-layout.layout.save-profile`
- `modal-layout.layout.load-profile`
- `modal-layout.mode.normal`
- `modal-layout.mode.insert`
- `modal-layout.mode.visual`
- `modal-layout.mode.command`

## Keybindings

Direct keybindings are also contributed:

- `Ctrl/Cmd+B`: arm tmux prefix
- `Ctrl/Cmd+Alt+1`: split horizontal
- `Ctrl/Cmd+Alt+2`: split vertical
- `Ctrl/Cmd+Alt+H/J/K/L`: focus left/down/up/right
- `Ctrl/Cmd+Alt+X`: close pane
- `Ctrl/Cmd+Alt+S`: save layout profile
- `Ctrl/Cmd+Alt+R`: load layout profile
- `Escape`: normal mode
- `Ctrl/Cmd+Alt+I`: insert mode
- `Ctrl/Cmd+Alt+V`: visual mode
- `Ctrl/Cmd+Alt+M`: command mode

## Persistence

Using `StorageService`, the extension persists:

- current vim mode
- prefix timeout value
- last saved layout profile payload

Data key: `theia-ide.modal-layout.state`
