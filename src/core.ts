// What the extension sends keybars Pro, worked out without VS Code, so it can
// be tested on its own.

/** The keybars-pro arguments for an event about a repository and branch. */
export function alert(event: string, repo?: string, branch?: string): string[] {
  const args = ["alert", "-q"];
  if (repo) args.push("-repo", repo);
  if (branch) args.push("-branch", branch);
  args.push(event);
  return args;
}

/** A task's events are test.* for test tasks, build.* for the rest. */
export function taskName(group: string | undefined): string {
  return group === "test" ? "test" : "build";
}

/** The event for a task that ended with this exit code (undefined when VS Code couldn't tell). */
export function taskEnded(group: string | undefined, code: number | undefined): string {
  return `${taskName(group)}.${code === 0 ? "passed" : "failed"}`;
}

/**
 * The errors key's next step: light it when errors appear, clear it when
 * they're gone, nothing while that's already so.
 */
export function errorsKey(
  errors: number,
  lit: boolean,
  key: string,
  colour: string,
): { lit: boolean; args?: string[] } {
  const want = errors > 0;
  if (want === lit) return { lit };
  return { lit: want, args: want ? ["light", key, colour, "-effect", "hold"] : ["clear", key] };
}

/** git.dirty or git.clean when uncommitted changes come or go; nothing the first time. */
export function gitEvent(was: boolean | undefined, dirty: boolean): string | undefined {
  if (was === undefined || was === dirty) return undefined;
  return dirty ? "git.dirty" : "git.clean";
}

export type Focus = { phase?: string; remaining?: number };
export type Typing = { wpm?: number };

/** The status bar's text for the latest focus and typing news: "🎯 12m · 74 wpm", or "". */
export function statusText(focus?: Focus, typing?: Typing): string {
  const parts: string[] = [];
  if (focus && (focus.phase === "work" || focus.phase === "break")) {
    const icon = focus.phase === "work" ? "🎯" : "☕";
    parts.push(`${icon} ${Math.ceil((focus.remaining ?? 0) / 60)}m`);
  }
  if (typing?.wpm && typing.wpm > 0) parts.push(`${Math.round(typing.wpm)} wpm`);
  return parts.join(" · ");
}

/** Splits keybars-pro watch's output into whole lines, keeping the partial last one. */
export function lines(buffered: string, chunk: string): { done: string[]; rest: string } {
  const all = (buffered + chunk).split("\n");
  const rest = all.pop() ?? "";
  return { done: all.filter((l) => l.trim() !== ""), rest };
}

/** One line of keybars-pro watch: its event and data, or undefined. */
export function watchEvent(line: string): { event: string; data: unknown } | undefined {
  try {
    const v: unknown = JSON.parse(line);
    if (v && typeof v === "object" && "event" in v && typeof v.event === "string") {
      return { event: v.event, data: "data" in v ? v.data : undefined };
    }
  } catch {
    // not JSON: skipped
  }
  return undefined;
}
