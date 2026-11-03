# keybars for VS Code

A VS Code extension (TypeScript, bundled by esbuild) that sends tasks,
errors, the debugger and uncommitted changes to keybars Pro through its
`keybars-pro` command, and shows Focus in the status bar. README.md has the
detail; this file is what to keep in mind while working here.

## Commands

- `npm run check` (tsc), `npm run lint` (oxlint), `npm run fmt` (oxfmt;
  never prettier), `npm test`, `npm run package` (a .vsix).
- Tests are `node --test` with type stripping, no VS Code needed:
  `src/core.test.ts` covers the logic; `src/extension.test.ts` runs
  `activate()` with `test/vscode.ts` standing in for the vscode module
  (`test/hooks.ts` resolves it there) and a fake `keybars-pro`.

## Keep in mind

- Logic goes in `src/core.ts`, which doesn't import vscode; `extension.ts`
  only wires VS Code's events to it.
- The package is an ES module, but VS Code requires the bundle, so it's
  `dist/extension.cjs`.
- Read settings with a fallback (`?? true`): the stand-in vscode has no
  package.json defaults.
- `engines.vscode` is ^1.90 (for `debug.onDidChangeActiveStackItem`); keep
  `@types/vscode` at that version.
- A new vscode API the extension uses needs adding to `test/vscode.ts`.

## Related repos (in ~/development)

- `keybars-pro`: the app and the `keybars-pro` command (`alert`, `light`,
  `clear`, `focus`, `watch`).
- `keybars-nvim`: the Neovim plugin; the errors key and the status text
  behave the same.
