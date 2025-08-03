import { loadColorMap, colorToProtoComp } from '../colorMap';

describe('colorMap', () => {
  it('loads mapping from JSON', async () => {
    const mockMap = { protoA: { comp1: 'Red' } };
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMap,
    }) as any;

    await loadColorMap();
    expect(colorToProtoComp['Red']).toEqual({ protocol: 'protoA', component: 'comp1' });

    global.fetch = originalFetch;
  });
});
