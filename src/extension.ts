// keybars for VS Code: tasks, errors, the debugger and uncommitted changes
// sent to keybars Pro through its keybars-pro command, and Focus and typing
// speed in the status bar.
import { type ChildProcess, execFile, execFileSync, spawn } from "node:child_process";
import * as path from "node:path";

import * as vscode from "vscode";

import {
  alert,
  errorsKey,
  type Focus,
  gitEvent,
  lines,
  statusText,
  taskEnded,
  taskName,
  type Typing,
  watchEvent,
} from "./core.ts";

// the part of the built-in git extension's API this uses
type GitRepository = {
  rootUri: vscode.Uri;
  state: {
    HEAD?: { name?: string };
    workingTreeChanges: unknown[];
    indexChanges: unknown[];
    onDidChange: vscode.Event<void>;
  };
};
type GitAPI = {
  repositories: GitRepository[];
  onDidOpenRepository: vscode.Event<GitRepository>;
};

const config = () => vscode.workspace.getConfiguration("keybars");
const command = () => config().get<string>("command") || "keybars-pro";

let warned = false;

/** Runs keybars-pro with args; tells you once if it isn't installed. */
function run(args: string[], done?: (err: Error | null, out: string) => void): void {
  execFile(command(), args, { timeout: 10_000 }, (err, stdout) => {
    if (err && "code" in err && err.code === "ENOENT" && !warned) {
      warned = true;
      void vscode.window.showWarningMessage(
        "keybars: keybars-pro isn't installed. In keybars Pro: App settings, Command line, Install the command-line tool.",
      );
    }
    done?.(err, stdout);
  });
}

let git: GitAPI | undefined;

/** The repository (folder name) and branch a file or the workspace is in. */
function where(uri?: vscode.Uri): { repo?: string; branch?: string } {
  const target = uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
  const repo = git?.repositories
    .filter((r) => !target || target.fsPath.startsWith(r.rootUri.fsPath))
    .toSorted((a, b) => b.rootUri.fsPath.length - a.rootUri.fsPath.length)[0];
  if (repo) return { repo: path.basename(repo.rootUri.fsPath), branch: repo.state.HEAD?.name };
  return { repo: target ? path.basename(target.fsPath) : undefined };
}

function send(event: string, uri?: vscode.Uri): void {
  const at = where(uri);
  run(alert(event, at.repo, at.branch));
}

function scopeUri(task: vscode.Task): vscode.Uri | undefined {
  return typeof task.scope === "object" ? task.scope.uri : undefined;
}

function tasks(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.tasks.onDidStartTaskProcess((e) => {
      const task = e.execution.task;
      if (!(config().get<boolean>("tasks") ?? true) || task.isBackground) return;
      send(`${taskName(task.group?.id)}.running`, scopeUri(task));
    }),
    vscode.tasks.onDidEndTaskProcess((e) => {
      const task = e.execution.task;
      if (!(config().get<boolean>("tasks") ?? true) || task.isBackground) return;
      send(taskEnded(task.group?.id, e.exitCode), scopeUri(task));
    }),
  );
}

let lit = false;
let litKey = "";

function errors(context: vscode.ExtensionContext): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const sync = () => {
    const on = config().get<boolean>("errors") ?? true;
    const key = config().get<string>("errorsKey") || "esc";
    const colour = config().get<string>("errorsColour") || "red";
    const count = on
      ? vscode.languages
          .getDiagnostics()
          .reduce((n, [, ds]) => n + ds.filter((d) => d.severity === vscode.DiagnosticSeverity.Error).length, 0)
      : 0;
    if (lit && key !== litKey) {
      // the key changed: let go of the old one first
      run(["clear", litKey]);
      lit = false;
    }
    const next = errorsKey(count, lit, key, colour);
    lit = next.lit;
    litKey = key;
    if (next.args) run(next.args);
  };
  // diagnostics change in bursts while you type
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 400);
  };
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(soon),
    vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration("keybars") && soon()),
    { dispose: () => clearTimeout(timer) },
  );
  soon();
}

