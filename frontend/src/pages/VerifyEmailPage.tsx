import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout/AuthLayout";
import { resendCode, verifyEmail } from "../api/auth";
import { ApiError } from "../api/http";
import { useAuth } from "../auth/AuthContext";

/**
 * Подтверждение почты по 6-значному коду. Доступна залогиненному, но ещё не
 * верифицированному пользователю. Уже подтверждённого — уводим на главную.
 */
export function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, bootstrapping, refreshUser } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  // Не на этой странице, если не залогинен или уже подтверждён.
  useEffect(() => {
    if (bootstrapping) return;
    if (!isAuthenticated) {
      navigate("/login");
    } else if (user?.emailVerified) {
      navigate("/");
    }
  }, [bootstrapping, isAuthenticated, user?.emailVerified, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await verifyEmail(code.trim());
      await refreshUser(); // подтянуть emailVerified=true
      navigate("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Не удалось подтвердить код.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending) return;
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await resendCode();
      setInfo("Новый код отправлен на почту.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Не удалось отправить код.",
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout
      title="подтверждение почты"
      footerLink={{ text: "выйти", to: "/profile" }}
    >
      <p className="auth-page__hint">
        Мы отправили 6-значный код на {user?.email ?? "вашу почту"}. Введите его,
        чтобы публиковать посты и менять профиль.
      </p>
      <form className="auth-page__fields" onSubmit={handleSubmit}>
        {error && (
          <p className="auth-page__error" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="auth-page__info" role="status">
            {info}
          </p>
        )}
        <input
          className="auth-page__input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="код из письма"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          maxLength={6}
          required
        />
        <button
          className="auth-page__btn auth-page__btn--primary"
          type="submit"
          disabled={submitting || code.length !== 6}
        >
          {submitting ? "проверяем..." : "подтвердить"}
        </button>
      </form>
      <button
        type="button"
        className="auth-page__google-btn"
        onClick={handleResend}
        disabled={resending}
      >
        {resending ? "отправляем..." : "отправить код ещё раз"}
      </button>
    </AuthLayout>
  );
}
