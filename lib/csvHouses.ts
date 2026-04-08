/**
 * Parse CSV files for house import. First row must be headers.
 * Recognized headers (case-insensitive): name, address, house, title, location,
 * latitude, lat, longitude, lng, lon, long, notes, note, description, comments.
 */

export type CsvHouseRow = {
  name: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
};

export type ParseHousesCsvResult = {
  rows: CsvHouseRow[];
  skippedEmpty: number;
};

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  let cur = '';
  let inQ = false;
  while (i < line.length) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ',') {
      out.push(cur.trim());
      cur = '';
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  out.push(cur.trim());
  return out;
}

function splitCsvLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  return lines.filter((l) => l.replace(/\s/g, '').length > 0);
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, '')
    .replace(/\s+/g, '_');
}

function getCell(row: Record<string, string>, aliases: string[]): string {
  for (const a of aliases) {
    const v = row[a];
    if (v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function parseCoord(s: string): number | null {
  const t = s.replace(',', '.').trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function rowRecordToHouse(row: Record<string, string>): CsvHouseRow | null {
  const name = getCell(row, [
    'name',
    'address',
    'house',
    'title',
    'location',
    'house_name',
    'house_address',
  ]);
  if (!name) return null;

  const latStr = getCell(row, ['latitude', 'lat']);
  const lngStr = getCell(row, ['longitude', 'lng', 'lon', 'long']);
  const notesRaw = getCell(row, ['notes', 'note', 'description', 'comments', 'comment']);

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (latStr) latitude = parseCoord(latStr);
  if (lngStr) longitude = parseCoord(lngStr);

  return {
    name,
    latitude,
    longitude,
    notes: notesRaw || null,
  };
}

export function parseHousesFromCsv(csvText: string): ParseHousesCsvResult {
  const text = csvText.replace(/^\uFEFF/, '').trim();
  const lines = splitCsvLines(text);
  if (lines.length < 2) {
    return { rows: [], skippedEmpty: Math.max(0, lines.length - 1) };
  }

  const headerCells = parseCsvRow(lines[0]);
  const headers = headerCells.map(normalizeHeader);
  const rows: CsvHouseRow[] = [];
  let skippedEmpty = 0;

  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvRow(lines[li]);
    const rec: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      if (!key) continue;
      rec[key] = cells[j] ?? '';
    }
    const house = rowRecordToHouse(rec);
    if (!house) {
      skippedEmpty++;
      continue;
    }
    rows.push(house);
  }

  return { rows, skippedEmpty };
}
