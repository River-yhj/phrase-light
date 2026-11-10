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

// 제어 문자(유니코드 Cc: U+0000–U+001F, U+007F–U+009F). 여러 줄 입력은 줄바꿈(\n, \r)과 탭(\t)만 허용하고,
// 한 줄 입력(제목 등)은 하나도 허용하지 않는다.
// NUL(U+0000)은 Postgres text에 저장할 수 없어 그대로 두면 DB 단계에서 500이 난다.
const DISALLOWED_IN_MULTILINE = /[^\P{Cc}\t\n\r]/u;
const DISALLOWED_IN_SINGLE_LINE = /\p{Cc}/u;

export type TextResult<T extends string | null> =
  | { ok: true; value: T } // null = 필드를 보내지 않음 (required: false일 때만)
  | { ok: false; message: string };

type TextOptions = {
  /** 요청 본문의 필드 이름 (에러 문구에도 쓴다) */
  field: string;
  maxLength: number;
  /** false면 줄바꿈·탭도 허용하지 않는다 (기본 true) */
  multiline?: boolean;
};

/**
 * 사용자가 쓰는 텍스트 필드 검증 — 분석할 글, 노트 제목·원문이 같은 규칙을 쓰도록 한 곳에 모은다.
 *   - 문자열이 아니면 400
 *   - 허용되지 않는 제어 문자가 있으면 400 (trim이 앞뒤 제어 문자를 지우기 전에 원문으로 검사)
 *   - 앞뒤 공백을 제거한 뒤 빈 문자열이면 400
 *   - maxLength 초과면 400 — 길이는 UTF-16 단위가 아니라 문자(코드 포인트) 기준
 * required가 false면 필드가 아예 없을 때만 { value: null }을 돌려준다 (PATCH 부분 수정용).
 * 필드를 보냈는데 비어 있으면 required와 상관없이 400이다.
 */
export function readText(body: unknown, options: TextOptions & { required: true }): TextResult<string>;
export function readText(body: unknown, options: TextOptions & { required: false }): TextResult<string | null>;
export function readText(body: unknown, options: TextOptions & { required: boolean }): TextResult<string | null> {
  const { field, maxLength, multiline = true, required } = options;
  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>)[field] : undefined;

  if (raw === undefined || raw === null) {
    return required ? { ok: false, message: `${field}가 필요합니다.` } : { ok: true, value: null };
  }
  if (typeof raw !== "string") return { ok: false, message: `${field}는 문자열이어야 합니다.` };
  if ((multiline ? DISALLOWED_IN_MULTILINE : DISALLOWED_IN_SINGLE_LINE).test(raw)) {
    return {
      ok: false,
      message: multiline
        ? `${field}에 허용되지 않는 제어 문자가 있습니다.`
        : `${field}에는 줄바꿈이나 제어 문자를 쓸 수 없습니다.`,
    };
  }

  const value = raw.trim();
  if (!value) return { ok: false, message: `${field}가 비어 있습니다.` };
  if ([...value].length > maxLength) {
    return { ok: false, message: `${field}는 ${maxLength.toLocaleString("en-US")}자 이하여야 합니다.` };
  }
  return { ok: true, value };
}
