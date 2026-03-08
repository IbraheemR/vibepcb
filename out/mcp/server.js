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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const sharp_1 = __importDefault(require("sharp"));
const loader_1 = require("../loader");
const renderer_1 = require("../render/renderer");
const pcbRender_1 = require("../pcbRender");
const server = new index_js_1.Server({ name: 'vibepcb', version: '0.0.1' }, { capabilities: { tools: {} } });
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'vibepcb_export_schematic',
            description: 'Exports a VibePCB schematic (.vibesch) as a PNG image. ' +
                'Renders directly from disk — no editor window required. ' +
                'Returns the path to the exported PNG.',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Absolute path to the .vibesch file to export.',
                    },
                },
                required: ['filePath'],
            },
        },
        {
            name: 'vibepcb_export_pcb',
            description: 'Exports a VibePCB PCB layout (.vibepcb) as a PNG image. ' +
                'Renders directly from disk — no editor window required. ' +
                'Returns the path to the exported PNG.',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Absolute path to the .vibepcb file to export.',
                    },
                },
                required: ['filePath'],
            },
        },
    ],
}));
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = request.params.arguments;
    const filePath = args?.filePath;
    if (!filePath) {
        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, 'filePath is required');
    }
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
        return { content: [{ type: 'text', text: `File not found: ${absPath}` }] };
    }
    if (name === 'vibepcb_export_schematic') {
        return exportSchematic(absPath);
    }
    else if (name === 'vibepcb_export_pcb') {
        return exportPcb(absPath);
    }
    throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});
async function exportSchematic(absPath) {
    try {
        let schematic = null;
        try {
            schematic = JSON.parse(fs.readFileSync(absPath, 'utf8'));
        }
        catch { /* ignore */ }
        const schematicDir = path.dirname(absPath);
        const componentDefs = schematic ? (0, loader_1.readComponentDefs)(schematic, schematicDir) : {};
        const template = schematic ? (0, loader_1.readTemplate)(schematic, schematicDir) : null;
        const result = (0, renderer_1.renderSchematic)({ schematic, componentDefs, template });
        const svgContent = (0, renderer_1.buildSvgDocument)(result, template);
        const pngBuffer = await (0, sharp_1.default)(Buffer.from(svgContent, 'utf8'), { density: 300 }).png().toBuffer();
        const outPath = path.join(os.tmpdir(), `schematic_${Date.now()}.png`);
        fs.writeFileSync(outPath, pngBuffer);
        return {
            content: [{ type: 'text', text: `Schematic exported as PNG: ${outPath}\nSource: ${absPath}` }],
        };
    }
    catch (err) {
        return { content: [{ type: 'text', text: `Export failed: ${String(err)}` }] };
    }
}
async function exportPcb(absPath) {
    try {
        let pcb = null;
        try {
            pcb = JSON.parse(fs.readFileSync(absPath, 'utf8'));
        }
        catch { /* ignore */ }
        if (!pcb) {
            return { content: [{ type: 'text', text: `Failed to parse PCB file: ${absPath}` }] };
        }
        const pcbDir = path.dirname(absPath);
        const svgContent = (0, pcbRender_1.buildPcbSvg)(pcb, pcbDir);
        const pngBuffer = await (0, sharp_1.default)(Buffer.from(svgContent, 'utf8'), { density: 300 }).png().toBuffer();
        const outPath = path.join(os.tmpdir(), `pcb_${Date.now()}.png`);
        fs.writeFileSync(outPath, pngBuffer);
        return {
            content: [{ type: 'text', text: `PCB exported as PNG: ${outPath}\nSource: ${absPath}` }],
        };
    }
    catch (err) {
        return { content: [{ type: 'text', text: `Export failed: ${String(err)}` }] };
    }
}
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch(console.error);
//# sourceMappingURL=server.js.map