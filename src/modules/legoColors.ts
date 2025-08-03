// src/modules/legoColors.ts
export interface LegoColor {
  name: string;
  rgb: [number, number, number];
}

// Basic LEGO color palette for classification
export const legoColors: LegoColor[] = [
  { name: 'Red',    rgb: [231, 0, 0] },
  { name: 'Blue',   rgb: [73, 205, 255] },
  { name: 'Green',  rgb: [0, 197, 103] },
  { name: 'Yellow', rgb: [245, 205, 0] },
  { name: 'White',  rgb: [236, 247, 255] },
  { name: 'Black',  rgb: [0, 0, 0] },
  { name: 'PlateColor',  rgb: [204, 198, 177] },
  { name: 'Orange',  rgb: [255, 131, 0] },
  { name: 'DarkBlue',   rgb: [0, 108, 246] },
  { name: 'Purple',   rgb: [157, 152, 247] },
];
