// Minimal RFC 4180 CSV parser. Play's review exports quote any field that
// contains commas, quotes or newlines (review text routinely has all three),
// so splitting on commas corrupts them; this handles the quoting properly.
// Deliberately dependency-free and free of server-only so it can be unit
// tested directly.

export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    // Skip rows that are entirely empty (trailing newline artefacts).
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      endField();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      endRow();
    } else {
      field += c;
    }
  }
  endRow();
  return rows;
}

// Writing: a cell starting with = + - @ (or a tab or carriage return) runs as
// a formula when the file is opened in Excel or Google Sheets. Titles and
// names are typed by housemates, so those get a leading apostrophe (shown as
// plain text). Plain numbers are left alone so money columns stay numeric.
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/** One CSV cell for a download: formula-safe, then quoted when it holds a delimiter. */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
