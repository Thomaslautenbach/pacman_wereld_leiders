import { DIRS } from './config.js';

/**
 * A* op het grid (4-buren, Manhattan-heuristiek).
 * Geeft een lijst cellen [[c, r], ...] terug van de eerste stap tot en met het doel,
 * of null als er geen pad is. `passable(c, r)` bepaalt of een cel begaanbaar is.
 */
export function astar(width, height, passable, start, goal) {
  const [sc, sr] = start;
  const [gc, gr] = goal;
  if (sc === gc && sr === gr) return [];
  if (!passable(gc, gr)) return null;

  const size = width * height;
  const g = new Float32Array(size).fill(Infinity);
  const f = new Float32Array(size).fill(Infinity);
  const came = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const idx = (c, r) => r * width + c;
  const h = (c, r) => Math.abs(c - gc) + Math.abs(r - gr);

  const startI = idx(sc, sr);
  const goalI = idx(gc, gr);
  g[startI] = 0;
  f[startI] = h(sc, sr);

  // Eenvoudige binaire heap op f-waarde.
  const heap = [startI];
  const push = (i) => {
    heap.push(i);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (f[heap[p]] <= f[heap[k]]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };

  while (heap.length) {
    const cur = pop();
    if (closed[cur]) continue;
    if (cur === goalI) break;
    closed[cur] = 1;
    const cc = cur % width;
    const cr = (cur / width) | 0;
    for (const [dc, dr] of DIRS) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= width || nr >= height) continue;
      if (!passable(nc, nr)) continue;
      const ni = idx(nc, nr);
      if (closed[ni]) continue;
      const ng = g[cur] + 1;
      if (ng < g[ni]) {
        g[ni] = ng;
        f[ni] = ng + h(nc, nr);
        came[ni] = cur;
        push(ni);
      }
    }
  }

  if (came[goalI] === -1) return null;
  const path = [];
  for (let i = goalI; i !== startI; i = came[i]) {
    path.push([i % width, (i / width) | 0]);
  }
  return path.reverse();
}
