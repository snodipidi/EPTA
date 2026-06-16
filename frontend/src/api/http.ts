import { API_BASE_URL } from "./config";
import type { AuthResponse } from "../types/auth";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "./tokenStore";

/**
 * Единый HTTP-клиент для реального backend.
 *
 * - на каждый запрос добавляет заголовок версии `X-API-Version: 1`
 *   (бэкенд использует header-версионирование, без него — 404);
 * - подставляет `Authorization: Bearer <access>`, если есть токен;
 * - при 401 один раз пытается обновить пару токенов через /auth/refresh
 *   и повторяет исходный запрос;
 * - нормализует ошибку бэкенда `{ statusCode, error, message }` в `ApiError`.
 */
const API_VERSION = "1";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Внутренний флаг: не пытаться рефрешить (например, для самих auth-запросов). */
  skipAuthRefresh?: boolean;
}

function buildHeaders(withBody: boolean): Headers {
  const headers = new Headers();
  headers.set("X-API-Version", API_VERSION);
  if (withBody) headers.set("Content-Type", "application/json");
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

/** Достаёт человекочитаемое сообщение из конверта ошибки бэкенда. */
async function extractError(res: Response): Promise<ApiError> {
  let message = `Ошибка запроса (${res.status})`;
  try {
    const data = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) message = data.message.join(", ");
    else if (typeof data.message === "string") message = data.message;
  } catch {
    // тело не JSON — оставляем дефолтное сообщение
  }
  return new ApiError(res.status, message);
}

/** Пытается обновить токены. Возвращает true при успехе. */
async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "X-API-Version": API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearSession();
    return false;
  }

  const data = (await res.json()) as AuthResponse;
  saveTokens(data.accessToken, data.refreshToken);
  return true;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, skipAuthRefresh = false } = options;
  const hasBody = body !== undefined;

  const doFetch = () =>
    fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: buildHeaders(hasBody),
      body: hasBody ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch();

  // Access-токен мог протухнуть — пробуем разово обновить и повторить.
  if (res.status === 401 && !skipAuthRefresh && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await doFetch();
  }

  if (!res.ok) throw await extractError(res);

  // 204 No Content и пустое тело — возвращаем undefined.
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
