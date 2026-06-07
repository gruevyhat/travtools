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

// Parses CSV text into rows of string cells. Handles quoted fields with internal commas.
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let i = 0;
    while (i <= line.length) {
      if (i === line.length) break;
      if (line[i] === '"') {
        i++;
        let cell = '';
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { cell += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else cell += line[i++];
        }
        row.push(cell);
        if (line[i] === ',') i++;
      } else {
        let cell = '';
        while (i < line.length && line[i] !== ',') cell += line[i++];
        row.push(cell.trim());
        if (line[i] === ',') i++;
      }
    }
    if (row.length > 0) rows.push(row);
  }
  return rows;
}
