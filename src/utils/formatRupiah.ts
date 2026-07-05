export function formatRupiah(value: number): string {
  const rounded = Math.round(value);
  const isNegative = rounded < 0;
  const digits = Math.abs(rounded).toString();
  const withSeparators = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${isNegative ? '-' : ''}${withSeparators}`;
}
