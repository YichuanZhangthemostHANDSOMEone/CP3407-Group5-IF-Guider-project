import { legoColors } from '../legoColors';

describe('legoColors', () => {
  it('contains Red color definition', () => {
    const red = legoColors.find(c => c.name === 'Red');
    expect(red).toBeDefined();
    expect(red?.rgb).toEqual([231, 0, 0]);
  });
});
