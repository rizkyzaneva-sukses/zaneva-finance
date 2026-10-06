/** Salin data tabel ke clipboard sebagai TSV supaya bisa langsung paste ke Excel/Google Sheets. */
export async function copyTsv(rows: (string | number)[][]): Promise<void> {
  const text = rows.map((r) => r.map((c) => String(c ?? "")).join("\t")).join("\n");
  await navigator.clipboard.writeText(text);
}
