import { legoColors } from '@modules/legoColors';

describe('legoColors module', () => {
  test('contains predefined colors', () => {
    expect(legoColors.some(c => c.name === 'Red')).toBe(true);
    expect(legoColors.some(c => c.name === 'Blue')).toBe(true);
  });
});

