import sharp from 'sharp';

// Finds the white bold level numbers Gravity drew on field cells of the
// original World Map. Each number is assigned to the smallest World Map region
// rectangle containing its centre.
export async function detectWhiteLevelLabels(imagePath, regions) {
  const { data, info } = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const white = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const o = i * C;
    if (data[o] > 225 && data[o + 1] > 225 && data[o + 2] > 225) white[i] = 1;
  }
  const seen = new Uint8Array(W * H), digits = [];
  for (let i = 0; i < W * H; i++) {
    if (!white[i] || seen[i]) continue;
    const stack = [i]; seen[i] = 1;
    let x1 = W, y1 = H, x2 = 0, y2 = 0, n = 0;
    while (stack.length) {
      const j = stack.pop(), x = j % W, y = (j - x) / W; n++;
      if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
      for (const k of [j - 1, j + 1, j - W, j + W]) {
        if (k < 0 || k >= W * H || (Math.abs((k % W) - x) > 1)) continue;
        if (white[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
      }
    }
    const h = y2 - y1 + 1, w = x2 - x1 + 1;
    // Level digits are 14-24 px bold glyphs; monster-name glyphs are smaller.
    if (h >= 14 && h <= 24 && w >= 4 && w <= 18 && n >= 25) digits.push({ x1, y1, x2, y2 });
  }
  digits.sort((a, b) => a.x1 - b.x1);
  const numbers = [];
  for (const d of digits) {
    const cy = (d.y1 + d.y2) / 2;
    const group = numbers.find((g) => Math.abs((g.y1 + g.y2) / 2 - cy) <= 5 &&
      d.x1 - g.x2 <= 10 && d.x1 >= g.x1);
    if (group) Object.assign(group, { x2: Math.max(group.x2, d.x2),
      y1: Math.min(group.y1, d.y1), y2: Math.max(group.y2, d.y2), digits: group.digits + 1 });
    else numbers.push({ ...d, digits: 1 });
  }
  const area = (p) => (p.x2 - p.x1) * (p.y2 - p.y1);
  return numbers.map((g) => {
    const cx = (g.x1 + g.x2) / 2, cy = (g.y1 + g.y2) / 2;
    const region = regions.filter((r) => cx >= r.position.x1 && cx < r.position.x2 &&
      cy >= r.position.y1 && cy < r.position.y2)
      .sort((a, b) => area(a.position) - area(b.position))[0] ?? null;
    return { box: [g.x1, g.y1, g.x2, g.y2], digits: g.digits, regionId: region?.regionId ?? null };
  });
}
