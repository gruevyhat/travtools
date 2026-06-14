export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(cols: (string | number | boolean | null | undefined)[]): string {
  return cols.map(csvCell).join(',');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Parses CSV text into rows of string cells. Handles quoted fields with commas,
// escaped quotes, and line breaks.
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let cellWasQuoted = false;

  function finishCell() {
    row.push(cellWasQuoted ? cell : cell.trim());
    cell = '';
    cellWasQuoted = false;
  }

  function finishRow() {
    finishCell();
    if (row.some(value => value.trim() !== '')) rows.push(row);
    row = [];
  }

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"' && normalized[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell.trim() === '') {
      inQuotes = true;
      cellWasQuoted = true;
      cell = '';
    } else if (char === ',') {
      finishCell();
    } else if (char === '\n') {
      finishRow();
    } else {
      cell += char;
    }
  }
  if (inQuotes || cell.length > 0 || cellWasQuoted || row.length > 0) finishRow();
  return rows;
}
