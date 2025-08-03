import { LegoBoardAnalyzer } from '@modules/legoBoardAnalyzer';
import { LegoSegmenter } from '@modules/segmentation';
import Color from 'colorjs.io';

describe('legoBoardAnalyzer module', () => {
  test('matchColorWithDE finds nearest color', () => {
    const analyzer = new LegoBoardAnalyzer({} as LegoSegmenter);
    const c = new Color('srgb', [231/255, 0, 0]);
    const lab = c.to('lab').coords;
    const openCvLab: [number, number, number] = [
      (lab[0] * 255) / 100,
      lab[1] + 128,
      lab[2] + 128,
    ];
    const result = (analyzer as any).matchColorWithDE(openCvLab);
    expect(result.name).toBe('Red');
    expect(result.deltaE).toBeLessThan(1);
  });

  test('drawWarpedGrid draws lines', () => {
    const canvas = document.createElement('canvas');
    const ctx = {
      save: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      restore: jest.fn(),
      lineWidth: 0,
      strokeStyle: '',
    } as any;
    (canvas as any).getContext = jest.fn().mockReturnValue(ctx);
    LegoBoardAnalyzer.drawWarpedGrid(canvas, 2, 2, 10);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  test('drawCellQuads draws points', () => {
    const canvas = document.createElement('canvas');
    const ctx = {
      save: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      restore: jest.fn(),
      fillStyle: '',
      strokeStyle: '',
    } as any;
    (canvas as any).getContext = jest.fn().mockReturnValue(ctx);
    LegoBoardAnalyzer.drawCellQuads(canvas, [{ quad: [{ x: 1, y: 2 }] }]);
    expect(ctx.arc).toHaveBeenCalledWith(1, 2, 2.5, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalled();
  });
});

