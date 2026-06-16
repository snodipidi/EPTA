import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthDivider } from "../components/Auth/AuthDivider";
import { GoogleAuthButton } from "../components/Auth/GoogleAuthButton";
import { AuthLayout } from "../components/AuthLayout/AuthLayout";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/http";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Не удалось войти. Попробуйте ещё раз.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogleLogin() {
    // OAuth — TBD (нет эндпоинта на бэкенде)
  }

  return (
    <AuthLayout title="вход" footerLink={{ text: "зарегаться", to: "/register" }}>
      <form className="auth-page__fields" onSubmit={handleSubmit}>
        {error && (
          <p className="auth-page__error" role="alert">
            {error}
          </p>
        )}
        <input
          className="auth-page__input"
          type="email"
          name="email"
          placeholder="почта"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
        <input
          className="auth-page__input"
          type="password"
          name="password"
          placeholder="пароль"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
        <button
          className="auth-page__btn auth-page__btn--primary"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "входим..." : "войти"}
        </button>
      </form>
      <AuthDivider />
      <GoogleAuthButton onClick={handleGoogleLogin} />
    </AuthLayout>
  );
}
