/** Parses RFC 4180 CSV (quoted fields, "" escapes, commas and newlines inside quotes) into header-keyed rows. */
export function parseCsv(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      record.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field || record.length) {
    record.push(field);
    records.push(record);
  }

  const [header, ...rows] = records;
  return rows.filter((r) => r.length > 1 || r[0]).map((r) => Object.fromEntries(header.map((key, i) => [key, r[i] ?? ""])));
}
