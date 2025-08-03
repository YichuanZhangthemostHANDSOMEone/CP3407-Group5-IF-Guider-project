import { VisionApp } from '../vision';
import { Camera } from '@modules/camera';
import { LegoSegmenter } from '@modules/segmentation';
import { LegoBoardAnalyzer } from '@modules/legoBoardAnalyzer';
import { loadColorMap } from '@modules/colorMap';

jest.mock('@modules/camera');
jest.mock('@modules/segmentation');
jest.mock('@modules/legoBoardAnalyzer');
jest.mock('@modules/colorMap', () => ({ loadColorMap: jest.fn() }));
jest.mock('@modules/ui', () => ({ showLoadingIndicator: jest.fn() }));
jest.mock('@techstark/opencv-js', () => ({}));

describe('VisionApp', () => {
  function setup() {
    const video = document.createElement('video');
    Object.defineProperty(video, 'videoWidth', { value: 100 });
    Object.defineProperty(video, 'videoHeight', { value: 200 });
    const capture = document.createElement('canvas');
    (capture as any).getContext = jest.fn().mockReturnValue({});
    const overlay = document.createElement('canvas');
    const ctx = {
      setTransform: jest.fn(),
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      measureText: jest.fn().mockReturnValue({ width: 10 }),
      fillText: jest.fn(),
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      fillStyle: '',
    } as any;
    (overlay as any).getContext = jest.fn().mockReturnValue(ctx);
    (overlay as any).getBoundingClientRect = () => ({width:100, height:200} as DOMRect);
    return { video, capture, overlay, ctx };
  }

  it('starts camera and loads color map', async () => {
    const { video, capture, overlay } = setup();
    const startMock = jest.fn();
    (Camera as any).mockImplementation(() => ({ start: startMock, capture: jest.fn() }));
    (LegoSegmenter as any).mockImplementation(() => ({}));
    (LegoBoardAnalyzer as any).mockImplementation(() => ({ analyze: jest.fn() }));
    (loadColorMap as jest.Mock).mockResolvedValue(undefined);

    const app = new VisionApp(video, capture, overlay);
    await app.start();
    expect(startMock).toHaveBeenCalled();
    expect(loadColorMap).toHaveBeenCalled();
    expect(capture.width).toBe(100);
    expect(capture.height).toBe(200);
  });

  it('captures and analyzes', async () => {
    const { video, capture, overlay } = setup();
    const captureMock = jest.fn();
    const analyzeMock = jest.fn().mockResolvedValue([]);
    (Camera as any).mockImplementation(() => ({ start: jest.fn(), capture: captureMock }));
    (LegoSegmenter as any).mockImplementation(() => ({}));
    (LegoBoardAnalyzer as any).mockImplementation(() => ({ analyze: analyzeMock }));
    (loadColorMap as jest.Mock).mockResolvedValue(undefined);

    const app = new VisionApp(video, capture, overlay);
    await app.start();
    await app.analyze();
    expect(captureMock).toHaveBeenCalledWith(capture);
    expect(analyzeMock).toHaveBeenCalled();
  });
});
