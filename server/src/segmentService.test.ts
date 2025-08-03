/** @jest-environment node */
import axios from 'axios';

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: () => false
}));

describe('segmentService', () => {
  it('returns predictions from axios', async () => {
    process.env.ROBOFLOW_API_KEY = 'key';
    const data = { predictions: [{ id: 1 }] };
    (axios.post as jest.Mock).mockResolvedValue({ data });
    const { segmentHandler } = require('./segmentService');
    const req: any = { body: { imageBase64: 'data:abc' } };
    const json = jest.fn();
    const res: any = { status: jest.fn().mockReturnValue({ json }), json };
    await segmentHandler(req, res);
    expect(axios.post).toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(data);
  });

  it('validates request body', async () => {
    process.env.ROBOFLOW_API_KEY = 'key';
    const { segmentHandler } = require('./segmentService');
    const json = jest.fn();
    const res: any = { status: jest.fn().mockReturnValue({ json }) };
    await segmentHandler({ body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalled();
  });
});
