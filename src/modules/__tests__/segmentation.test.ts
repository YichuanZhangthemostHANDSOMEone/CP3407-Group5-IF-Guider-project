import { LegoSegmenter } from '@modules/segmentation';

describe('segmentation module', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  test('segment posts image and returns predictions', async () => {
    const canvas = document.createElement('canvas');
    (canvas as any).toDataURL = jest.fn().mockReturnValue('data:image/jpeg;base64,AAA');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ predictions: [{ points: [] }] }),
    });
    const segmenter = new LegoSegmenter();
    const preds = await segmenter.segment(canvas);
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    expect(global.fetch).toHaveBeenCalledWith('/api/segment', expect.objectContaining({ method: 'POST' }));
    expect(preds).toEqual([{ points: [] }]);
  });

  test('segment handles error response', async () => {
    const canvas = document.createElement('canvas');
    (canvas as any).toDataURL = jest.fn().mockReturnValue('data:image/jpeg;base64,AAA');
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, statusText: 'err' });
    const segmenter = new LegoSegmenter();
    const result = await segmenter.segment(canvas);
    expect(result).toBeNull();
  });
});

