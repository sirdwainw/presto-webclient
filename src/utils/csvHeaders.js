function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(current);
  return cells.map((cell) => cell.replace(/^\uFEFF/, "").trim());
}

function findFirstNonEmptyLine(text) {
  const lines = String(text || "").split(/\r?\n/);
  return lines.find((line) => line.trim()) || "";
}

export async function readCsvHeaders(file) {
  const text = await file.text();
  const firstLine = findFirstNonEmptyLine(text);

  if (!firstLine) return [];

  return splitCsvLine(firstLine)
    .map((header) => header.replace(/^"|"$/g, "").trim())
    .filter((header, idx, arr) => header || idx < arr.length);
}
