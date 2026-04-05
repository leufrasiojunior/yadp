export const CLIENTS_EXCLUDED_TAGS_COOKIE = "clients_excluded_tags";

function normalizeClientTagValue(value: string) {
  return value.trim();
}

function normalizeClientTagKey(value: string) {
  return normalizeClientTagValue(value).toLocaleLowerCase();
}

export function normalizeClientTags(values: Iterable<string>) {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of values) {
    const value = normalizeClientTagValue(rawValue);

    if (value.length === 0) {
      continue;
    }

    const key = normalizeClientTagKey(value);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(value);
  }

  return normalized;
}

export function hasMatchingClientTag(tags: string[], candidate: string) {
  const normalizedCandidate = normalizeClientTagKey(candidate);

  return tags.some((tag) => normalizeClientTagKey(tag) === normalizedCandidate);
}

export function removeClientTag(tags: string[], candidate: string) {
  const normalizedCandidate = normalizeClientTagKey(candidate);

  return tags.filter((tag) => normalizeClientTagKey(tag) !== normalizedCandidate);
}

export function areClientTagArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => normalizeClientTagKey(value) === normalizeClientTagKey(right[index] ?? ""));
}

export function parseExcludedClientTagsCookie(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const decoded = decodeURIComponent(value);
    const parsed = JSON.parse(decoded);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeClientTags(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return [];
  }
}

export function serializeExcludedClientTagsCookie(tags: string[]) {
  return encodeURIComponent(JSON.stringify(normalizeClientTags(tags)));
}

export function getCompactClientTags(tags: string[], maxVisible = 2) {
  return {
    visible: tags.slice(0, maxVisible),
    hiddenCount: Math.max(0, tags.length - maxVisible),
  };
}
