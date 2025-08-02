import { Camera } from '@modules/camera';
import { LegoSegmenter } from '@modules/segmentation';
import { LegoBoardAnalyzer, CellColorResult } from '@modules/legoBoardAnalyzer';
import { showLoadingIndicator } from '@modules/ui';
import { legoColors } from '@modules/legoColors';
import { colorToProtoComp } from '@modules/colorMap';

/**
 * VisionApp orchestrates camera capture, analysis and visualization.
 * It keeps the capture canvas and overlay canvas perfectly aligned with
 * the underlying video stream and draws analysis results.
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
   * Start the camera stream and sync all canvas/video element sizes.
   */
  async start(): Promise<void> {
    showLoadingIndicator(true);
    await this.camera.start();
    showLoadingIndicator(false);

    const w = this.video.videoWidth;
    const h = this.video.videoHeight;

    // Ensure canvases have identical resolution as the video stream.
    this.capture.width = w;
    this.capture.height = h;
    this.overlay.width = w;
    this.overlay.height = h;

    // Explicitly set style size to avoid CSS scaling discrepancies.
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
   * Capture current frame, run analyzer and draw overlay.
   */
  async analyze(): Promise<CellColorResult[]> {
    this.camera.capture(this.capture);
    const cells = await this.analyzer.analyze(this.capture);
    this.draw(cells);
    return cells;
  }

  /**
   * Run analysis and export a composite image (capture + overlay)
   * together with raw block data.
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
    console.log('导出的 image 长度：', image.length);
    console.log('识别到的 cells:', blocks);
    sessionStorage.setItem('legoResultBlocks', JSON.stringify(blocks));
    return { image, blocks };
  }

  /**
   * Draw highlight boxes for contiguous regions of the same color.
   */
  private draw(cells: CellColorResult[]): void {
    const ctx = this.overlay.getContext('2d')!;

    // Keep overlay canvas perfectly aligned with capture.
    this.overlay.width = this.capture.width;
    this.overlay.height = this.capture.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);

    // Map color name -> rgb string for stroke color.
    const colorMap = new Map<string, string>(
      legoColors.map(c => [c.name, `rgb(${c.rgb[0]}, ${c.rgb[1]}, ${c.rgb[2]})`])
    );

    const blocks = this.aggregateBlocks(cells);
    ctx.lineWidth = 2;
    ctx.font = '12px sans-serif';

    for (const block of blocks) {
      const color = block[0].color;
      const stroke = colorMap.get(color) || '#f00';
      ctx.strokeStyle = stroke;

      // Gather all corner points then build convex hull.
      const pts = block.flatMap(c => c.quad);
      if (pts.length < 2) continue;

      const hull = convexHull(pts);
      if (!hull.length) continue;

      ctx.beginPath();
      hull.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();

      // Determine label position (top-left of hull).
      const labelPt = hull.reduce(
        (acc, p) => ({ x: Math.min(acc.x, p.x), y: Math.min(acc.y, p.y) }),
        { x: Infinity, y: Infinity }
      );

      const comp =
        block[0].component ||
        colorToProtoComp[color]?.component ||
        color;

      ctx.fillStyle = stroke;
      ctx.fillText(comp, labelPt.x + 4, labelPt.y + 12);
    }
  }

  /**
   * Group cells into contiguous blocks of the same color.
   * Uses 4-directional adjacency on the grid.
   */
  private aggregateBlocks(cells: CellColorResult[]): CellColorResult[][] {
    const cellMap = new Map<string, CellColorResult>();
    for (const c of cells) {
      cellMap.set(`${c.row},${c.col}`, c);
    }

    const visited = new Set<string>();
    const blocks: CellColorResult[][] = [];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (const c of cells) {
      const key = `${c.row},${c.col}`;
      if (visited.has(key)) continue;

      const queue = [c];
      const group: CellColorResult[] = [];
      visited.add(key);

      while (queue.length) {
        const cur = queue.shift()!;
        group.push(cur);

        for (const [dr, dc] of dirs) {
          const nr = cur.row + dr;
          const nc = cur.col + dc;
          const nkey = `${nr},${nc}`;
          const neighbor = cellMap.get(nkey);
          if (neighbor && !visited.has(nkey) && neighbor.color === c.color) {
            visited.add(nkey);
            queue.push(neighbor);
          }
        }
      }

      blocks.push(group);
    }

    return blocks;
  }
}

/**
 * Monotone chain convex hull.
 */
function convexHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const pts = points.slice();
  if (pts.length <= 1) return pts;
  pts.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

  const cross = (o: any, a: any, b: any) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

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

