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
exports.readComponentDefs = readComponentDefs;
exports.readTemplate = readTemplate;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function readComponentDefs(schematic, schematicDir) {
    const defs = {};
    for (const imp of schematic?.schematic?.imports ?? []) {
        try {
            const absPath = path.resolve(schematicDir, imp.path);
            const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
            defs[imp.as] = parsed.component;
        }
        catch {
            // Missing or malformed component file — skip silently.
            // The renderer will leave the component blank rather than crash.
        }
    }
    return defs;
}
function readTemplate(schematic, schematicDir) {
    const templatePath = schematic?.schematic?.template;
    if (!templatePath)
        return null;
    try {
        const absPath = path.resolve(schematicDir, templatePath);
        return JSON.parse(fs.readFileSync(absPath, 'utf8'));
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=loader.js.map