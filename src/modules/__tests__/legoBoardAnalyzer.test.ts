import { LegoBoardAnalyzer } from '../legoBoardAnalyzer';
import Color from 'colorjs.io';

jest.mock('@techstark/opencv-js', () => ({}));

describe('LegoBoardAnalyzer', () => {
  it('matches color using deltaE', () => {
    const analyzer = new LegoBoardAnalyzer({ segment: jest.fn() } as any);
    const redRGB: [number, number, number] = [231, 0, 0];
    const color = new Color('srgb', redRGB.map(v => v / 255) as any);
    const lab = color.to('lab').coords as [number, number, number];
    const openCvLab: [number, number, number] = [lab[0] * 255 / 100, lab[1] + 128, lab[2] + 128];
    const res = (analyzer as any).matchColorWithDE(openCvLab);
    expect(res.name).toBe('Red');
    expect(res.deltaE).toBeCloseTo(0);
  });
});
