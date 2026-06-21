import { ENDPOINTS } from "./endpoints";
import { request } from "./http";
import { clearSession, getRefreshToken } from "./tokenStore";
import type { AuthResponse, AuthUser } from "../types/auth";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

export function login(payload: LoginPayload): Promise<AuthResponse> {
  return request<AuthResponse>(ENDPOINTS.login, {
    method: "POST",
    body: payload,
    skipAuthRefresh: true,
  });
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
  return request<AuthResponse>(ENDPOINTS.register, {
    method: "POST",
    body: payload,
    skipAuthRefresh: true,
  });
}

/**
 * Текущий пользователь по access-токену. Используется при старте приложения для
 * восстановления/проверки сессии: при 401 `request` сам попробует refresh.
 */
export function getMe(): Promise<AuthUser> {
  return request<AuthUser>(ENDPOINTS.me);
}

/** Подтверждает почту 6-значным кодом. 204 при успехе. */
export function verifyEmail(code: string): Promise<void> {
  return request<void>(ENDPOINTS.verifyEmail, {
    method: "POST",
    body: { code },
  });
}

/** Просит сервер повторно отправить код подтверждения. */
export function resendCode(): Promise<void> {
  return request<void>(ENDPOINTS.resendCode, { method: "POST" });
}

/** Отзывает refresh-токен на сервере и чистит локальную сессию. */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await request<void>(ENDPOINTS.logout, {
        method: "POST",
        body: { refreshToken },
        skipAuthRefresh: true,
      });
    } catch {
      // Даже если сервер недоступен — локально разлогиниваемся.
    }
  }
  clearSession();
}
