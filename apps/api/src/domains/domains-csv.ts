import type { DomainItem } from "./domains.types";

export const DOMAINS_CSV_HEADERS = ["domain", "type", "kind", "enabled", "comment", "group"] as const;
export const DOMAINS_CSV_GROUP_SEPARATOR = "|";

export type DomainsCsvHeader = (typeof DOMAINS_CSV_HEADERS)[number];

export type ParsedDomainsCsvRow = {
  line: number;
  domain: string;
  type: string;
  kind: string;
  enabled: string;
  comment: string;
  group: string;
};

function escapeCsvField(value: string) {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function normalizeCsvText(content: string) {
  return content.replace(/^\uFEFF/, "");
}

function parseCsvRecords(content: string) {
  const records: string[][] = [];
  let currentField = "";
  let currentRecord: string[] = [];
  let inQuotes = false;

  const normalized = normalizeCsvText(content);

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const nextCharacter = normalized[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRecord.push(currentField);
      currentField = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRecord.push(currentField);
      currentField = "";

      const hasMeaningfulField = currentRecord.some((field) => field.trim().length > 0);
      if (hasMeaningfulField) {
        records.push(currentRecord);
      }

      currentRecord = [];
      continue;
    }

    currentField += character;
  }

  if (inQuotes) {
    throw new Error("CSV contains an unterminated quoted field.");
  }

  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField);
    const hasMeaningfulField = currentRecord.some((field) => field.trim().length > 0);
    if (hasMeaningfulField) {
      records.push(currentRecord);
    }
  }

  return records;
}

export function serializeDomainsCsv(items: DomainItem[], resolveGroupNames: (groupIds: number[]) => string[]) {
  const rows = [
    DOMAINS_CSV_HEADERS.join(","),
    ...items.map((item) =>
      [
        item.domain,
        item.type,
        item.kind,
        item.enabled ? "enabled" : "disabled",
        item.comment ?? "",
        resolveGroupNames(item.groups).join(DOMAINS_CSV_GROUP_SEPARATOR),
      ]
        .map((field) => escapeCsvField(field))
        .join(","),
    ),
  ];

  return `${rows.join("\r\n")}\r\n`;
}

export function parseDomainsCsv(content: string): ParsedDomainsCsvRow[] {
  const records = parseCsvRecords(content);

  if (records.length === 0) {
    return [];
  }

  const [header, ...dataRows] = records;
  const normalizedHeader = (header ?? []).map((value) => value.trim());

  if (
    normalizedHeader.length !== DOMAINS_CSV_HEADERS.length ||
    DOMAINS_CSV_HEADERS.some((expected, index) => normalizedHeader[index] !== expected)
  ) {
    throw new Error(`CSV header must be exactly: ${DOMAINS_CSV_HEADERS.join(",")}`);
  }

  return dataRows.map((record, index) => {
    if (record.length !== DOMAINS_CSV_HEADERS.length) {
      throw new Error(`Line ${index + 2} must contain exactly ${DOMAINS_CSV_HEADERS.length} columns.`);
    }

    return {
      line: index + 2,
      domain: record[0]?.trim() ?? "",
      type: record[1]?.trim() ?? "",
      kind: record[2]?.trim() ?? "",
      enabled: record[3]?.trim() ?? "",
      comment: record[4] ?? "",
      group: record[5] ?? "",
    };
  });
}

export function parseDomainEnabledValue(value: string) {
  const normalized = value.trim().toLowerCase();

  if (["enabled", "true", "1", "yes"].includes(normalized)) {
    return true;
  }

  if (["disabled", "false", "0", "no"].includes(normalized)) {
    return false;
  }

  return null;
}

export function parseDomainGroupCell(value: string) {
  return value
    .split(DOMAINS_CSV_GROUP_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