function debug(context: vscode.ExtensionContext): void {
  let paused = false;
  const on = () => config().get<boolean>("debug") ?? true;
  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession((s) => on() && send("debug.started", s.workspaceFolder?.uri)),
    vscode.debug.onDidTerminateDebugSession((s) => {
      paused = false;
      if (on()) send("debug.ended", s.workspaceFolder?.uri);
    }),
    vscode.debug.onDidChangeActiveStackItem((item) => {
      const now = item !== undefined;
      if (now === paused) return;
      paused = now;
      if (on()) send(now ? "debug.paused" : "debug.continued", item?.session.workspaceFolder?.uri);
    }),
  );
}

async function gitChanges(context: vscode.ExtensionContext): Promise<void> {
  const ext = vscode.extensions.getExtension<{ getAPI(v: 1): GitAPI }>("vscode.git");
  if (!ext) return;
  const exports = ext.isActive ? ext.exports : await ext.activate();
  git = exports.getAPI(1);
  const dirty = new Map<string, boolean>();
  const watch = (repo: GitRepository) => {
    const look = () => {
      const now = repo.state.workingTreeChanges.length + repo.state.indexChanges.length > 0;
      const event = gitEvent(dirty.get(repo.rootUri.fsPath), now);
      dirty.set(repo.rootUri.fsPath, now);
      if (event && (config().get<boolean>("git") ?? true)) send(event, repo.rootUri);
    };
    context.subscriptions.push(repo.state.onDidChange(look));
    look();
  };
  git.repositories.forEach(watch);
  context.subscriptions.push(git.onDidOpenRepository(watch));
}

let watcher: ChildProcess | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let focus: Focus | undefined;
let typing: Typing | undefined;

function statusBar(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = "keybars.focusToggle";
  item.tooltip = "keybars Pro: start or stop Focus";
  const show = () => {
    const text = statusText(focus, typing);
    item.text = text;
    if (text) item.show();
    else item.hide();
  };
  const start = () => {
    clearTimeout(retry);
    watcher?.kill();
    watcher = undefined;
    focus = typing = undefined;
    show();
    if (!(config().get<boolean>("statusBar") ?? true)) return;
    const child = spawn(command(), ["watch", "-only", "focus,typing"], { stdio: ["ignore", "pipe", "ignore"] });
    watcher = child;
    let rest = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const got = lines(rest, chunk);
      rest = got.rest;
      for (const line of got.done) {
        const ev = watchEvent(line);
        if (ev?.event === "focus") focus = ev.data as Focus;
        if (ev?.event === "typing") typing = ev.data as Typing;
      }
      show();
    });
    child.on("error", () => {});
    child.on("exit", () => {
      if (watcher !== child) return;
      // the app quit or isn't running: try again in a while
      watcher = undefined;
      focus = typing = undefined;
      show();
      retry = setTimeout(start, 30_000);
    });
  };
  context.subscriptions.push(
    item,
    vscode.workspace.onDidChangeConfiguration(
      (e) => (e.affectsConfiguration("keybars.statusBar") || e.affectsConfiguration("keybars.command")) && start(),
    ),
    { dispose: () => (clearTimeout(retry), watcher?.kill()) },
  );
  start();
}

function focusCommand(args: string[], said: string): void {
  run(["focus", ...args], (err) => {
    if (err) void vscode.window.showErrorMessage(`keybars: ${err.message.split("\n").at(-1) || err.message}`);
    else vscode.window.setStatusBarMessage(`keybars: ${said}`, 3000);
  });
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("keybars.focusStart", () => focusCommand(["start"], "Focus started")),
    vscode.commands.registerCommand("keybars.focusStop", () => focusCommand(["stop"], "Focus stopped")),
    vscode.commands.registerCommand("keybars.focusToggle", () =>
      focus?.phase === "work" || focus?.phase === "break"
        ? focusCommand(["stop"], "Focus stopped")
        : focusCommand(["start"], "Focus started"),
    ),
  );
  tasks(context);
  errors(context);
  debug(context);
  statusBar(context);
  void gitChanges(context);
}

export function deactivate(): void {
  if (!lit) return;
  try {
    execFileSync(command(), ["clear", litKey], { timeout: 1000 });
  } catch {
    // keybars Pro isn't running: nothing to clear
  }
}
