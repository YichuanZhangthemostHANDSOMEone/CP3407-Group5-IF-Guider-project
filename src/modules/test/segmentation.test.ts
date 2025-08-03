import { LegoSegmenter, Prediction } from '../segmentation';

describe('LegoSegmenter', () => {
  afterEach(() => {
    (global.fetch as any) = undefined;
  });

  it('posts image and returns predictions', async () => {
    const canvas = document.createElement('canvas');
    (canvas as any).toDataURL = () => 'data:image/jpeg;base64,aaaa';
    const prediction: Prediction = { mask: '', x: 0, y: 0, width: 1, height: 1, points: [] };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ predictions: [prediction] }),
    }) as any;
    const seg = new LegoSegmenter();
    const res = await seg.segment(canvas);
    expect(res).toEqual([prediction]);
    expect(fetch).toHaveBeenCalledWith('/api/segment', expect.any(Object));
  });

  it('returns null on error', async () => {
    const canvas = document.createElement('canvas');
    (canvas as any).toDataURL = () => 'data:image/jpeg;base64,aaaa';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'err' }) as any;
    const seg = new LegoSegmenter();
    const res = await seg.segment(canvas);
    expect(res).toBeNull();
  });
});
