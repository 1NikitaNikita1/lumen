import type { DrawnLine } from "./Line";

export type Crossing = {
  lineId: string;
  color: string;
  y: number;
};

/**
 * A drawn line is a polyline. The scanner only ever needs to know: did the
 * thin vertical strip the playhead swept through *this frame* touch any
 * segment of this line, and if so, at what height?
 *
 * We check the segment's x-extent against the frame's [lo, hi] sweep
 * interval rather than against a single x value, so fast scanner speeds or
 * slow frame rates can't let a segment slip through untouched.
 */
function segmentCrossing(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lo: number,
  hi: number
): number | null {
  const segMinX = Math.min(x1, x2);
  const segMaxX = Math.max(x1, x2);

  // Do the segment's x-range and this frame's sweep range overlap at all?
  if (segMaxX < lo || segMinX > hi) return null;

  if (x1 === x2) {
    // Vertical-ish segment: any y along it counts, use the midpoint.
    return (y1 + y2) / 2;
  }

  // Pick the point of overlap closest to the leading edge of the sweep.
  const targetX = Math.min(Math.max(hi, segMinX), segMaxX);
  const t = (targetX - x1) / (x2 - x1);
  return y1 + t * (y2 - y1);
}

function scanRange(
  lines: DrawnLine[],
  lo: number,
  hi: number
): Crossing[] {
  const hits: Crossing[] = [];

  for (const line of lines) {
    const pts = line.points;
    if (pts.length < 2) continue;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const y = segmentCrossing(p1.x, p1.y, p2.x, p2.y, lo, hi);
      if (y !== null) {
        hits.push({ lineId: line.id, color: line.color, y });
        // One trigger per line per frame is enough even if several
        // segments of the same stroke overlap the sweep.
        break;
      }
    }
  }

  return hits;
}

/**
 * Finds every drawn line crossed as the scanner moved from prevX to currX
 * during this animation frame, handling the left-edge wraparound.
 */
export function findCrossings(
  lines: DrawnLine[],
  prevX: number,
  currX: number,
  width: number
): Crossing[] {
  if (prevX === currX) return [];

  if (prevX < currX) {
    return scanRange(lines, prevX, currX);
  }

  // Scanner wrapped around from the right edge back to the left edge.
  return [...scanRange(lines, prevX, width), ...scanRange(lines, 0, currX)];
}
