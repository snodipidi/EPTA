import { ENDPOINTS } from "./endpoints";
import { request } from "./http";
import { clearSession, getRefreshToken } from "./tokenStore";
import type { AuthResponse } from "../types/auth";

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
