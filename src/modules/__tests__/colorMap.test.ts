import * as cm from '@modules/colorMap';

describe('colorMap module', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
    (cm as any).colorToProtoComp = {};
  });

  test('loadColorMap populates lookup table', async () => {
    const mockMap = { proto: { comp: 'Red' } };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockMap });
    await cm.loadColorMap();
    expect(cm.colorToProtoComp['Red']).toEqual({ protocol: 'proto', component: 'comp' });
  });

  test('loadColorMap handles failed fetch', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
    await cm.loadColorMap();
    expect(cm.colorToProtoComp['Red']).toBeUndefined();
  });
});

