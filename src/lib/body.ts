/** req.body·req.query는 신뢰할 수 없으므로 any 없이 좁혀서 읽는다 */
export function readString(source: unknown, key: string): string | null {
  if (typeof source !== "object" || source === null) return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** 앞뒤 공백을 제거하고, 비어 있으면 null */
export function readTrimmedString(source: unknown, key: string): string | null {
  const value = readString(source, key)?.trim();
  return value ? value : null;
}
