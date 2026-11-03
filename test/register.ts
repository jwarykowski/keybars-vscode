// Tests run outside VS Code: this points the vscode module at test/vscode.ts.
import { register } from "node:module";

register("./hooks.ts", import.meta.url);
