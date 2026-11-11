export const STORAGE_KEYS = Object.freeze({
  snooze: "discourse-geo-domain-redirect:snooze",
  ignore: "discourse-geo-domain-redirect:ignore",
});

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SNOOZE_DAYS = 7;
const MAX_SNOOZE_DAYS = 3650;

function defaultStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    // Browsers with storage disabled throw on access.
    return null;
  }
}

function readRecord(storage, key) {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function writeRecord(storage, key, record) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function normalizeHost(value) {
  return String(value ?? "")
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/^\/\//, "")
    .split(/[/?#]/)[0]
    .trim()
    .replace(/\.$/, "")
    .replace(/:(?:80|443)$/, "")
    .toLowerCase();
}

export function parseSnoozeOptions(value) {
  const parts = Array.isArray(value) ? value : String(value ?? "").split("|");
  const options = [];

  for (const part of parts) {
    const days = Number(String(part).trim());
    if (
      Number.isInteger(days) &&
      days > 0 &&
      days <= MAX_SNOOZE_DAYS &&
      !options.includes(days)
    ) {
      options.push(days);
    }
  }

  return options;
}

export function buildRedirectUrl(
  targetHost,
  currentLocation = window.location
) {
  const host = normalizeHost(targetHost);
  if (!host) {
    return null;
  }

  const pathname = currentLocation.pathname || "/";
  const search = currentLocation.search || "";
  const hash = currentLocation.hash || "";

  return `https://${host}${pathname}${search}${hash}`;
}

export function isPromptSuppressed(
  targetHost,
  { now = Date.now(), storage = defaultStorage() } = {}
) {
  const host = normalizeHost(targetHost);
  if (!host) {
    return false;
  }

  const ignored = readRecord(storage, STORAGE_KEYS.ignore);
  if (ignored?.host === host) {
    return true;
  }

  const snoozed = readRecord(storage, STORAGE_KEYS.snooze);
  return snoozed?.host === host && Number(snoozed.until) > now;
}

export function snoozePrompt(
  targetHost,
  days,
  { now = Date.now(), storage = defaultStorage() } = {}
) {
  const host = normalizeHost(targetHost);
  if (!host) {
    return false;
  }

  const duration = Math.max(1, Math.floor(Number(days) || DEFAULT_SNOOZE_DAYS));

  return writeRecord(storage, STORAGE_KEYS.snooze, {
    host,
    days: duration,
    until: now + duration * DAY_IN_MS,
  });
}

export function ignorePrompt(
  targetHost,
  { now = Date.now(), storage = defaultStorage() } = {}
) {
  const host = normalizeHost(targetHost);
  if (!host) {
    return false;
  }

  return writeRecord(storage, STORAGE_KEYS.ignore, {
    host,
    ignoredAt: now,
  });
}

export function shouldPrompt({
  country,
  countryCode = "CN",
  currentHost,
  targetHost,
  now = Date.now(),
  storage = defaultStorage(),
} = {}) {
  const target = normalizeHost(targetHost);
  if (!target || normalizeHost(currentHost) === target) {
    return false;
  }

  const expected = String(countryCode ?? "")
    .trim()
    .toUpperCase();
  const actual = String(country ?? "")
    .trim()
    .toUpperCase();

  if (!expected || actual !== expected) {
    return false;
  }

  return !isPromptSuppressed(target, { now, storage });
}
