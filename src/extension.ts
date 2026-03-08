import * as vscode from 'vscode';
import { SchematicEditorProvider } from './provider';
import { PcbEditorProvider } from './pcbProvider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'vibepcb.schematicEditor',
      new SchematicEditorProvider(),
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.window.registerCustomEditorProvider(
      'vibepcb.pcbEditor',
      new PcbEditorProvider(),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
}

export function deactivate() {}
