import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('metalens.metalens'));
  });

  test('Should register commands', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('metalens.openChat'));
    assert.ok(commands.includes('metalens.searchAssets'));
  });
});
