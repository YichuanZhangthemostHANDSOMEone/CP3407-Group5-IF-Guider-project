// src/modules/legoBoardAnalyzer.ts

import cv from '@techstark/opencv-js';
import Color from 'colorjs.io';
import { LegoSegmenter } from '@modules/segmentation';
import { legoColors, LegoColor } from '@modules/legoColors';
import { colorToProtoComp } from '@modules/colorMap';

/** Result of color detection for a single grid cell */
export interface CellColorResult {
  /** Row index in the grid */
  row: number;
  /** Column index in the grid */
  col: number;
  /** Detected LEGO color name */
  color: string;
  /** Protocol this color represents */
  protocol: string;
  /** Component name within the protocol */
  component: string;
  /** Four corner points of the cell on the original image */
  quad: Array<{ x: number; y: number }>;
}

/**
 * Performs full pipeline from board segmentation, perspective
 * rectification, grid based color detection and mapping results
 * back to the original image.
 */
export class LegoBoardAnalyzer {
  /** number of rows in the fixed grid */
  readonly rows = 16;
  /** number of columns in the fixed grid */
  readonly cols = 32;
  /** pixel size for each cell after warp */
  readonly cellSize = 20;

  constructor(private segmenter: LegoSegmenter) {}

  /**
   * Analyze the provided canvas and return detected colors for
   * each grid cell. No drawing is performed.
   */
  async analyze(canvas: HTMLCanvasElement): Promise<CellColorResult[]> {
    console.log('[LBA] 🚀 analyze() start', {
      width: canvas.width,
      height: canvas.height,
    });
    // Convert canvas to RGB Mat once.
    const src = cv.imread(canvas);
    console.log('[LBA] cv.imread 完成', { rows: src.rows, cols: src.cols });
    const rgb = new cv.Mat();
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    src.delete();

    // 1) Board segmentation using remote segmenter service
    const predictions = await this.segmenter.segment(canvas);
    console.log('[LBA] segmenter.segment 返回 predictions:', predictions);
    if (!predictions || !predictions.length) {
      console.log('[LBA] 🎯 没有分割结果，直接返回 []');
      rgb.delete();
      return [];
    }

    // Create binary mask from polygon points
    const mask = cv.Mat.zeros(rgb.rows, rgb.cols, cv.CV_8UC1);
    const ptsArr: number[] = [];
    for (const p of predictions[0].points) {
      ptsArr.push(p.x, p.y);
    }
    const poly = cv.matFromArray(predictions[0].points.length, 1, cv.CV_32SC2, ptsArr);
    const polyVec = new cv.MatVector();
    polyVec.push_back(poly);
    cv.fillPoly(mask, polyVec, new cv.Scalar(255));
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(15, 15));
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 2);
    console.log('[LBA] mask 闭合后平滑完成');
    console.log('[LBA] mask 填充完成');
    poly.delete();
    polyVec.delete();

    // 2) Find largest contour and approximate to 4 points
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    console.log('[LBA] findContours 找到 contours 数量：', contours.size());
    hierarchy.delete();

    let boardContour: cv.Mat | null = null;
    let maxArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      if (area > maxArea) {
        maxArea = area;
        if (boardContour) boardContour.delete();
        boardContour = c; // take ownership
      } else {
        c.delete();
      }
    }
    contours.delete();

    if (!boardContour) {
      rgb.delete();
      mask.delete();
      return [];
    }

    const peri = cv.arcLength(boardContour, true);
    console.log('[LBA] 选中最大轮廓面积 =', maxArea);
    const approx = new cv.Mat();
    const hull = new cv.Mat();
    cv.convexHull(boardContour, hull, true);
    cv.approxPolyDP(hull, approx, 0.02 * peri, true);
    console.log('[LBA] hull+approxPolyDP 后顶点数：', approx.rows);
    hull.delete();
    boardContour.delete();
    if (approx.rows !== 4) {
      approx.delete();
      rgb.delete();
      mask.delete();
      return [];
    }

    const srcQuad = this.extractQuad(approx);
    console.log('[LBA] srcQuad =', srcQuad);
    approx.delete();

    // 3) Perspective transformation to fixed top view
    const dstWidth = this.cols * this.cellSize;
    const dstHeight = this.rows * this.cellSize;
    const dstQuad = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      dstWidth - 1, 0,
      dstWidth - 1, dstHeight - 1,
      0, dstHeight - 1,
    ]);
    const srcQuadMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
      srcQuad[0].x, srcQuad[0].y,
      srcQuad[1].x, srcQuad[1].y,
      srcQuad[2].x, srcQuad[2].y,
      srcQuad[3].x, srcQuad[3].y,
    ]);

    const M = cv.getPerspectiveTransform(srcQuadMat, dstQuad);
    const warped = new cv.Mat();
    cv.warpPerspective(rgb, warped, M, new cv.Size(dstWidth, dstHeight));
    const MInv = cv.getPerspectiveTransform(dstQuad, srcQuadMat);
    console.log('[LBA] warpPerspective 完成，warped 尺寸 =', warped.cols, warped.rows);

    srcQuadMat.delete();
    dstQuad.delete();
    rgb.delete();
    mask.delete();


    // 4) Iterate each grid cell and detect dominant color
    const results: CellColorResult[] = [];
    const cellW = warped.cols / this.cols;
    const cellH = warped.rows / this.rows;
    const inset = Math.max(1, Math.min(4, Math.floor(Math.min(cellW, cellH) * 0.15))); // pixels to inset ROI

    const lab = new cv.Mat();
    cv.cvtColor(warped, lab, cv.COLOR_RGB2Lab);

    console.log('[LBA] 开始遍历格子 rows × cols =', this.rows, '×', this.cols);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = Math.round(c * cellW + inset);
        const y = Math.round(r * cellH + inset);
        const w = Math.round(cellW - inset * 2);
        const h = Math.round(cellH - inset * 2);
        if (x < 0 || y < 0 || x + w >= warped.cols || y + h >= warped.rows || w <= 0 || h <= 0) {
          continue;
        }
        const roiRect = new cv.Rect(x, y, w, h);
        const roi = lab.roi(roiRect);
        console.log(`[LBA] 处理 cell [${r},${c}]，ROI 大小 =`, w, '×', h);

        // ---- Stage 1: Color difference filtering ----
        const blurred = new cv.Mat();
        cv.GaussianBlur(roi, blurred, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
        const mean = cv.mean(blurred);
        const { name, deltaE } = this.matchColorWithDE([
          mean[0],
          mean[1],
          mean[2],
        ]);
        // Adjust this threshold (15-25) depending on lighting conditions
        console.log(`[LBA]   color match =`, name, 'deltaE =', deltaE);
        if (deltaE > 20 || name === 'PlateColor') {
          roi.delete();
          blurred.delete();
          continue;
        }

        // ---- Stage 2: Texture/standard deviation filtering ----
        const meanMat = new cv.Mat();
        const stdMat = new cv.Mat();
        cv.meanStdDev(blurred, meanMat, stdMat);
        const std = stdMat.data64F;
        const sumStd = std[0] + std[1] + std[2];
        meanMat.delete();
        stdMat.delete();
        // Tune this threshold (3-10) based on ROI size/noise level
        console.log(`[LBA]   sumStd =`, sumStd);
        if (sumStd < 3) {
          roi.delete();
          blurred.delete();
          continue;
        }

        // ---- Stage 3: Edge detection filtering ----
        // const gray = new cv.Mat();
        // cv.cvtColor(roi, gray, cv.COLOR_RGB2GRAY);
        // const edges = new cv.Mat();
        // cv.Canny(gray, edges, 50, 150);
        // const edgeCount = cv.countNonZero(edges);
        // const minEdges = w * h * 0.01; // try 1%-5% to tune
        // gray.delete();
        // edges.delete();
        // blurred.delete();
        // roi.delete();
        // console.log(`[LBA]   edgeCount =`, edgeCount, 'minEdges =', minEdges);
        // if (edgeCount < minEdges) {
        //   continue;
        // }

        // Map valid cell back to original coordinates
        const quad = this.mapCellQuad(x, y, w, h, MInv);
        const mapped = colorToProtoComp[name] || { protocol: '', component: '' };
        results.push({
          row: r,
          col: c,
          color: name,
          protocol: mapped.protocol,
          component: mapped.component,
          quad,
        });
      }
    }
    console.log('[LBA] 检测结束，结果数量 =', results.length);

    lab.delete();
    warped.delete();
    M.delete();
    MInv.delete();

    return results;
  }
  /**
   * Convert approx contour to ordered quad [tl,tr,br,bl]
   */
  private extractQuad(poly: cv.Mat): Array<{ x: number; y: number }> {
    const pts: Array<{ x: number; y: number }> = [];
    const data = poly.data32S;
    for (let i = 0; i < 4; i++) {
      pts.push({ x: data[i * 2], y: data[i * 2 + 1] });
    }
    // order points: top-left, top-right, bottom-right, bottom-left
    pts.sort((a, b) => a.y - b.y);
    const sortedBySum = [...pts].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    const sortedByDiff = [...pts].sort((a, b) => (a.x - a.y) - (b.x - b.y));

    const tl = sortedBySum[0];     // 左上 (最小和)
    const br = sortedBySum[3];     // 右下 (最大和)
    const tr = sortedByDiff[3];    // 右上 (最大差)
    const bl = sortedByDiff[0];    // 左下 (最小差)

    return [tl, tr, br, bl];
  }

  /** Map a cell rectangle from warped image back to original coordinates */
  private mapCellQuad(x: number, y: number, w: number, h: number, MInv: cv.Mat)
      : Array<{ x: number; y: number }> {
    const pts = cv.matFromArray(4, 1, cv.CV_32FC2, [
      x, y,
      x + w, y,
      x + w, y + h,
      x, y + h,
    ]);
    const dst = new cv.Mat();
    cv.perspectiveTransform(pts, dst, MInv);
    const data = dst.data32F;
    const quad = [
      { x: data[0], y: data[1] },
      { x: data[2], y: data[3] },
      { x: data[4], y: data[5] },
      { x: data[6], y: data[7] },
    ];
    pts.delete();
    dst.delete();
    return quad;
  }

  /**
   * Match a Lab color (OpenCV range 0-255) to the closest LEGO color and
   * return the deltaE distance. This is used for filtering out background
   * or poorly detected bricks.
   */
  private matchColorWithDE(lab: [number, number, number]): { 
    name: string; deltaE: number;
  } {
    // Convert from OpenCV Lab (0-255) to standard Lab range.
    const scaled: [number, number, number] = [
      (lab[0] * 100) / 255,
      lab[1] - 128,
      lab[2] - 128,
    ];
    const sample = new Color('lab', scaled);
    let best: LegoColor | null = null;
    let minE = Infinity;
    for (const c of legoColors) {
      const norm: [number, number, number] = [
        c.rgb[0] / 255,
        c.rgb[1] / 255,
        c.rgb[2] / 255,
      ];
      const legoC = new Color('srgb', norm);
      const d = sample.deltaE(legoC, { method: '2000' });
      if (d < minE) {
        minE = d;
        best = c;
      }
    }
    return { name: best ? best.name : 'Unknown', deltaE: minE };
  }
  /** ===================== 以下为测试工具方法 ===================== */

  /**
   * 在 warp 后的 canvas 上画标准网格
   */
  static drawWarpedGrid(
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
   * 在 overlay 上画所有格子的四角点
   */
  static drawCellQuads(
      overlay: HTMLCanvasElement,
      cells: { quad: { x: number; y: number }[] }[]
  ) {
    const ctx = overlay.getContext('2d')!;
    ctx.save();
    ctx.fillStyle = 'lime';
    ctx.strokeStyle = 'lime';
    for (const cell of cells) {
      for (const pt of cell.quad) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
