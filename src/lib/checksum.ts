/**
 * Streaming CRC32 + SHA-256 helpers used by the all-valid CSV export to
 * detect corruption between server emission and client assembly.
 *
 * - `crc32Update(state, bytes)` returns the new running CRC32 state.
 *   Seed with `CRC32_INIT` and finalise with `crc32Finalize(state)`.
 * - `sha256Hex(bytes)` is a one-shot Web Crypto digest used at end-of-file
 *   on the client (the server uses Node's streaming `createHash`).
 *
 * Both inputs are UTF-8 byte arrays; on the wire we ship hex strings.
 */

export const CRC32_INIT = 0xffffffff;

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32Update(state: number, bytes: Uint8Array): number {
  let c = state >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    c = (CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return c >>> 0;
}

export function crc32Finalize(state: number): number {
  return (state ^ 0xffffffff) >>> 0;
}

/** Hex string, lower-case, zero-padded to 8 chars. */
export function crc32Hex(state: number): string {
  return crc32Finalize(state).toString(16).padStart(8, "0");
}

/** One-shot CRC32 over bytes (returns finalised hex). */
export function crc32OfBytes(bytes: Uint8Array): string {
  return crc32Hex(crc32Update(CRC32_INIT, bytes));
}

/** UTF-8 encode helper that works in both Node and browser runtimes. */
const ENCODER = new TextEncoder();
export function utf8(s: string): Uint8Array {
  return ENCODER.encode(s);
}

/** SHA-256 hex via Web Crypto. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const buf = await crypto.subtle.digest("SHA-256", ab);
  const view = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out;
}
