import test from "node:test";
import assert from "node:assert/strict";
import { extensionHostLabel, isRemoteExtensionHost, remoteHostWarning } from "../src/vscode/environment.js";

test("extensionHostLabel treats missing remoteName as local", () => {
  assert.equal(extensionHostLabel({ env: {} }), "local");
  assert.equal(isRemoteExtensionHost({ env: {} }), false);
});

test("remoteHostWarning explains where serial ports are resolved", () => {
  const warning = remoteHostWarning({ env: { remoteName: "ssh-remote" } });

  assert.match(warning, /ssh-remote/);
  assert.match(warning, /Serial ports belong to that machine/);
});
