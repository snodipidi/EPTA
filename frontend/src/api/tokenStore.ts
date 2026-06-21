import type { AuthUser } from "../types/auth";

/**
 * Хранение токенов и текущего пользователя в localStorage.
 *
 * Бэкенд отдаёт access (≈15 мин) и refresh (30 дней) токены в теле JSON, а не в
 * куках, — поэтому клиент хранит их сам и шлёт access в заголовке Authorization.
 */
const ACCESS_KEY = "epta.accessToken";
const REFRESH_KEY = "epta.refreshToken";
const USER_KEY = "epta.user";

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(ACCESS_KEY, session.accessToken);
  localStorage.setItem(REFRESH_KEY, session.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

/** Обновляет только пару токенов (после ротации refresh), пользователя не трогает. */
export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

/** Обновляет только сохранённого пользователя (токены не трогает). */
export function saveUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
