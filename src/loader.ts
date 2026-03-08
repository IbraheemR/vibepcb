import * as path from 'path';
import * as fs from 'fs';
import type { SchematicRoot, ComponentDef, TemplateDef } from './types';

export function readComponentDefs(
  schematic: SchematicRoot,
  schematicDir: string
): Record<string, ComponentDef> {
  const defs: Record<string, ComponentDef> = {};

  for (const imp of schematic?.schematic?.imports ?? []) {
    try {
      const absPath = path.resolve(schematicDir, imp.path);
      const parsed  = JSON.parse(fs.readFileSync(absPath, 'utf8'));
      defs[imp.as]  = parsed.component as ComponentDef;
    } catch {
      // Missing or malformed component file — skip silently.
      // The renderer will leave the component blank rather than crash.
    }
  }

  return defs;
}

export function readTemplate(
  schematic: SchematicRoot,
  schematicDir: string
): TemplateDef | null {
  const templatePath = schematic?.schematic?.template;
  if (!templatePath) return null;
  try {
    const absPath = path.resolve(schematicDir, templatePath);
    return JSON.parse(fs.readFileSync(absPath, 'utf8')) as TemplateDef;
  } catch {
    return null;
  }
}
