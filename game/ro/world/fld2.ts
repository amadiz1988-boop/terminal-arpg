import { AUTOMATION_RULESET, type SourceTrace } from '../source';

export const FLD2_SOURCE: SourceTrace = Object.freeze({
  repository: AUTOMATION_RULESET.repository,
  commit: AUTOMATION_RULESET.commit,
  path: 'src/Field.pm',
  symbol: 'loadFile/getOffset/isWalkable',
});

export type RoField = Readonly<{
  width: number;
  height: number;
  cells: Uint8Array;
}>;

export function parseFld2(bytes: Uint8Array): RoField {
  if (bytes.byteLength < 4) throw new RangeError('FLD2 data is missing its four-byte header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(0, true);
  const height = view.getUint16(2, true);
  const expectedCells = width * height;
  if (width === 0 || height === 0 || bytes.byteLength !== expectedCells + 4) {
    throw new RangeError('FLD2 dimensions do not match its cell data');
  }
  return { width, height, cells: bytes.slice(4) };
}

export function fieldOffset(field: RoField, x: number, y: number) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= field.width || y >= field.height) {
    return -1;
  }
  return y * field.width + x;
}

export function fieldCell(field: RoField, x: number, y: number) {
  const offset = fieldOffset(field, x, y);
  return offset < 0 ? undefined : field.cells[offset];
}

export function isWalkable(field: RoField, x: number, y: number) {
  return fieldCell(field, x, y) === 0;
}
