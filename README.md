# keybars for VS Code

[keybars Pro](https://keybars.app/pro/) in VS Code: your editor's work on
the keyboard, and the keyboard's Focus timer in the status bar.

- **Tasks**: a task sends `build.running`, then `build.passed` or
  `build.failed` (`test.*` for test tasks), the events the marketplace's CI
  pack plays. Background tasks, such as watchers, are left out.
- **Errors**: a key holds red while the workspace has errors, and clears
  when they're fixed.
- **Debugger**: `debug.started`, `debug.paused` at a breakpoint,
  `debug.continued` and `debug.ended`.
- **Uncommitted changes**: `git.dirty` when a repository gets some,
  `git.clean` when they're committed or dropped.
- **Status bar**: the Focus timer and typing speed, `🎯 12m · 74 wpm`;
  click it to start or stop Focus. **keybars: Start Focus** and **Stop
  Focus** are in the command palette.

Events carry the repository's folder name and branch, so a rule can light
something different for one project. Everything goes through the
`keybars-pro` command, so it works on any keyboard keybars Pro drives.

## requirements

- keybars Pro running, with its command installed: App settings, Command
  line, **Install the command-line tool**
- VS Code 1.90 or later

## rules

Errors light their key directly. The other events only reach keybars Pro's
alert rules, so add the ones you want: the CI pack for tasks
(`keybars-pro market install ci-pack`), and rules of your own on the Alerts
page for the debugger and git, e.g.

```sh
keybars-pro rules add "Paused" debug.paused -keys top-right -colour amber -effect breathe -clear-on "debug.continued debug.ended"
```

## settings

| setting                | default       |                                             |
| ---------------------- | ------------- | ------------------------------------------- |
| `keybars.command`      | `keybars-pro` | the command, if it isn't on PATH            |
| `keybars.tasks`        | `true`        | send tasks' events                          |
| `keybars.errors`       | `true`        | hold a key while there are errors           |
| `keybars.errorsKey`    | `esc`         | that key, as `keybars-pro light` names keys |
| `keybars.errorsColour` | `red`         | its colour                                  |
| `keybars.debug`        | `true`        | send the debugger's events                  |
| `keybars.git`          | `true`        | send uncommitted changes' events            |
| `keybars.statusBar`    | `true`        | show Focus and typing speed                 |

## development

```sh
npm ci
npm run check && npm run lint && npm test
npm run package   # keybars-<version>.vsix
```

The tests run the extension's `activate()` under Node, with a stand-in
`vscode` module firing events and a fake `keybars-pro` logging what it's
asked.

## licence

MIT
