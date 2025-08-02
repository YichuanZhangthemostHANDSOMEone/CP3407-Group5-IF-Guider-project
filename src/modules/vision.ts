import { Camera } from '@modules/camera';
import { LegoSegmenter } from '@modules/segmentation';
import { LegoBoardAnalyzer, CellColorResult } from '@modules/legoBoardAnalyzer';
import { legoColors } from '@modules/legoColors';
import { colorToProtoComp } from '@modules/colorMap';
import { showLoadingIndicator } from '@modules/ui';

/**
 * Connected block of cells with the same color.
 */
interface CellGroup {
  /** LEGO color name */
  color: string;
  /** Component name derived from the color */
  component: string;
  /** All cells belonging to this block */
  cells: CellColorResult[];
}

/**
 * Main entry of the LEGO vision front-end. It wires camera capture,
 * board analysis and visualization on an overlay canvas.
 */
export class VisionApp {
  private camera: Camera;
  private segmenter: LegoSegmenter;
  private analyzer: LegoBoardAnalyzer;

  constructor(
    private video: HTMLVideoElement,
    private capture: HTMLCanvasElement,
    private overlay: HTMLCanvasElement
  ) {
    this.camera = new Camera(video);
    this.segmenter = new LegoSegmenter();
    this.analyzer = new LegoBoardAnalyzer(this.segmenter);
  }

  /**
   * Start the camera and synchronise canvas sizes so that pixel
   * coordinates from analysis map perfectly to the overlay canvas.
   */
  async start(): Promise<void> {
    showLoadingIndicator(true);
    await this.camera.start();
    showLoadingIndicator(false);

    const w = this.video.videoWidth;
    const h = this.video.videoHeight;

    // Ensure all canvases share identical pixel dimensions
    this.capture.width = w;
    this.capture.height = h;
    this.overlay.width = w;
    this.overlay.height = h;

    // Also force the displayed size to avoid CSS scaling
    [this.video, this.overlay, this.capture].forEach(el => {
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    });

    const container = this.overlay.parentElement as HTMLElement | null;
    if (container) {
      container.style.width = `${w}px`;
      container.style.height = `${h}px`;
      container.style.padding = '0';
    }
  }

  /**
   * Capture the current frame from camera, run the analyzer and render
   * the result on overlay.
   */
  async analyze(): Promise<CellColorResult[]> {
    this.camera.capture(this.capture);
    const cells = await this.analyzer.analyze(this.capture);
    this.draw(cells);
    return cells;
  }

  /**
   * Perform analysis and produce a PNG image that merges the captured
   * frame with the overlay drawings together with the raw block data.
   */
  async analyzeAndExport(): Promise<{ image: string; blocks: CellColorResult[] }> {
    const blocks = await this.analyze();
    const out = document.createElement('canvas');
    out.width = this.capture.width;
    out.height = this.capture.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(this.capture, 0, 0);
    ctx.drawImage(this.overlay, 0, 0);
    const image = out.toDataURL('image/png');
    sessionStorage.setItem('legoResultBlocks', JSON.stringify(blocks));
    return { image, blocks };
  }

  /**
   * Draw bounding hulls for all connected blocks of same colored cells
   * and label each block with its component name.
   */
  private draw(cells: CellColorResult[]): void {
    const ctx = this.overlay.getContext('2d')!;

    // Keep overlay size in sync with capture
    this.overlay.width = this.capture.width;
    this.overlay.height = this.capture.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);

    // Map color name -> rgb string
    const colorMap = new Map<string, string>(
      legoColors.map(c => [c.name, `rgb(${c.rgb[0]}, ${c.rgb[1]}, ${c.rgb[2]})`])
    );

    const groups = this.groupCells(cells);

    ctx.lineWidth = 2;
    ctx.font = '12px sans-serif';

    for (const group of groups) {
      const stroke = colorMap.get(group.color) || '#ff00ff';
      ctx.strokeStyle = stroke;
      ctx.fillStyle = stroke;

      // Collect all corner points and compute convex hull
      const pts = group.cells.flatMap(c => c.quad);
      if (pts.length < 3) continue;
      const hull = convexHull(pts);

      ctx.beginPath();
      hull.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();

      // Label using top-left point of hull
      const { minX, minY } = hull.reduce(
        (acc, p) => ({
          minX: Math.min(acc.minX, p.x),
          minY: Math.min(acc.minY, p.y),
        }),
        { minX: Infinity, minY: Infinity }
      );
      ctx.fillText(group.component, minX + 4, minY - 4);
    }
  }

  /**
   * Group cells by 4-neighbour connectivity on the same color.
   */
  private groupCells(cells: CellColorResult[]): CellGroup[] {
    const grid = new Map<string, CellColorResult>();
    for (const cell of cells) {
      grid.set(`${cell.row},${cell.col}`, cell);
    }

    const visited = new Set<string>();
    const groups: CellGroup[] = [];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (const cell of cells) {
      const key = `${cell.row},${cell.col}`;
      if (visited.has(key)) continue;
      const color = cell.color;
      const component = cell.component || colorToProtoComp[color]?.component || color;
      const queue: CellColorResult[] = [cell];
      const block: CellColorResult[] = [];
      visited.add(key);

      while (queue.length) {
        const cur = queue.shift()!;
        block.push(cur);
        for (const [dr, dc] of dirs) {
          const nr = cur.row + dr;
          const nc = cur.col + dc;
          const k = `${nr},${nc}`;
          if (visited.has(k)) continue;
          const neigh = grid.get(k);
          if (neigh && neigh.color === color) {
            visited.add(k);
            queue.push(neigh);
          }
        }
      }

      groups.push({ color, component, cells: block });
    }

    return groups;
  }
}

/**
 * Compute the convex hull of a set of points using the Monotone Chain
 * algorithm. The hull is returned in counter-clockwise order.
 */
function convexHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const pts = points.slice();
  if (pts.length <= 3) return pts;
  pts.sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));

  const cross = (o: any, a: any, b: any) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof pts = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: typeof pts = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}
