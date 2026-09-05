export function exchangeMaps(stock: number[], fromTier: number) {
  if (fromTier < 1 || fromTier >= stock.length - 1 || stock[fromTier] < 3) return stock;
  const next = [...stock];
  next[fromTier] -= 3;
  next[fromTier + 1] += 1;
  return next;
}
