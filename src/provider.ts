import * as vscode from 'vscode';
import * as path from 'path';
import { readComponentDefs, readTemplate } from './loader';
import { buildHtml } from './webview/html';
import { renderSchematic, buildSvgDocument } from './render/renderer';
import type { SchematicRoot } from './types';

export class SchematicEditorProvider implements vscode.CustomTextEditorProvider {
  private readonly panels = new Map<string, vscode.WebviewPanel>();

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    const key = document.uri.toString();
    this.panels.set(key, webviewPanel);
    webviewPanel.webview.options = { enableScripts: true };

    const render = () => {
      webviewPanel.webview.html = this.buildWebviewHtml(document);
    };

    const sub = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === key) render();
    });

    webviewPanel.onDidDispose(() => {
      this.panels.delete(key);
      sub.dispose();
    });

    render();
  }

  /**
   * Export the schematic at the given URI as a standalone SVG string.
   * Reads directly from disk — no webview required, always in sync.
   */
  async exportSvg(uri: vscode.Uri): Promise<string> {
    const doc = await vscode.workspace.openTextDocument(uri);
    const schematicDir = path.dirname(uri.fsPath);
    let schematic: SchematicRoot | null = null;
    try { schematic = JSON.parse(doc.getText()) as SchematicRoot; } catch { /* ignore */ }

    const componentDefs = schematic ? readComponentDefs(schematic, schematicDir) : {};
    const template      = schematic ? readTemplate(schematic, schematicDir) : null;
    const result = renderSchematic({ schematic, componentDefs, template });
    return buildSvgDocument(result, template);
  }

  private buildWebviewHtml(document: vscode.TextDocument): string {
    const schematicDir = path.dirname(document.uri.fsPath);
    let schematic: SchematicRoot | null = null;
    let parseError = false;
    try {
      schematic = JSON.parse(document.getText()) as SchematicRoot;
    } catch {
      parseError = true;
    }
    const componentDefs = schematic ? readComponentDefs(schematic, schematicDir) : {};
    const template      = schematic ? readTemplate(schematic, schematicDir) : null;
    const title         = schematic?.schematic?.titleblock?.name ?? 'Schematic';
    return buildHtml(title, schematic, componentDefs, template, parseError);
  }
}
