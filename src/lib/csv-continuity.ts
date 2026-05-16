/**
 * CSV continuity helpers used by the streaming all-valid CSV export.
 *
 * The streaming flow concatenates many `chunk` events into a single
 * downloadable CSV. On resume (or in the unlikely event the server
 * re-emits the BOM/header mid-stream) we want strong guarantees that
 * the final blob is **one continuous CSV**:
 *
 *  1. exactly one leading UTF-8 BOM (`\uFEFF`)
 *  2. exactly one header line, immediately after the BOM
 *  3. every page boundary terminated by a single `\n` so the last row
 *     of one chunk never glues onto the first row of the next
 *
 * `sanitizeCsvChunk` is applied to every incoming chunk so per-chunk
 * defects are scrubbed in-flight. `validateAssembledCsv` is a
 * defensive sanity check run before the final blob is handed to the
 * download — it surfaces a clear reason in the failure banner if the
 * invariants were ever violated, instead of silently shipping a
 * malformed file.
 */

/** Strip a stray BOM, drop a re-emitted header line, and ensure the
 *  chunk ends with a single `\n` so the next chunk concatenates cleanly. */
export function sanitizeCsvChunk(chunk: string, headerLine: string): string {
  let csv = chunk;
  // 1. A mid-stream BOM is never valid — only the very first chunk
  //    (the seeded "\uFEFF" entry) is allowed to carry it.
  while (csv.startsWith("\uFEFF")) csv = csv.slice(1);
  // 2. Some servers / proxies retransmit the header on a resumed page.
  //    Strip leading occurrences (with or without trailing newline).
  const headerWithNl = headerLine + "\n";
  while (csv.startsWith(headerWithNl)) csv = csv.slice(headerWithNl.length);
  if (csv === headerLine) csv = "";
  // 3. Guarantee newline termination so a missing `\n` at a page
  //    boundary doesn't fuse two rows together.
  if (csv.length > 0 && !csv.endsWith("\n")) csv += "\n";
  return csv;
}

/** Run after assembly, before the Blob is created. Returns `{ ok: true }`
 *  when the chunks form one continuous CSV; otherwise an explanatory
 *  reason the caller can surface to the admin.
 *
 *  When the failure is localizable to a single chunk (duplicate BOM,
 *  duplicate header line, or unterminated final row), `chunkIndex`
 *  identifies which entry in `chunks` contains (or should have
 *  contained) the offending bytes. Callers can map this to a page
 *  number using their own `chunkIndex → page` convention (e.g. the
 *  admin streamer reserves chunks[0] for the BOM and chunks[1] for the
 *  header line, so `pageOfChunk = chunkIndex - 2`). */
export function validateAssembledCsv(
  chunks: readonly string[],
  headerLine: string,
): { ok: true } | { ok: false; reason: string; chunkIndex?: number } {
  if (chunks.length === 0) return { ok: false, reason: "no chunks to assemble" };

  // Count BOM occurrences across the whole assembly. We require exactly
  // one and it must be at byte 0 of the first chunk. When there are
  // multiple BOMs, surface the chunk index that introduced the *second*
  // one so the admin can correlate it with a specific page.
  let bomCount = 0;
  let secondBomChunkIndex: number | undefined;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    let idx = 0;
    while ((idx = c.indexOf("\uFEFF", idx)) !== -1) {
      bomCount++;
      if (bomCount === 2 && secondBomChunkIndex === undefined) {
        secondBomChunkIndex = i;
      }
      idx++;
    }
  }
  if (bomCount === 0) return { ok: false, reason: "missing leading BOM", chunkIndex: 0 };
  if (bomCount > 1) {
    return {
      ok: false,
      reason: `multiple BOM markers (${bomCount})`,
      chunkIndex: secondBomChunkIndex,
    };
  }
  if (!chunks[0].startsWith("\uFEFF")) {
    return { ok: false, reason: "BOM not at start of file", chunkIndex: 0 };
  }

  // Header must appear exactly once, immediately after the BOM. We
  // join into a single string for the structural checks — the admin
  // exports are bounded so this is fine memory-wise (the same string
  // is about to be wrapped in a Blob anyway).
  const joined = chunks.join("");
  const body = joined.slice(1); // skip BOM
  const headerWithNl = headerLine + "\n";
  if (!body.startsWith(headerWithNl)) {
    // The header is conventionally chunks[1]; flag it as the offender.
    return {
      ok: false,
      reason: "header missing or not at start of file",
      chunkIndex: chunks.length > 1 ? 1 : 0,
    };
  }
  // Look for a duplicate header line further into the body. Locate the
  // chunk that contains the duplicate so the warning can point at the
  // exact page boundary that introduced it.
  const dupNeedle = "\n" + headerLine + "\n";
  const dupAt = body.indexOf(dupNeedle);
  if (dupAt !== -1) {
    // Translate the `body` offset back to a chunk index by walking the
    // chunk lengths (account for the BOM stripped from `body`).
    const absolute = dupAt + 1; // +1 to undo body.slice(1)
    let cursor = 0;
    let dupChunkIndex: number | undefined;
    for (let i = 0; i < chunks.length; i++) {
      const next = cursor + chunks[i].length;
      if (absolute < next) {
        dupChunkIndex = i;
        break;
      }
      cursor = next;
    }
    return {
      ok: false,
      reason: "duplicate header line detected",
      chunkIndex: dupChunkIndex,
    };
  }

  // Reject any unterminated final row — a downloaded CSV should end
  // with `\n` so external tools don't treat the last record as
  // truncated. The offender is the last chunk by definition.
  if (!joined.endsWith("\n")) {
    return {
      ok: false,
      reason: "final row not newline-terminated",
      chunkIndex: chunks.length - 1,
    };
  }

  return { ok: true };
}
