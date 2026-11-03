// A module hook: vscode resolves to the stand-in beside this file.
type Next = (specifier: string, context: unknown) => Promise<unknown>;

export async function resolve(specifier: string, context: unknown, next: Next): Promise<unknown> {
  if (specifier === "vscode") return { url: new URL("./vscode.ts", import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
