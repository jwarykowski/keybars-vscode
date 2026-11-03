// The extension's wiring: activate() under a stand-in vscode module that
// fires events as VS Code would, against a fake keybars-pro that logs what
// it was asked to do.
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "keybars-vscode-"));
const log = join(dir, "log");
const fake = join(dir, "keybars-pro");
// watch prints a Focus session; everything else is logged
writeFileSync(
  fake,
  `#!/bin/sh
if [ "$1" = watch ]; then echo '{"event":"focus","data":{"phase":"work","remaining":690}}'; exec sleep 5; fi
echo "$*" >>"${log}"
`,
);
chmodSync(fake, 0o755);
after(() => rmSync(dir, { recursive: true, force: true }));

type Listener = (e: unknown) => void;
const on: Record<string, Listener[]> = {};
const event = (name: string) => (fn: Listener) => {
  (on[name] ??= []).push(fn);
  return { dispose() {} };
};
const fire = (name: string, e?: unknown) => on[name]?.forEach((fn) => fn(e));

const settings: Record<string, unknown> = { command: fake };
let diagnostics: [unknown, { severity: number }[]][] = [];
const status = { text: "", shown: false };
const commands: Record<string, () => void> = {};
const folder = { uri: { fsPath: "/work/shop" } };

const gitRepo = {
  rootUri: { fsPath: "/work/shop" },
  state: {
    HEAD: { name: "feat/cart" },
    workingTreeChanges: [] as unknown[],
    indexChanges: [] as unknown[],
    onDidChange: event("git"),
  },
};

// test/vscode.ts hands this to the extension as the vscode module
(globalThis as unknown as { vscode: unknown }).vscode = {
  workspace: {
    getConfiguration: () => ({ get: (k: string) => settings[k] }),
    onDidChangeConfiguration: event("config"),
    workspaceFolders: [folder],
  },
  window: {
    createStatusBarItem: () => ({
      set text(t: string) {
        status.text = t;
      },
      show: () => (status.shown = true),
      hide: () => (status.shown = false),
      dispose() {},
    }),
    showWarningMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    setStatusBarMessage: () => ({ dispose() {} }),
  },
  commands: {
    registerCommand: (id: string, fn: () => void) => {
      commands[id] = fn;
      return { dispose() {} };
    },
  },
  languages: { getDiagnostics: () => diagnostics, onDidChangeDiagnostics: event("diagnostics") },
  tasks: { onDidStartTaskProcess: event("taskStart"), onDidEndTaskProcess: event("taskEnd") },
  debug: {
    onDidStartDebugSession: event("debugStart"),
    onDidTerminateDebugSession: event("debugEnd"),
    onDidChangeActiveStackItem: event("stack"),
  },
  extensions: {
    getExtension: () => ({
      isActive: true,
      exports: { getAPI: () => ({ repositories: [gitRepo], onDidOpenRepository: event("openRepo") }) },
    }),
  },
  DiagnosticSeverity: { Error: 0, Warning: 1 },
  StatusBarAlignment: { Left: 1, Right: 2 },
};

const { activate, deactivate } = await import("./extension.ts");
const context = { subscriptions: [] as { dispose(): void }[] };
activate(context as never);
after(() => {
  deactivate();
  context.subscriptions.forEach((s) => s.dispose());
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function sent(want: string): Promise<void> {
  for (let i = 0; i < 50; i++) {
    let got = "";
    try {
      got = readFileSync(log, "utf8");
    } catch {
      // nothing yet
    }
    if (got.split("\n").includes(want)) {
      writeFileSync(log, "");
      return;
    }
    await wait(50);
  }
  assert.fail(`want "${want}", got: ${readFileSync(log, "utf8")}`);
}

const task = (group: string, isBackground = false) => ({
  execution: { task: { group: { id: group }, isBackground, scope: folder } },
});

test("a build task", async () => {
  fire("taskStart", task("build"));
  await sent("alert -q -repo shop -branch feat/cart build.running");
  fire("taskEnd", { ...task("build"), exitCode: 2 });
  await sent("alert -q -repo shop -branch feat/cart build.failed");
});

test("a test task", async () => {
  fire("taskEnd", { ...task("test"), exitCode: 0 });
  await sent("alert -q -repo shop -branch feat/cart test.passed");
});

test("errors hold a key until they're fixed", async () => {
  diagnostics = [[{}, [{ severity: 0 }, { severity: 1 }]]];
  fire("diagnostics");
  await sent("light esc red -effect hold");
  diagnostics = [[{}, [{ severity: 1 }]]];
  fire("diagnostics");
  await sent("clear esc");
});

test("the debugger", async () => {
  const session = { workspaceFolder: folder };
  fire("debugStart", session);
  await sent("alert -q -repo shop -branch feat/cart debug.started");
  fire("stack", { session });
  await sent("alert -q -repo shop -branch feat/cart debug.paused");
  fire("stack", undefined);
  await sent("alert -q -repo shop -branch feat/cart debug.continued");
});

test("uncommitted changes", async () => {
  await wait(50);
  gitRepo.state.workingTreeChanges = [{}];
  fire("git");
  await sent("alert -q -repo shop -branch feat/cart git.dirty");
  gitRepo.state.workingTreeChanges = [];
  fire("git");
  await sent("alert -q -repo shop -branch feat/cart git.clean");
});

test("Focus in the status bar, and its command", async () => {
  for (let i = 0; i < 50 && !status.shown; i++) await wait(50);
  assert.equal(status.text, "🎯 12m");
  commands["keybars.focusToggle"]();
  await sent("focus stop");
});
