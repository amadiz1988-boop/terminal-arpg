import { describe, expect, it } from 'vitest';
// The asset importer is intentionally plain ESM so it can run directly on the
// Windows machine that owns the licensed RO client.
import { decodeSpr, decodeTga } from '../../scripts/lib/ro-client-image.mjs';

describe('RO client image decoders', () => {
  it('decodes a palette SPR frame and makes palette index zero transparent', () => {
    const palette = Buffer.alloc(1024);
    palette.set([240, 180, 24, 255], 4);
    const sprite = Buffer.concat([
      Buffer.from([0x53, 0x50, 0x00, 0x02, 0x01, 0x00, 0x00, 0x00]),
      Buffer.from([0x02, 0x00, 0x01, 0x00, 0x01, 0x00]),
      palette,
    ]);
    const decoded = decodeSpr(sprite);
    expect(decoded.frames).toHaveLength(1);
    expect(decoded.frames[0]).toMatchObject({ width: 2, height: 1 });
    expect([...decoded.frames[0].rgba]).toEqual([
      240, 180, 24, 255, 0, 0, 0, 0,
    ]);
  });

  it('decodes bottom-origin BGRA TGA pixels into top-origin RGBA', () => {
    const header = Buffer.alloc(18);
    header[2] = 2;
    header.writeUInt16LE(1, 12);
    header.writeUInt16LE(2, 14);
    header[16] = 32;
    header[17] = 8;
    const tga = Buffer.concat([
      header,
      Buffer.from([0, 0, 255, 255, 255, 0, 0, 128]),
    ]);
    const decoded = decodeTga(tga);
    expect(decoded).toMatchObject({ width: 1, height: 2 });
    expect([...decoded.rgba]).toEqual([0, 0, 255, 128, 255, 0, 0, 255]);
  });
});
