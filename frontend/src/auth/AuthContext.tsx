import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type LoginPayload,
  type RegisterPayload,
} from "../api/auth";
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  saveSession,
  saveUser,
} from "../api/tokenStore";
import type { AuthUser } from "../types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** true, пока на старте проверяется сохранённая сессия (не редиректим до конца). */
  bootstrapping: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  /** Подменить пользователя локально (например, после подтверждения почты). */
  setUser: (user: AuthUser) => void;
  /** Перечитать пользователя с сервера (GET /auth/me) и обновить сессию. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Оптимистично восстанавливаем пользователя из localStorage, затем
  // подтверждаем сессию на сервере (см. эффект ниже).
  const [user, setUserState] = useState<AuthUser | null>(() => getStoredUser());
  const [bootstrapping, setBootstrapping] = useState<boolean>(() =>
    Boolean(getAccessToken()),
  );

  // Локально обновить пользователя + закэшировать в localStorage.
  const setUser = useCallback((next: AuthUser) => {
    setUserState(next);
    saveUser(next);
  }, []);

  const refreshUser = useCallback(async () => {
    const fresh = await getMe();
    setUser(fresh);
  }, [setUser]);

  // Проверка сессии на одном устройстве: если есть токен — валидируем его через
  // GET /auth/me (а http.ts при 401 сам попробует refresh). Успех — гидрируем
  // свежего пользователя (в т.ч. emailVerified); провал — чистим сессию.
  useEffect(() => {
    // Нет токена → bootstrapping уже false (см. инициализатор), просто выходим.
    if (!getAccessToken()) return;
    let cancelled = false;
    getMe()
      .then((fresh) => {
        if (cancelled) return;
        setUser(fresh);
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        setUserState(null);
      })
      .finally(() => {
        if (!cancelled) setBootstrapping(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await apiLogin(payload);
    saveSession(res);
    setUserState(res.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await apiRegister(payload);
    saveSession(res);
    setUserState(res.user);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUserState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      bootstrapping,
      login,
      register,
      logout,
      setUser,
      refreshUser,
    }),
    [user, bootstrapping, login, register, logout, setUser, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
