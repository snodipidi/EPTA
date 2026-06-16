/** Пользователь в ответах авторизации (src совпадает с backend AuthUserDto). */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: "USER" | "MODERATOR" | "ADMIN" | "OWNER";
}

/** Ответ эндпоинтов /auth/login, /auth/register, /auth/refresh. */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}
