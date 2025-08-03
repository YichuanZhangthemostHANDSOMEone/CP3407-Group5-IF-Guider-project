/**
 * @jest-environment node
 */

describe('segmentService module', () => {
  test('loads without crashing when API key present', () => {
    process.env.ROBOFLOW_API_KEY = 'test';
    expect(() => require('../src/segmentService')).not.toThrow();
  });
});

