jest.mock('@modules/camera', () => ({
  __esModule: true,
  Camera: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    capture: jest.fn(),
  })),
}));

jest.mock('@modules/segmentation', () => ({
  __esModule: true,
  LegoSegmenter: jest.fn(),
}));

jest.mock('@modules/legoBoardAnalyzer', () => ({
  __esModule: true,
  LegoBoardAnalyzer: jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@modules/colorMap', () => ({ __esModule: true, loadColorMap: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@modules/ui', () => ({ __esModule: true, showLoadingIndicator: jest.fn() }));

import { VisionApp } from '@modules/vision';

describe('vision module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('start initializes camera and loads color map', async () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });
    const capture = document.createElement('canvas');
    const overlay = document.createElement('canvas');
    const app = new VisionApp(video, capture, overlay);
    await app.start();
    const camInst = (app as any).camera;
    const { loadColorMap } = require('@modules/colorMap');
    expect(camInst.start).toHaveBeenCalled();
    expect(loadColorMap).toHaveBeenCalled();
    expect(capture.width).toBe(640);
    expect(capture.height).toBe(480);
  });

  test('analyze captures frame and returns cells', async () => {
    const video = document.createElement('video');
    const capture = document.createElement('canvas');
    const overlay = document.createElement('canvas');
    (overlay as any).getContext = jest.fn().mockReturnValue({
      setTransform: jest.fn(),
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      fillStyle: '',
      strokeStyle: '',
    });
    (overlay as any).getBoundingClientRect = () => ({ width: 100, height: 100, top: 0, left: 0, right: 0, bottom: 0 });
    const app = new VisionApp(video, capture, overlay);
    const camInst = (app as any).camera;
    const analyzerInst = (app as any).analyzer;
    analyzerInst.analyze.mockResolvedValue([{ row: 1, col: 1, color: 'Red', protocol: 'p', component: 'c', quad: [] }]);
    const cells = await app.analyze();
    expect(camInst.capture).toHaveBeenCalledWith(capture);
    expect(analyzerInst.analyze).toHaveBeenCalledWith(capture);
    expect(cells).toHaveLength(1);
  });
});

