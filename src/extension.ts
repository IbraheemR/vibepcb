import * as vscode from 'vscode';
import { SchematicEditorProvider } from './provider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'vibepcb.schematicEditor',
      new SchematicEditorProvider(),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
}

export function deactivate() {}
