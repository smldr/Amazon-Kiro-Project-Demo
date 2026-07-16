/** Minimal QR Code Generator — byte mode, ECC level L. */

const EXP = new Uint8Array(256);
const LOG = new Uint8Array(256);
let x = 1;
for (let i = 0; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
}
EXP[255] = EXP[0];

function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : EXP[(LOG[a] + LOG[b]) % 255];
}

function polyMul(p, q) {
  const r = new Uint8Array(p.length + q.length - 1);
  for (let i = 0; i < p.length; i++)
    for (let j = 0; j < q.length; j++) r[i + j] ^= gfMul(p[i], q[j]);
  return r;
}

function polyRemainder(dividend, divisor) {
  const result = new Uint8Array(dividend);
  for (let i = 0; i < dividend.length - divisor.length + 1; i++) {
    if (result[i] !== 0) {
      for (let j = 1; j < divisor.length; j++)
        result[i + j] ^= gfMul(divisor[j], result[i]);
    }
  }
  return result.slice(dividend.length - divisor.length + 1);
}

function makeGenerator(n) {
  let gen = new Uint8Array([1]);
  for (let i = 0; i < n; i++) gen = polyMul(gen, new Uint8Array([1, EXP[i]]));
  return gen;
}

const EC_CODEWORDS_L = [
  0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 22, 24, 26, 28, 30, 22, 24,
  26, 28, 30, 24, 26, 28, 30, 26, 28, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30,
  30, 30, 30,
];

const DATA_CODEWORDS_L = [
  0, 19, 34, 55, 80, 108, 136, 156, 194, 232, 274, 324, 370, 428, 461, 523,
  589, 647, 721, 795, 861, 932, 1006, 1094, 1174, 1276, 1370, 1468, 1531,
  1631, 1735, 1843, 1955, 2071, 2191, 2306, 2434, 2566, 2702, 2812, 2956,
];

const NUM_BLOCKS_L = [
  0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
];

const ALIGN_POSITIONS = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
];

function getVersion(dataLength) {
  for (let v = 1; v <= 40; v++) {
    const cciBits = v <= 9 ? 8 : 16;
    const totalBits = 4 + cciBits + dataLength * 8;
    if (totalBits <= DATA_CODEWORDS_L[v] * 8) return v;
  }
  throw new Error("Data too long for QR code");
}

