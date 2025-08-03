// import { Camera } from '@modules/camera';
// import { LegoSegmenter } from '@modules/segmentation';
// import { LegoBoardAnalyzer, CellColorResult } from '@modules/legoBoardAnalyzer';
// import { showLoadingIndicator } from '@modules/ui';
// import { legoColors } from '@modules/legoColors';
//
// export class VisionApp {
//   private camera: Camera;
//   private segmenter: LegoSegmenter;
//   private analyzer: LegoBoardAnalyzer;
//
//   constructor(
//       private video: HTMLVideoElement,
//       private capture: HTMLCanvasElement,
//       private overlay: HTMLCanvasElement
//   ) {
//     this.camera = new Camera(video);
//     this.segmenter = new LegoSegmenter();
//     this.analyzer = new LegoBoardAnalyzer(this.segmenter);
//   }
//
//   async start() {
//     showLoadingIndicator(true);
//     await this.camera.start();
//     showLoadingIndicator(false);
//
//     // ⚠️ overlay 与 capture 必须和摄像头分辨率完全一致，
//     // 不能依赖 CSS 的缩放，否则像素坐标会错位。
//     const w = this.video.videoWidth;
//     const h = this.video.videoHeight;
//
//     // 同步三者的实际像素尺寸
//     this.capture.width = w;
//     this.capture.height = h;
//     this.overlay.width = w;
//     this.overlay.height = h;
//
//     // 为防止被 100% 等 CSS 拉伸，显式设置 inline style
//     [this.video, this.overlay, this.capture].forEach(el => {
//       el.style.width = `${w}px`;
//       el.style.height = `${h}px`;
//     });
//
//     // 容器本身也要固定为相同尺寸，并移除 padding 比例
//     const container = this.overlay.parentElement as HTMLElement | null;
//     if (container) {
//       container.style.width = `${w}px`;
//       container.style.height = `${h}px`;
//       container.style.padding = '0';
//     }
//   }
//
//   async analyze(): Promise<CellColorResult[]> {
//     this.camera.capture(this.capture);
//     const cells = await this.analyzer.analyze(this.capture);
//     this.draw(cells);
//     return cells;
//   }
//
//   async analyzeAndExport(): Promise<{ image: string; blocks: CellColorResult[] }> {
//     const blocks = await this.analyze();
//     const out = document.createElement('canvas');
//     out.width = this.capture.width;
//     out.height = this.capture.height;
//     const ctx = out.getContext('2d')!;
//     ctx.drawImage(this.capture, 0, 0);
//     ctx.drawImage(this.overlay, 0, 0);
//     const image = out.toDataURL('image/png');
//     console.log('导出的 image 长度：', image.length);
//     console.log('识别到的 cells:', blocks);
//     sessionStorage.setItem('legoResultBlocks', JSON.stringify(blocks));
//     return { image, blocks };
//   }
//
//   /**
//    * 完美对齐的 overlay 绘制方法
//    */
//   private draw(cells: CellColorResult[]) {
//     const ctx = this.overlay.getContext('2d')!;
//
//     // 1) overlay 的 canvas 尺寸和 capture 完全一致（非常重要！不要用 getBoundingClientRect）
//     this.overlay.width = this.capture.width;
//     this.overlay.height = this.capture.height;
//     ctx.setTransform(1, 0, 0, 1, 0, 0);
//     ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
//
//     // 2) 颜色映射
//     const colorMap = new Map<string, string>(
//         legoColors.map(c => [c.name, `rgb(${c.rgb[0]}, ${c.rgb[1]}, ${c.rgb[2]})`])
//     );
//
//     // 3) 按“每行每色”分组
//     const grouped = new Map<number, Map<string, CellColorResult[]>>();
//     for (const cell of cells) {
//       let byColor = grouped.get(cell.row);
//       if (!byColor) {
//         byColor = new Map<string, CellColorResult[]>();
//         grouped.set(cell.row, byColor);
//       }
//       const colorList = byColor.get(cell.color) || [];
//       colorList.push(cell);
//       byColor.set(cell.color, colorList);
//     }
//
//     // 4) 绘制每组凸包
//     ctx.lineWidth = 2;
//     ctx.font = '12px sans-serif';
//     ctx.fillStyle = '#fff';
//
//     for (const [row, colorGroups] of grouped) {
//       for (const [color, cellsInGroup] of colorGroups) {
//         const stroke = colorMap.get(color) || '#f00';
//         ctx.strokeStyle = stroke;
//         const pts = cellsInGroup.reduce((arr, c) => {
//           c.quad.forEach(({ x, y }) => {
//             arr.push({ x, y });
//           });
//           return arr;
//         }, [] as { x: number; y: number }[]);
//         if (pts.length < 3) continue;
//         const hull = convexHull(pts);
//         ctx.beginPath();
//         hull.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
//         ctx.closePath();
//         ctx.stroke();
//         // 标签
//         const { x, y } = hull[0];
//         ctx.fillText(`${color} (row ${row})`, x + 4, y + 4);
//       }
//     }
//   }
// }
//
// /**
//  * Monotone Chain 凸包算法
//  */
// function convexHull(
//     points: { x: number; y: number }[]
// ): { x: number; y: number }[] {
//   const pts = points.slice();
//   if (pts.length <= 3) return pts;
//   pts.sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
//
//   const cross = (o: any, a: any, b: any) => (a.x - o.x)*(b.y - o.y) - (a.y - o.y)*(b.x - o.x);
//   const lower: typeof pts = [];
//   for (const p of pts) {
//     while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) {
//       lower.pop();
//     }
//     lower.push(p);
//   }
//
//   const upper: typeof pts = [];
//   for (let i = pts.length-1; i >= 0; i--) {
//     const p = pts[i];
//     while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) {
//       upper.pop();
//     }
//     upper.push(p);
//   }
//
//   lower.pop(); upper.pop();
//   return lower.concat(upper);
// }
import { Camera } from '@modules/camera';
import { LegoSegmenter } from '@modules/segmentation';
import { LegoBoardAnalyzer, CellColorResult } from '@modules/legoBoardAnalyzer';
import { showLoadingIndicator } from '@modules/ui';
import { legoColors } from '@modules/legoColors';
import cv from '@techstark/opencv-js';

