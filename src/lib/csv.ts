/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). Shared by client and server. */
export interface ParsedCsv {
  columns: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string): ParsedCsv {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") inQuotes = true;
    else if (c === ",") {
      record.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((f) => f !== "")) records.push(record);
      record = [];
    } else field += c;
  }
  if (field !== "" || record.length) {
    record.push(field);
    if (record.some((f) => f !== "")) records.push(record);
  }
  const [columns = [], ...body] = records;
  return {
    columns,
    rows: body.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? ""]))),
  };
}
