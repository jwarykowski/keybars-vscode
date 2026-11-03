import assert from "node:assert/strict";
import { test } from "node:test";

import { alert, errorsKey, gitEvent, lines, statusText, taskEnded, taskName, watchEvent } from "./core.ts";

test("alert names the repository and branch when there are some", () => {
  assert.deepEqual(alert("git.dirty"), ["alert", "-q", "git.dirty"]);
  assert.deepEqual(alert("git.dirty", "shop", "feat/cart"), [
    "alert",
    "-q",
    "-repo",
    "shop",
    "-branch",
    "feat/cart",
    "git.dirty",
  ]);
});

test("tasks are build.* unless they're tests", () => {
  assert.equal(taskName("build"), "build");
  assert.equal(taskName(undefined), "build");
  assert.equal(taskName("test"), "test");
  assert.equal(taskEnded("test", 0), "test.passed");
  assert.equal(taskEnded("build", 2), "build.failed");
  assert.equal(taskEnded(undefined, undefined), "build.failed");
});

test("the errors key changes only when errors come or go", () => {
  assert.deepEqual(errorsKey(0, false, "esc", "red"), { lit: false });
  assert.deepEqual(errorsKey(3, false, "esc", "red"), {
    lit: true,
    args: ["light", "esc", "red", "-effect", "hold"],
  });
  assert.deepEqual(errorsKey(5, true, "esc", "red"), { lit: true });
  assert.deepEqual(errorsKey(0, true, "esc", "red"), { lit: false, args: ["clear", "esc"] });
});

test("git events on a change, not on the first look", () => {
  assert.equal(gitEvent(undefined, true), undefined);
  assert.equal(gitEvent(false, false), undefined);
  assert.equal(gitEvent(false, true), "git.dirty");
  assert.equal(gitEvent(true, false), "git.clean");
});

test("the status bar shows Focus and typing", () => {
  assert.equal(statusText(), "");
  assert.equal(statusText({ phase: "idle" }), "");
  assert.equal(statusText({ phase: "work", remaining: 690 }), "🎯 12m");
  assert.equal(statusText({ phase: "break", remaining: 60 }, { wpm: 73.6 }), "☕ 1m · 74 wpm");
  assert.equal(statusText(undefined, { wpm: 0 }), "");
});

test("watch output is read a whole line at a time", () => {
  assert.deepEqual(lines("", '{"a":1}\n{"b"'), { done: ['{"a":1}'], rest: '{"b"' });
  assert.deepEqual(lines('{"b"', ":2}\n\n"), { done: ['{"b":2}'], rest: "" });
  assert.deepEqual(watchEvent('{"event":"focus","data":{"phase":"work"}}'), {
    event: "focus",
    data: { phase: "work" },
  });
  assert.equal(watchEvent("nope"), undefined);
  assert.equal(watchEvent('{"data":1}'), undefined);
});