export function encode(text) {
  const data = new TextEncoder().encode(text);
  const version = getVersion(data.length);
  const size = version * 4 + 17;
  const totalDataCodewords = DATA_CODEWORDS_L[version];
  const numBlocks = NUM_BLOCKS_L[version];
  const ecPerBlock = EC_CODEWORDS_L[version];

  // Build data bit stream
  const cciBits = version <= 9 ? 8 : 16;
  const bits = [];

  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  }

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(data.length, cciBits);
  for (const byte of data) pushBits(byte, 8);

  // Terminator
  const maxBits = totalDataCodewords * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);

  // Byte-align
  while (bits.length % 8 !== 0) bits.push(0);

  // Padding codewords
  let padByte = 0xec;
  while (bits.length < maxBits) {
    pushBits(padByte, 8);
    padByte = padByte === 0xec ? 0x11 : 0xec;
  }

  // Convert bits to codewords
  const codewords = new Uint8Array(totalDataCodewords);
  for (let i = 0; i < totalDataCodewords; i++) {
    let val = 0;
    for (let b = 0; b < 8; b++) val = (val << 1) | bits[i * 8 + b];
    codewords[i] = val;
  }

  // Split into blocks and compute error correction
  const shortBlockLen = Math.floor(totalDataCodewords / numBlocks);
  const longBlocks = totalDataCodewords % numBlocks;
  const generator = makeGenerator(ecPerBlock);
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;

  for (let b = 0; b < numBlocks; b++) {
    const blockLen = shortBlockLen + (b >= numBlocks - longBlocks ? 1 : 0);
    const block = codewords.slice(offset, offset + blockLen);
    dataBlocks.push(block);
    offset += blockLen;

    const padded = new Uint8Array(blockLen + ecPerBlock);
    padded.set(block);
    ecBlocks.push(polyRemainder(padded, generator));
  }

  // Interleave data and EC blocks
  const interleaved = [];
  const maxBlockLen = shortBlockLen + 1;
  for (let i = 0; i < maxBlockLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) interleaved.push(block[i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) interleaved.push(block[i]);
  }

  // Build module matrix
  const modules = Array.from({ length: size }, () => new Uint8Array(size));
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));

  // Finder patterns
  function placeFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r,
          cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inOuter = r === 0 || r === 6 || c === 0 || c === 6;
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        modules[rr][cc] = inOuter || inInner ? 1 : 0;
        reserved[rr][cc] = 1;
      }
    }
  }
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment patterns
  const alignPos = ALIGN_POSITIONS[version];
  for (const row of alignPos) {
    for (const col of alignPos) {
      if (reserved[row][col]) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const inBorder = r === -2 || r === 2 || c === -2 || c === 2;
          modules[row + r][col + c] = inBorder || (r === 0 && c === 0) ? 1 : 0;
          reserved[row + r][col + c] = 1;
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    modules[6][i] = i % 2 === 0 ? 1 : 0;
    reserved[6][i] = 1;
    modules[i][6] = i % 2 === 0 ? 1 : 0;
    reserved[i][6] = 1;
  }

  // Dark module
  modules[size - 8][8] = 1;
  reserved[size - 8][8] = 1;

  // Reserve format info areas
  for (let i = 0; i < 8; i++) {
    reserved[8][i] = 1;
    reserved[8][size - 1 - i] = 1;
    reserved[i][8] = 1;
    reserved[size - 1 - i][8] = 1;
  }
  reserved[8][8] = 1;

  // Reserve version info areas (version >= 7)
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserved[i][size - 11 + j] = 1;
        reserved[size - 11 + j][i] = 1;
      }
    }
  }

  // Place data bits
  const dataBits = [];
  for (const byte of interleaved) {
    for (let b = 7; b >= 0; b--) dataBits.push((byte >>> b) & 1);
  }

  let bitIdx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) >> 1) % 2 === 0;
        const row = upward ? size - 1 - vert : vert;
        if (!reserved[row][col]) {
          modules[row][col] = bitIdx < dataBits.length ? dataBits[bitIdx] : 0;
          bitIdx++;
        }
      }
    }
  }

  // Apply mask 0 (checkerboard)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        if ((r + c) % 2 === 0) modules[r][c] ^= 1;
      }
    }
  }

  // Place format info (ECC L, mask 0): 111011111000100
  const fmt = 0b111011111000100;
  for (let i = 0; i <= 5; i++) modules[8][i] = (fmt >> (14 - i)) & 1;
  modules[8][7] = (fmt >> 8) & 1;
  modules[8][8] = (fmt >> 7) & 1;
  modules[7][8] = (fmt >> 6) & 1;
  for (let i = 5; i >= 0; i--) modules[i][8] = (fmt >> i) & 1;
  for (let i = 0; i < 7; i++)
    modules[size - 7 + i][8] = (fmt >> (6 - i)) & 1;
  for (let i = 0; i < 8; i++)
    modules[8][size - 8 + i] = (fmt >> (7 - i)) & 1;

  return { modules, size, version };
}

export function renderQR(canvas, text, fgColor = "#1e1e2e", bgColor = "#ffffff") {
  const { modules, size } = encode(text);
  const ctx = canvas.getContext("2d");
  const scale = Math.floor(canvas.width / (size + 8)); // 4 modules quiet zone each side
  const offset = Math.floor((canvas.width - size * scale) / 2);

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = fgColor;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) {
        ctx.fillRect(offset + c * scale, offset + r * scale, scale, scale);
      }
    }
  }
}