// 可选调试：你也可以直接复制 drawWarpedGrid 到此文件
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

  async start() {
    showLoadingIndicator(true);
    await this.camera.start();
    showLoadingIndicator(false);

    // overlay 与 capture 必须和摄像头分辨率完全一致
    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    this.capture.width = w;
    this.capture.height = h;
    this.overlay.width = w;
    this.overlay.height = h;

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

  async analyze(): Promise<CellColorResult[]> {
    this.camera.capture(this.capture);
    // ============ 调用 analyzer 分析 ============
    const cells = await this.analyzer.analyze(this.capture);

    // ====== 可选调试代码：画出 warp 后的标准网格 ======
    this.drawWarpedDebugGrid();

    // ============ 正常流程：画 overlay ============
    this.draw(cells);

    return cells;
  }

  /**
   * 调试用：显示 warp 后的标准网格
   */
  private async drawWarpedDebugGrid() {
    const dstWidth = this.analyzer.cols * this.analyzer.cellSize;
    const dstHeight = this.analyzer.rows * this.analyzer.cellSize;

    // 1. 创建 warp 结果 canvas
    const warpedCanvas = document.createElement('canvas');
    warpedCanvas.width = dstWidth;
    warpedCanvas.height = dstHeight;

    // 2. 用 opencv warp 并显示
    const src = cv.imread(this.capture);
    const predictions = await this.segmenter.segment(this.capture);
    if (!predictions || !predictions.length) {
      src.delete();
      return;
    }
    const ptsArr: number[] = [];
    for (const p of predictions[0].points) ptsArr.push(p.x, p.y);
    const poly = cv.matFromArray(predictions[0].points.length, 1, cv.CV_32SC2, ptsArr);
    const polyVec = new cv.MatVector();
    polyVec.push_back(poly);
    const mask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
    cv.fillPoly(mask, polyVec, new cv.Scalar(255));
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let boardContour: cv.Mat | null = null;
    let maxArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      if (area > maxArea) {
        maxArea = area;
        if (boardContour) boardContour.delete();
        boardContour = c;
      } else {
        c.delete();
      }
    }
    contours.delete();
    hierarchy.delete();
    mask.delete();
    poly.delete();
    polyVec.delete();

    if (!boardContour) {
      src.delete();
      return;
    }

    const peri = cv.arcLength(boardContour, true);
    const approx = new cv.Mat();
    const hull = new cv.Mat();
    cv.convexHull(boardContour, hull, true);
    cv.approxPolyDP(hull, approx, 0.02 * peri, true);
    hull.delete();
    boardContour.delete();
    if (approx.rows !== 4) {
      approx.delete();
      src.delete();
      return;
    }
    const pts: Array<{ x: number; y: number }> = [];
    const data = approx.data32S;
    for (let i = 0; i < 4; i++) pts.push({ x: data[i*2], y: data[i*2+1] });
    approx.delete();

    const dstQuad = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      dstWidth - 1, 0,
      dstWidth - 1, dstHeight - 1,
      0, dstHeight - 1,
    ]);
    const srcQuadMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
      pts[0].x, pts[0].y,
      pts[1].x, pts[1].y,
      pts[2].x, pts[2].y,
      pts[3].x, pts[3].y,
    ]);

    const M = cv.getPerspectiveTransform(srcQuadMat, dstQuad);
    const warped = new cv.Mat();
    cv.warpPerspective(src, warped, M, new cv.Size(dstWidth, dstHeight));
    srcQuadMat.delete();
    dstQuad.delete();
    src.delete();
    M.delete();

    // 3. 显示到 canvas
    cv.imshow(warpedCanvas, warped);
    warped.delete();

    // 4. 画网格
    drawWarpedGrid(warpedCanvas, this.analyzer.rows, this.analyzer.cols, this.analyzer.cellSize);

    // 5. 强制样式，确保浮在最上层能看到
    warpedCanvas.style.position = 'fixed';
    warpedCanvas.style.zIndex = '9999';
    warpedCanvas.style.left = '20px';
    warpedCanvas.style.top = '20px';
    warpedCanvas.style.border = '2px solid red';
    warpedCanvas.style.background = '#fff';
    warpedCanvas.style.display = 'block';

    document.body.appendChild(warpedCanvas);
  }

  /**
   * 原有 overlay 绘制
   */
  private draw(cells: CellColorResult[]) {
    const ctx = this.overlay.getContext('2d')!;
    this.overlay.width = this.capture.width;
    this.overlay.height = this.capture.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);

    const colorMap = new Map<string, string>(
        legoColors.map(c => [c.name, `rgb(${c.rgb[0]}, ${c.rgb[1]}, ${c.rgb[2]})`])
    );

    const grouped = new Map<number, Map<string, CellColorResult[]>>();
    for (const cell of cells) {
      let byColor = grouped.get(cell.row);
      if (!byColor) {
        byColor = new Map<string, CellColorResult[]>();
        grouped.set(cell.row, byColor);
      }
      const colorList = byColor.get(cell.color) || [];
      colorList.push(cell);
      byColor.set(cell.color, colorList);
    }

    ctx.lineWidth = 2;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#fff';

    for (const [row, colorGroups] of grouped) {
      for (const [color, cellsInGroup] of colorGroups) {
        const stroke = colorMap.get(color) || '#f00';
        ctx.strokeStyle = stroke;
        const pts = cellsInGroup.reduce((arr, c) => {
          c.quad.forEach(({ x, y }) => {
            arr.push({ x, y });
          });
          return arr;
        }, [] as { x: number; y: number }[]);
        if (pts.length < 3) continue;
        const hull = convexHull(pts);
        ctx.beginPath();
        hull.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.stroke();
        const { x, y } = hull[0];
        ctx.fillText(`${color} (row ${row})`, x + 4, y + 4);
      }
    }
  }
}

/**
 * 在 warp 后 canvas 上画标准网格
 */
function drawWarpedGrid(
    canvas: HTMLCanvasElement,
    rows: number,
    cols: number,
    cellSize: number
) {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,0,0,0.6)';
  ctx.lineWidth = 1;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * cellSize);
    ctx.lineTo(cols * cellSize, r * cellSize);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cellSize, 0);
    ctx.lineTo(c * cellSize, rows * cellSize);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Monotone Chain 凸包算法
 */
function convexHull(
    points: { x: number; y: number }[]
): { x: number; y: number }[] {
  const pts = points.slice();
  if (pts.length <= 3) return pts;
  pts.sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);

  const cross = (o: any, a: any, b: any) => (a.x - o.x)*(b.y - o.y) - (a.y - o.y)*(b.x - o.x);
  const lower: typeof pts = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: typeof pts = [];
  for (let i = pts.length-1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop(); upper.pop();
  return lower.concat(upper);
}
