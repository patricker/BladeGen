export const hexToInt = (hex: string): number => {
  if (!hex) return 0;
  if (typeof hex !== 'string') return Number(hex) || 0;
  return parseInt(hex.replace('#', '0x'));
};
