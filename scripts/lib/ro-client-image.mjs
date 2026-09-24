function assertRange(buffer, offset, length, label) {
  if (offset < 0 || length < 0 || offset + length > buffer.length)
    throw new Error(`${label} 超出檔案範圍`);
}

function palettePixel(palette, index) {
  const offset = index * 4;
  return [
    palette[offset],
    palette[offset + 1],
    palette[offset + 2],
    index ? 255 : 0,
  ];
}

export function decodeSpr(input) {
  const buffer = Buffer.from(input);
  assertRange(buffer, 0, 8, 'SPR 標頭');
  if (buffer.toString('ascii', 0, 2) !== 'SP') throw new Error('SPR 標頭不符');

  const version = buffer[2] / 10 + buffer[3];
  const indexedCount = buffer.readUInt16LE(4);
  const rgbaCount = version > 1.1 ? buffer.readUInt16LE(6) : 0;
  let offset = version > 1.1 ? 8 : 6;
  const indexedFrames = [];

  for (let frameIndex = 0; frameIndex < indexedCount; frameIndex += 1) {
    assertRange(buffer, offset, 4, `SPR 畫格 ${frameIndex}`);
    const width = buffer.readUInt16LE(offset);
    const height = buffer.readUInt16LE(offset + 2);
    offset += 4;
    const pixels = Buffer.alloc(width * height);

    if (version < 2.1) {
      assertRange(buffer, offset, pixels.length, `SPR 畫格 ${frameIndex} 像素`);
      buffer.copy(pixels, 0, offset, offset + pixels.length);
      offset += pixels.length;
    } else {
      assertRange(buffer, offset, 2, `SPR 畫格 ${frameIndex} RLE 長度`);
      const end = offset + 2 + buffer.readUInt16LE(offset);
      offset += 2;
      assertRange(buffer, offset, end - offset, `SPR 畫格 ${frameIndex} RLE`);
      let pixel = 0;
      while (offset < end && pixel < pixels.length) {
        const value = buffer[offset++];
        pixels[pixel++] = value;
        if (value === 0) {
          if (offset >= end)
            throw new Error(`SPR 畫格 ${frameIndex} RLE 不完整`);
          const count = buffer[offset++];
          if (count === 0) {
            if (pixel < pixels.length) pixels[pixel++] = 0;
          } else {
            const repeated = Math.min(count - 1, pixels.length - pixel);
            pixels.fill(0, pixel, pixel + repeated);
            pixel += repeated;
          }
        }
      }
      if (pixel !== pixels.length)
        throw new Error(`SPR 畫格 ${frameIndex} 解碼像素數不符`);
    }
    indexedFrames.push({ width, height, pixels });
  }

  const rgbaFrames = [];
  for (let frameIndex = 0; frameIndex < rgbaCount; frameIndex += 1) {
    assertRange(buffer, offset, 4, `SPR RGBA 畫格 ${frameIndex}`);
    const width = buffer.readInt16LE(offset);
    const height = buffer.readInt16LE(offset + 2);
    offset += 4;
    const length = width * height * 4;
    assertRange(buffer, offset, length, `SPR RGBA 畫格 ${frameIndex} 像素`);
    rgbaFrames.push({
      width,
      height,
      pixels: buffer.subarray(offset, offset + length),
    });
    offset += length;
  }

  if (buffer.length < 1024) throw new Error('SPR 缺少 256 色盤');
  const palette = buffer.subarray(buffer.length - 1024);
  const frames = indexedFrames.map(({ width, height, pixels }) => {
    const rgba = Buffer.alloc(width * height * 4);
    for (let pixel = 0; pixel < pixels.length; pixel += 1)
      rgba.set(palettePixel(palette, pixels[pixel]), pixel * 4);
    return { width, height, rgba };
  });

  for (const { width, height, pixels } of rgbaFrames) {
    const rgba = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const source = (y * width + x) * 4;
        const target = ((height - y - 1) * width + x) * 4;
        rgba[target] = pixels[source + 3];
        rgba[target + 1] = pixels[source + 2];
        rgba[target + 2] = pixels[source + 1];
        rgba[target + 3] = pixels[source];
      }
    }
    frames.push({ width, height, rgba });
  }
  return { version, indexedCount, frames };
}

