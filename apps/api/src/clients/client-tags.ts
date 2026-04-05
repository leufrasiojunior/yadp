export const MAX_CLIENT_TAG_LENGTH = 64;

function normalizeTagValue(value: string) {
  return value.trim();
}

function normalizeTagKey(value: string) {
  return normalizeTagValue(value).toLocaleLowerCase();
}

export function normalizeClientTags(values: Iterable<string>) {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of values) {
    const value = normalizeTagValue(rawValue);

    if (value.length === 0) {
      continue;
    }

    const key = normalizeTagKey(value);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(value);
  }

  return normalized;
}

export function hasMatchingClientTag(tags: string[], candidate: string) {
  const normalizedCandidate = normalizeTagKey(candidate);

  return tags.some((tag) => normalizeTagKey(tag) === normalizedCandidate);
}

export function normalizeClientTagQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeClientTags(value.flatMap((item) => (typeof item === "string" ? item.split(",") : [])));
  }

  if (typeof value === "string") {
    return normalizeClientTags(value.split(","));
  }

  return [];
}
