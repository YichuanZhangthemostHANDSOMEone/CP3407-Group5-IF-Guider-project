// src/modules/legoBoardAnalyzer.ts

import cv from '@techstark/opencv-js';
import Color from 'colorjs.io';
import { LegoSegmenter } from '@modules/segmentation';
import { legoColors, LegoColor } from '@modules/legoColors';

/** Result of color detection for a single grid cell */
export interface CellColorResult {
  /** Row index in the grid */
  row: number;
  /** Column index in the grid */
  col: number;
  /** Detected LEGO color name */
  color: string;
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
   * each grid cell. The original canvas will be annotated with
   * cell outlines and color labels.
   */
  async analyze(canvas: HTMLCanvasElement): Promise<CellColorResult[]> {
    // Convert canvas to RGB Mat once.
    const src = cv.imread(canvas);
    const rgb = new cv.Mat();
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    src.delete();

    // 1) Board segmentation using remote segmenter service
    const predictions = await this.segmenter.segment(canvas);
    if (!predictions || !predictions.length) {
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
    poly.delete();
    polyVec.delete();

    // 2) Find largest contour and approximate to 4 points
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
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
    const approx = new cv.Mat();
    cv.approxPolyDP(boardContour, approx, 0.02 * peri, true);
    boardContour.delete();
    if (approx.rows !== 4) {
      approx.delete();
      rgb.delete();
      mask.delete();
      return [];
    }

    const srcQuad = this.extractQuad(approx);
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

    // pre-compute inverse transform for later mapping
    const MInv = cv.getPerspectiveTransform(dstQuad, srcQuadMat);

    srcQuadMat.delete();
    dstQuad.delete();
    rgb.delete();
    mask.delete();

    // 4) Iterate each grid cell and detect dominant color
    const results: CellColorResult[] = [];
    const cellW = warped.cols / this.cols;
    const cellH = warped.rows / this.rows;
    const inset = 2; // pixels to inset ROI

    const lab = new cv.Mat();
    cv.cvtColor(warped, lab, cv.COLOR_RGB2Lab);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = Math.round(c * cellW + inset);
        const y = Math.round(r * cellH + inset);
        const w = Math.round(cellW - inset * 2);
        const h = Math.round(cellH - inset * 2);
        const roiRect = new cv.Rect(x, y, w, h);
        const roi = lab.roi(roiRect);
        const blurred = new cv.Mat();
        cv.GaussianBlur(roi, blurred, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
        const mean = cv.mean(blurred);
        roi.delete();
        blurred.delete();

        const colorName = this.matchColor([mean[0], mean[1], mean[2]]);

        const quad = this.mapCellQuad(x, y, w, h, MInv);
        results.push({ row: r, col: c, color: colorName, quad });
      }
    }

    lab.delete();
    warped.delete();
    M.delete();
    MInv.delete();

    // 5) Draw results back onto original canvas
    this.drawResults(canvas, results);

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
    const [p1, p2, p3, p4] = pts;
    const top = [p1, p2].sort((a, b) => a.x - b.x);
    const bottom = [p3, p4].sort((a, b) => a.x - b.x);
    return [top[0], top[1], bottom[1], bottom[0]];
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

  /** Draw polygons and color labels on the canvas */
  private drawResults(canvas: HTMLCanvasElement, cells: CellColorResult[]): void {
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth = 1;
    ctx.font = '10px sans-serif';
    ctx.textBaseline = 'top';

    cells.forEach(cell => {
      ctx.beginPath();
      ctx.moveTo(cell.quad[0].x, cell.quad[0].y);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(cell.quad[i].x, cell.quad[i].y);
      }
      ctx.closePath();
      ctx.strokeStyle = '#ff0000';
      ctx.stroke();

      // Draw color label at first corner
      ctx.fillStyle = '#ff0000';
      ctx.fillText(cell.color, cell.quad[0].x, cell.quad[0].y);
    });
  }

  /**
   * Match a Lab color (OpenCV range 0-255) to the closest LEGO color.
   */
  private matchColor(lab: [number, number, number]): string {
    const scaled: [number, number, number] = [
      lab[0] * 100 / 255,
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
    return best ? best.name : 'Unknown';
  }
}
