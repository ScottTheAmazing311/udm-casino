import { isWalkable } from "./floor-map";

interface GridNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: GridNode | null;
}

export function findPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Array<{ x: number; y: number }> {
  if (!isWalkable(endX, endY)) return [];

  const open: GridNode[] = [];
  const closed = new Set<string>();

  const start: GridNode = {
    x: startX,
    y: startY,
    g: 0,
    h: heuristic(startX, startY, endX, endY),
    f: 0,
    parent: null,
  };
  start.f = start.h;
  open.push(start);

  let iterations = 0;
  const maxIterations = 500;

  while (open.length > 0 && iterations < maxIterations) {
    iterations++;
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const key = `${current.x},${current.y}`;

    if (current.x === endX && current.y === endY) {
      return reconstructPath(current);
    }

    closed.add(key);

    // 4-directional movement
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nKey = `${nx},${ny}`;

      if (closed.has(nKey)) continue;
      if (!isWalkable(nx, ny)) continue;

      const g = current.g + 1;
      const h = heuristic(nx, ny, endX, endY);
      const existing = open.find((n) => n.x === nx && n.y === ny);

      if (!existing || g < existing.g) {
        const node: GridNode = { x: nx, y: ny, g, h, f: g + h, parent: current };
        if (!existing) open.push(node);
        else Object.assign(existing, node);
      }
    }
  }

  return [];
}

function heuristic(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function reconstructPath(node: GridNode): Array<{ x: number; y: number }> {
  const path: Array<{ x: number; y: number }> = [];
  let current: GridNode | null = node;
  while (current) {
    path.unshift({ x: current.x, y: current.y });
    current = current.parent;
  }
  return path;
}
