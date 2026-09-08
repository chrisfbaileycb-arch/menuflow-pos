export function buildRowsFromString(csvText: string): Array<Record<string, string>> {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
  const rows: Array<Record<string, string>> = [];

  for (let index = 1; index < lines.length; index++) {
    const values = splitCsvLine(lines[index]);
    const row: Record<string, string> = {};
    for (let columnIndex = 0; columnIndex < header.length; columnIndex++) {
      row[header[columnIndex]] = values[columnIndex] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    const nextCharacter = line[index + 1];
    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        current += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      result.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  result.push(current.trim());
  return result;
}
