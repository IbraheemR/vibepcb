export interface Pin {
  number: number;
  name: string;
  type: string;
  position: { dx: number; dy: number };  // offset from component centre in 100mil grid units
}

export type GraphicPrimitive =
  | { type: 'line';    x1: number; y1: number; x2: number; y2: number }
  | { type: 'rect';    x: number;  y: number;  width: number; height: number }
  | { type: 'polygon'; points: [number, number][] }
  | { type: 'arrow';   x1: number; y1: number; x2: number; y2: number };

export interface ComponentDef {
  name: string;
  description?: string;
  category: string;
  symbol: string;
  footprint?: string;
  pins: Pin[];
  graphics?: GraphicPrimitive[];
  properties: Record<string, unknown>;
}

export interface ComponentInstance {
  ref: string;
  extends: string;
  position?: { x: number; y: number };
  rotation?: 0 | 90 | 180 | 270;
  flipX?: boolean;
  flipY?: boolean;
  comment?: string;
  overrides?: {
    description?: string;
    footprint?: string;
    properties?: Record<string, unknown>;
  };
}

export interface Net {
  name: string;
  pins: string[];   // e.g. ["U1.1", "R1.2"]
  style?: 'gnd' | 'rail' | 'label';
}

export interface Titleblock {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  company?: string;
}

export interface SchematicRoot {
  schematic: {
    template?: string;
    titleblock: Titleblock;
    imports: Array<{ path: string; as: string }>;
    components: ComponentInstance[];
    nets: Net[];
  };
}

// ── Template ──────────────────────────────────────────────────────────────────

export interface TitleblockCell {
  id: string;
  label: string;
  source: string;    // e.g. "schematic.titleblock.name" | "auto.date"
  width_mm: number;
  font_size_mm?: number;
  font_weight?: 'normal' | 'bold';
}

export interface TitleblockRow {
  height_mm: number;
  cells: TitleblockCell[];
}

export interface TemplateDef {
  template: {
    name: string;
    description?: string;
    paper: {
      format: string;
      orientation: 'landscape' | 'portrait';
      width_mm: number;
      height_mm: number;
    };
    border: {
      margin_mm: number;
      line_weight_mm?: number;
    };
    titleblock: {
      position_mm: { x: number; y: number };
      width_mm: number;
      height_mm: number;
      line_weight_mm?: number;
      rows: TitleblockRow[];
    };
  };
}
