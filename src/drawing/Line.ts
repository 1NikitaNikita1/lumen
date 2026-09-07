export type Point = {
  x: number;
  y: number;
};

export type DrawnLine = {
  id: string;
  color: string;
  points: Point[];
};

let counter = 0;

/** Generates a unique-enough id for a new stroke without pulling in a uuid dependency. */
export function createLineId(): string {
  counter += 1;
  return `line-${Date.now()}-${counter}`;
}

export function createLine(color: string, start: Point): DrawnLine {
  return {
    id: createLineId(),
    color,
    points: [start],
  };
}
