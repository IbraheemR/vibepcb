"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchematicEditorProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const loader_1 = require("./loader");
const html_1 = require("./webview/html");
const renderer_1 = require("./render/renderer");
class SchematicEditorProvider {
    constructor() {
        this.panels = new Map();
    }
    async resolveCustomTextEditor(document, webviewPanel) {
        const key = document.uri.toString();
        this.panels.set(key, webviewPanel);
        webviewPanel.webview.options = { enableScripts: true };
        const render = () => {
            webviewPanel.webview.html = this.buildWebviewHtml(document);
        };
        const sub = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === key)
                render();
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
    async exportSvg(uri) {
        const doc = await vscode.workspace.openTextDocument(uri);
        const schematicDir = path.dirname(uri.fsPath);
        let schematic = null;
        try {
            schematic = JSON.parse(doc.getText());
        }
        catch { /* ignore */ }
        const componentDefs = schematic ? (0, loader_1.readComponentDefs)(schematic, schematicDir) : {};
        const template = schematic ? (0, loader_1.readTemplate)(schematic, schematicDir) : null;
        const result = (0, renderer_1.renderSchematic)({ schematic, componentDefs, template });
        return (0, renderer_1.buildSvgDocument)(result, template);
    }
    buildWebviewHtml(document) {
        const schematicDir = path.dirname(document.uri.fsPath);
        let schematic = null;
        let parseError = false;
        try {
            schematic = JSON.parse(document.getText());
        }
        catch {
            parseError = true;
        }
        const componentDefs = schematic ? (0, loader_1.readComponentDefs)(schematic, schematicDir) : {};
        const template = schematic ? (0, loader_1.readTemplate)(schematic, schematicDir) : null;
        const title = schematic?.schematic?.titleblock?.name ?? 'Schematic';
        return (0, html_1.buildHtml)(title, schematic, componentDefs, template, parseError);
    }
}
exports.SchematicEditorProvider = SchematicEditorProvider;
//# sourceMappingURL=provider.js.map