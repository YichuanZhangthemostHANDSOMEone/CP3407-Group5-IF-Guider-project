import { Camera } from '../camera';

describe('Camera', () => {
  it('captures video frame to canvas', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'videoWidth', { value: 320 });
    Object.defineProperty(video, 'videoHeight', { value: 240 });

    const canvas = document.createElement('canvas');
    const ctx = { drawImage: jest.fn() } as any;
    (canvas as any).getContext = jest.fn().mockReturnValue(ctx);

    const camera = new Camera(video);
    camera.capture(canvas);

    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(240);
    expect(ctx.drawImage).toHaveBeenCalledWith(video, 0, 0, 320, 240);
  });
});
