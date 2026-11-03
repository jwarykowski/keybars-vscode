// The vscode module under test: whatever the test put in globalThis.vscode.
const v = (globalThis as unknown as { vscode: Record<string, unknown> }).vscode;

export const workspace = v.workspace;
export const window = v.window;
export const commands = v.commands;
export const languages = v.languages;
export const tasks = v.tasks;
export const debug = v.debug;
export const extensions = v.extensions;
export const DiagnosticSeverity = v.DiagnosticSeverity;
export const StatusBarAlignment = v.StatusBarAlignment;
