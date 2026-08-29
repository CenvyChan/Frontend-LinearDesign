import { requestClient } from '#/api/request';

import {
  BUILTIN_STATUS_ENTRIES,
  DEFAULT_STATUS_LOCALE,
  REGISTERED_STATUS_FIELDS,
} from './statusDictionary.generated';

export type StatusTextMode = 'normal' | 'technical';

export interface StatusTextEntry {
  code: string;
  domain: string;
  field: string;
  locale: string;
  text: string;
}

export interface StatusDictionaryPayload {
  entries?: StatusTextEntry[];
  locale?: string;
  version?: number | string;
}

const CACHE_KEY = 'mes.status-dictionary.overrides';
const UNKNOWN_STATUS_TEXT = '未知状态';
const builtinByKey = toEntryMap(BUILTIN_STATUS_ENTRIES);
let overrideByKey = new Map<string, StatusTextEntry>();
let currentVersion: number | string | undefined;

hydrateCachedOverrides();

export function clearStatusTextOverrides() {
  overrideByKey = new Map<string, StatusTextEntry>();
  currentVersion = undefined;
  removeCachedOverrides();
}

export function getStatusDictionaryVersion() {
  return currentVersion;
}

export function isRegisteredStatusField(domain: string, field: string) {
  return REGISTERED_STATUS_FIELDS.has(`${normalize(domain)}.${normalize(field)}`);
}

export async function refreshStatusTextDictionary(locale = DEFAULT_STATUS_LOCALE) {
  try {
    const payload = await requestClient.get<StatusDictionaryPayload>('/system/status-dictionary', {
      params: { locale },
    });
    setStatusTextOverrides(payload?.entries ?? [], payload?.version);
    return true;
  } catch {
    return false;
  }
}

export function resolveStatus(
  domain: string,
  field: string,
  code: null | string | undefined,
  locale = DEFAULT_STATUS_LOCALE,
  mode: StatusTextMode = 'normal',
) {
  const normalizedCode = normalize(code);
  const text = normalizedCode
    ? findStatusText(normalize(domain), normalize(field), normalizedCode, normalize(locale))
    : undefined;
  const displayText = text ?? UNKNOWN_STATUS_TEXT;
  return mode === 'technical' && normalizedCode
    ? `${normalizedCode}（${displayText}）`
    : displayText;
}

export function setStatusTextOverrides(entries: StatusTextEntry[], version?: number | string) {
  overrideByKey = toEntryMap(entries);
  currentVersion = version;
  persistOverrides(entries, version);
}

function findStatusText(domain: string, field: string, code: string, locale: string) {
  for (const candidate of [
    makeKey(domain, field, code, locale),
    makeKey(domain, field, code, DEFAULT_STATUS_LOCALE),
    makeKey('global', 'status', code, locale),
    makeKey('global', 'status', code, DEFAULT_STATUS_LOCALE),
  ]) {
    const entry = overrideByKey.get(candidate) ?? builtinByKey.get(candidate);
    if (entry?.text?.trim()) return entry.text.trim();
  }
  return undefined;
}

function hydrateCachedOverrides() {
  if (typeof localStorage === 'undefined') return;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as StatusDictionaryPayload;
    if (Array.isArray(cached.entries)) {
      overrideByKey = toEntryMap(cached.entries);
      currentVersion = cached.version;
    }
  } catch {
    removeCachedOverrides();
  }
}

function persistOverrides(entries: StatusTextEntry[], version?: number | string) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CACHE_KEY, JSON.stringify({ entries, version }));
}

function removeCachedOverrides() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(CACHE_KEY);
}

function toEntryMap(entries: readonly StatusTextEntry[]) {
  const map = new Map<string, StatusTextEntry>();
  for (const entry of entries) {
    const domain = normalize(entry.domain);
    const field = normalize(entry.field);
    const code = normalize(entry.code);
    const locale = normalize(entry.locale);
    const text = entry.text?.trim();
    if (!domain || !field || !code || !locale || !text) continue;
    map.set(makeKey(domain, field, code, locale), { ...entry, domain, field, code, locale, text });
  }
  return map;
}

function makeKey(domain: string, field: string, code: string, locale: string) {
  return `${domain}.${field}.${code}.${locale}`;
}

function normalize(value: null | string | undefined) {
  return String(value ?? '').trim();
}
