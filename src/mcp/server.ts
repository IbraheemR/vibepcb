import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import sharp from 'sharp';
import { readComponentDefs, readTemplate } from '../loader';
import { renderSchematic, buildSvgDocument } from '../render/renderer';
import type { SchematicRoot } from '../types';
import { buildPcbSvg } from '../pcbRender';
import type { PcbRoot } from '../pcbRender';

const server = new Server(
  { name: 'vibepcb', version: '0.0.1' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'vibepcb_export_schematic',
      description:
        'Exports a VibePCB schematic (.vibesch) as a PNG image. ' +
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
      description:
        'Exports a VibePCB PCB layout (.vibepcb) as a PNG image. ' +
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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  const args = request.params.arguments as Record<string, unknown> | undefined;
  const filePath = args?.filePath as string | undefined;

  if (!filePath) {
    throw new McpError(ErrorCode.InvalidParams, 'filePath is required');
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { content: [{ type: 'text', text: `File not found: ${absPath}` }] };
  }

  if (name === 'vibepcb_export_schematic') {
    return exportSchematic(absPath);
  } else if (name === 'vibepcb_export_pcb') {
    return exportPcb(absPath);
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function exportSchematic(absPath: string) {
  try {
    let schematic: SchematicRoot | null = null;
    try { schematic = JSON.parse(fs.readFileSync(absPath, 'utf8')) as SchematicRoot; } catch { /* ignore */ }

    const schematicDir = path.dirname(absPath);
    const componentDefs = schematic ? readComponentDefs(schematic, schematicDir) : {};
    const template      = schematic ? readTemplate(schematic, schematicDir) : null;

    const result     = renderSchematic({ schematic, componentDefs, template });
    const svgContent = buildSvgDocument(result, template);

    const pngBuffer = await sharp(Buffer.from(svgContent, 'utf8'), { density: 300 }).png().toBuffer();

    const outPath = path.join(os.tmpdir(), `schematic_${Date.now()}.png`);
    fs.writeFileSync(outPath, pngBuffer);

    return {
      content: [{ type: 'text', text: `Schematic exported as PNG: ${outPath}\nSource: ${absPath}` }],
    };
  } catch (err) {
    return { content: [{ type: 'text', text: `Export failed: ${String(err)}` }] };
  }
}

async function exportPcb(absPath: string) {
  try {
    let pcb: PcbRoot | null = null;
    try { pcb = JSON.parse(fs.readFileSync(absPath, 'utf8')) as PcbRoot; } catch { /* ignore */ }

    if (!pcb) {
      return { content: [{ type: 'text', text: `Failed to parse PCB file: ${absPath}` }] };
    }

    const pcbDir = path.dirname(absPath);
    const svgContent = buildPcbSvg(pcb, pcbDir);

    const pngBuffer = await sharp(Buffer.from(svgContent, 'utf8'), { density: 300 }).png().toBuffer();

    const outPath = path.join(os.tmpdir(), `pcb_${Date.now()}.png`);
    fs.writeFileSync(outPath, pngBuffer);

    return {
      content: [{ type: 'text', text: `PCB exported as PNG: ${outPath}\nSource: ${absPath}` }],
    };
  } catch (err) {
    return { content: [{ type: 'text', text: `Export failed: ${String(err)}` }] };
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
