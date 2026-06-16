let controller = null;

exports.activate = async function activate(context) {
  const vscode = require("vscode");
  const { activateWithVscode } = await import("./extension.js");
  controller = activateWithVscode(vscode, context);
  return controller;
};

exports.deactivate = function deactivate() {
  controller = null;
};
