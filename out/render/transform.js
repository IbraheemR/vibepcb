"use strict";
/**
 * Shared rotation/flip math used by both the renderer and the wire router.
 *
 * Coordinate convention: +x right, +y down (SVG screen space).
 * rotate(90)  = 90° clockwise on screen  → (dx,dy) → (-dy, dx)
 * rotate(180)                             → (dx,dy) → (-dx,-dy)
 * rotate(270) = 90° counter-clockwise     → (dx,dy) → ( dy,-dx)
 * flipX mirrors across the Y axis (negates x before rotating).
 * flipY mirrors across the X axis (negates y before rotating).
 *
 * The flip is applied first, then the rotation — matching the SVG transform
 *   translate(cx,cy) rotate(r) scale(fx,fy) translate(-cx,-cy)
 * which is evaluated right-to-left: scale → rotate → translate.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyTransform = applyTransform;
exports.buildSvgTransform = buildSvgTransform;
/** Apply rotation + flip to a local (dx,dy) offset. */
function applyTransform(dx, dy, rotation = 0, flipX = false, flipY = false) {
    // Flip first (scale), then rotate
    const x = flipX ? -dx : dx;
    const y = flipY ? -dy : dy;
    switch (rotation) {
        case 90: return { dx: -y, dy: x };
        case 180: return { dx: -x, dy: -y };
        case 270: return { dx: y, dy: -x };
        default: return { dx: x, dy: y };
    }
}
/** Build an SVG transform attribute string that rotates/flips around (cx, cy). */
function buildSvgTransform(cx, cy, rotation, flipX, flipY) {
    const parts = [`translate(${cx},${cy})`];
    if (rotation !== 0)
        parts.push(`rotate(${rotation})`);
    if (flipX || flipY)
        parts.push(`scale(${flipX ? -1 : 1},${flipY ? -1 : 1})`);
    parts.push(`translate(${-cx},${-cy})`);
    return parts.join(' ');
}
//# sourceMappingURL=transform.js.map