export function decodeAct(input) {
  const buffer = Buffer.from(input);
  assertRange(buffer, 0, 16, 'ACT 標頭');
  if (buffer.toString('ascii', 0, 2) !== 'AC') throw new Error('ACT 標頭不符');

  const version = buffer[3] + buffer[2] / 10;
  const actionCount = buffer.readUInt16LE(4);
  let offset = 16;
  const actions = [];

  const int32 = (label) => {
    assertRange(buffer, offset, 4, label);
    const value = buffer.readInt32LE(offset);
    offset += 4;
    return value;
  };
  const float32 = (label) => {
    assertRange(buffer, offset, 4, label);
    const value = buffer.readFloatLE(offset);
    offset += 4;
    return value;
  };

  for (let actionIndex = 0; actionIndex < actionCount; actionIndex += 1) {
    const frameCount = int32(`ACT 動作 ${actionIndex}`);
    const frames = [];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      assertRange(buffer, offset, 32, `ACT 動作 ${actionIndex} 畫格 ${frameIndex}`);
      offset += 32;
      const layerCount = int32(`ACT 動作 ${actionIndex} 圖層數`);
      const layers = [];
      for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
        const offsetX = version >= 2.6 ? Math.floor(float32('ACT X')) : int32('ACT X');
        const offsetY = version >= 2.6 ? Math.floor(float32('ACT Y')) : int32('ACT Y');
        const spriteIndex = int32('ACT 圖像索引');
        const mirror = int32('ACT 鏡像') !== 0;
        let color = [255, 255, 255, 255];
        let scaleX = 1;
        let scaleY = 1;
        let rotation = 0;
        let spriteType = 0;
        if (version >= 2) {
          assertRange(buffer, offset, 4, 'ACT 色彩');
          color = [...buffer.subarray(offset, offset + 4)];
          offset += 4;
          scaleX = float32('ACT X 縮放');
          scaleY = version >= 2.4 ? float32('ACT Y 縮放') : scaleX;
          rotation = int32('ACT 旋轉');
          spriteType = int32('ACT 圖像類型');
          if (version >= 2.5) offset += 8;
        }
        layers.push({
          offsetX,
          offsetY,
          spriteIndex,
          mirror,
          color,
          scaleX,
          scaleY,
          rotation,
          spriteType,
        });
      }
      if (version >= 2) offset += 4;
      const anchors = [];
      if (version >= 2.3) {
        const anchorCount = int32('ACT 錨點數');
        for (let anchorIndex = 0; anchorIndex < anchorCount; anchorIndex += 1) {
          assertRange(buffer, offset, 16, 'ACT 錨點');
          offset += 4;
          anchors.push({
            offsetX: int32('ACT 錨點 X'),
            offsetY: int32('ACT 錨點 Y'),
            other: int32('ACT 錨點資料'),
          });
        }
      }
      frames.push({ layers, anchors });
    }
    actions.push({ frames, delay: 100 });
  }

  if (version >= 2.1) {
    const soundCount = int32('ACT 音效數');
    assertRange(buffer, offset, soundCount * 40, 'ACT 音效');
    offset += soundCount * 40;
    if (version >= 2.2) {
      for (const action of actions) {
        action.delay = Math.max(25, Math.round(float32('ACT 動畫速度') * 25));
      }
    }
  }
  return { version, actions };
}

function tgaColor(bytes, depth, grayscale = false) {
  if (grayscale) {
    const alpha = depth === 16 ? bytes[1] : 255;
    return [bytes[0], bytes[0], bytes[0], alpha];
  }
  if (depth === 15 || depth === 16) {
    const value = bytes[0] | (bytes[1] << 8);
    return [
      Math.round(((value >> 10) & 31) * (255 / 31)),
      Math.round(((value >> 5) & 31) * (255 / 31)),
      Math.round((value & 31) * (255 / 31)),
      depth === 16 && !(value & 0x8000) ? 0 : 255,
    ];
  }
  return [bytes[2], bytes[1], bytes[0], depth === 32 ? bytes[3] : 255];
}

export function decodeTga(input) {
  const buffer = Buffer.from(input);
  assertRange(buffer, 0, 18, 'TGA 標頭');
  const idLength = buffer[0];
  const colorMapType = buffer[1];
  const imageType = buffer[2];
  const colorMapFirst = buffer.readUInt16LE(3);
  const colorMapLength = buffer.readUInt16LE(5);
  const colorMapDepth = buffer[7];
  const width = buffer.readUInt16LE(12);
  const height = buffer.readUInt16LE(14);
  const pixelDepth = buffer[16];
  const descriptor = buffer[17];
  const rle = [9, 10, 11].includes(imageType);
  const baseType = rle ? imageType - 8 : imageType;
  if (![1, 2, 3].includes(baseType))
    throw new Error(`不支援的 TGA 類型 ${imageType}`);
  if (!width || !height) throw new Error('TGA 尺寸無效');

  let offset = 18 + idLength;
  const colorMap = [];
  if (colorMapType) {
    const bytesPerColor = Math.ceil(colorMapDepth / 8);
    for (let index = 0; index < colorMapLength; index += 1) {
      assertRange(buffer, offset, bytesPerColor, 'TGA 色盤');
      colorMap[colorMapFirst + index] = tgaColor(
        buffer.subarray(offset, offset + bytesPerColor),
        colorMapDepth,
      );
      offset += bytesPerColor;
    }
  }

  const bytesPerPixel = Math.ceil(pixelDepth / 8);
  const readPixel = () => {
    assertRange(buffer, offset, bytesPerPixel, 'TGA 像素');
    const bytes = buffer.subarray(offset, offset + bytesPerPixel);
    offset += bytesPerPixel;
    if (baseType === 1) {
      const index = bytesPerPixel === 1 ? bytes[0] : bytes.readUInt16LE(0);
      if (!colorMap[index]) throw new Error(`TGA 色盤索引 ${index} 不存在`);
      return colorMap[index];
    }
    return tgaColor(bytes, pixelDepth, baseType === 3);
  };

  const sourcePixels = [];
  while (sourcePixels.length < width * height) {
    let count = 1;
    let repeated = false;
    if (rle) {
      assertRange(buffer, offset, 1, 'TGA RLE 封包');
      const header = buffer[offset++];
      repeated = Boolean(header & 0x80);
      count = (header & 0x7f) + 1;
    }
    if (repeated) {
      const pixel = readPixel();
      for (let index = 0; index < count; index += 1) sourcePixels.push(pixel);
    } else {
      for (let index = 0; index < count; index += 1)
        sourcePixels.push(readPixel());
    }
  }

  const topOrigin = Boolean(descriptor & 0x20);
  const rightOrigin = Boolean(descriptor & 0x10);
  const rgba = Buffer.alloc(width * height * 4);
  for (let sourceY = 0; sourceY < height; sourceY += 1) {
    for (let sourceX = 0; sourceX < width; sourceX += 1) {
      const targetX = rightOrigin ? width - sourceX - 1 : sourceX;
      const targetY = topOrigin ? sourceY : height - sourceY - 1;
      rgba.set(
        sourcePixels[sourceY * width + sourceX],
        (targetY * width + targetX) * 4,
      );
    }
  }
  return { width, height, rgba };
}
