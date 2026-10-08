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

// 제어 문자(유니코드 Cc: U+0000–U+001F, U+007F–U+009F) 중 줄바꿈(\n, \r)과 탭(\t)만 허용한다.
// NUL(U+0000)은 Postgres text에 저장할 수 없어 그대로 두면 DB 단계에서 500이 난다.
const DISALLOWED_CONTROL_CHARS = /[^\P{Cc}\t\n\r]/u;

export type ContentResult<T extends string | null> =
  | { ok: true; content: T } // null = 필드를 보내지 않음 (required: false일 때만)
  | { ok: false; message: string };

/**
 * story·comment 본문(body.content) 검증 — 규칙을 한 곳에 모아 두 리소스가 똑같이 적용한다.
 *   - 문자열이 아니면 400
 *   - 줄바꿈·탭을 제외한 제어 문자가 있으면 400 (trim이 앞뒤 제어 문자를 지우기 전에 원문으로 검사)
 *   - 앞뒤 공백을 제거한 뒤 빈 문자열이면 400
 *   - maxLength 초과면 400 — 길이는 UTF-16 단위가 아니라 문자(코드 포인트) 기준
 * required가 false면 필드가 아예 없을 때만 { content: null }을 돌려준다 (PATCH 부분 수정용).
 * 필드를 보냈는데 비어 있으면 required와 상관없이 400이다.
 */
export function readContent(body: unknown, options: { maxLength: number; required: true }): ContentResult<string>;
export function readContent(body: unknown, options: { maxLength: number; required: false }): ContentResult<string | null>;
export function readContent(
  body: unknown,
  options: { maxLength: number; required: boolean }
): ContentResult<string | null> {
  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>).content : undefined;

  if (raw === undefined || raw === null) {
    return options.required ? { ok: false, message: "content가 필요합니다." } : { ok: true, content: null };
  }
  if (typeof raw !== "string") return { ok: false, message: "content는 문자열이어야 합니다." };
  if (DISALLOWED_CONTROL_CHARS.test(raw)) {
    return { ok: false, message: "content에 허용되지 않는 제어 문자가 있습니다." };
  }

  const content = raw.trim();
  if (!content) return { ok: false, message: "content가 비어 있습니다." };
  if ([...content].length > options.maxLength) {
    return { ok: false, message: `content는 ${options.maxLength.toLocaleString("en-US")}자 이하여야 합니다.` };
  }
  return { ok: true, content };
}
