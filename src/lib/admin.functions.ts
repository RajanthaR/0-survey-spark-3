/**
 * Barrel re-export — admin.functions.ts was split into domain modules in
 * D21 (auth / stats / exports + a shared server helpers module). All
 * existing import sites that reach for `@/lib/admin.functions` keep working
 * because every public symbol is re-exported here.
 *
 * Prefer importing from the domain module directly in new code.
 */
export { adminBootstrap } from "@/lib/admin.auth.functions";
export {
  getStats,
  listResponses,
  previewFilteredCount,
  getAnalyticsReport,
} from "@/lib/admin.stats.functions";
export {
  exportCsv,
  exportSectionedLocalizedCsv,
  exportLocalizedXlsx,
  exportValidationReport,
  exportAllValidCsv,
  streamAllValidCsv,
  streamAllValidXlsx,
  exportCodebookCsv,
  exportCodebookXlsx,
  exportFilteredCsv,
  exportFilteredXlsx,
  exportZipBundle,
} from "@/lib/admin.exports.functions";
