import { Camera } from '@modules/camera';
import { showMessage } from '@modules/ui';

jest.mock('@modules/ui', () => ({ showMessage: jest.fn() }));

describe('camera module', () => {
  let video: HTMLVideoElement;

  beforeEach(() => {
    video = document.createElement('video');
    (navigator as any).mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue('stream'),
    };
    (video as any).play = jest.fn().mockResolvedValue(undefined);
  });

  test('start sets srcObject and plays video', async () => {
    const camera = new Camera(video);
    await camera.start();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(video.srcObject).toBe('stream' as any);
    expect(video.play).toHaveBeenCalled();
  });

  test('start shows message on error', async () => {
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(new Error('err'));
    const camera = new Camera(video);
    await expect(camera.start()).rejects.toThrow('err');
    expect(showMessage).toHaveBeenCalledWith('Camera permission denied');
  });

  test('capture copies frame to canvas', () => {
    Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });
    const canvas = document.createElement('canvas');
    const ctx = { drawImage: jest.fn() } as any;
    (canvas as any).getContext = jest.fn().mockReturnValue(ctx);
    const camera = new Camera(video);
    const returned = camera.capture(canvas);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
    expect(ctx.drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 480);
    expect(returned).toBe(ctx);
  });
});

