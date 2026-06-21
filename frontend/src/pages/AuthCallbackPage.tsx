import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout/AuthLayout";
import { saveTokens } from "../api/tokenStore";
import { useAuth } from "../auth/AuthContext";

interface ParsedTokens {
  accessToken: string | null;
  refreshToken: string | null;
  hasError: boolean;
}

/** Разбирает токены из фрагмента URL один раз (без побочных эффектов). */
function parseHashTokens(): ParsedTokens {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return {
    accessToken: params.get("accessToken"),
    refreshToken: params.get("refreshToken"),
    hasError: params.get("error") !== null,
  };
}

/**
 * Точка приземления после Google OAuth. Бэкенд редиректит сюда с токенами во
 * фрагменте URL (`#accessToken=…&refreshToken=…`) — фрагмент не уходит на сервер
 * и не попадает в логи. Сохраняем сессию, подтягиваем пользователя, уходим домой.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  // Разбираем фрагмент один раз; ошибочный исход сразу попадает в начальный стейт,
  // поэтому синхронный setState в эффекте не нужен.
  const [parsed] = useState<ParsedTokens>(parseHashTokens);
  const [error, setError] = useState<string | null>(
    parsed.hasError || !parsed.accessToken || !parsed.refreshToken
      ? "Не удалось войти через Google. Попробуйте ещё раз."
      : null,
  );

  useEffect(() => {
    // Подчищаем токены из адресной строки сразу после чтения.
    window.history.replaceState(null, "", window.location.pathname);

    const { accessToken, refreshToken, hasError } = parsed;
    if (hasError || !accessToken || !refreshToken) return;

    saveTokens(accessToken, refreshToken);
    refreshUser()
      .then(() => navigate("/", { replace: true }))
      .catch(() => setError("Сессия не подтвердилась. Войдите заново."));
  }, [parsed, navigate, refreshUser]);

  return (
    <AuthLayout title="вход через Google" footerLink={{ text: "войти", to: "/login" }}>
      {error ? (
        <p className="auth-page__error" role="alert">
          {error}
        </p>
      ) : (
        <p className="auth-page__hint">Завершаем вход...</p>
      )}
    </AuthLayout>
  );
}
