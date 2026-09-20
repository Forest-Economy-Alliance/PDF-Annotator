import Papa from 'papaparse';

export interface ParsedLabelRow {
  name: string;
  color?: string;
  category?: string;
}

/**
 * Accepts a CSV with a required "name" (or "label") column and optional
 * "color" and "category" columns, matched case-insensitively.
 */
export function parseLabelCsv(fileText: string): ParsedLabelRow[] {
  const result = Papa.parse<Record<string, string>>(fileText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  return result.data
    .map((row): ParsedLabelRow | null => {
      const name = (row.name ?? row.label ?? '').trim();
      if (!name) return null;
      const color = row.color?.trim() || undefined;
      const category = row.category?.trim() || undefined;
      return { name, color, category };
    })
    .filter((r): r is ParsedLabelRow => r !== null);
}
