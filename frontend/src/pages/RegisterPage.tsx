import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthDivider } from "../components/Auth/AuthDivider";
import { GoogleAuthButton } from "../components/Auth/GoogleAuthButton";
import { AuthLayout } from "../components/AuthLayout/AuthLayout";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/http";

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const handle = username.trim();
    try {
      await register({
        email: email.trim(),
        password,
        username: handle,
        // Отдельного поля для отображаемого имени в форме нет — берём юзернейм.
        displayName: handle,
      });
      navigate("/");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Не удалось зарегистрироваться. Попробуйте ещё раз.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogleRegister() {
    // OAuth — TBD (нет эндпоинта на бэкенде)
  }

  return (
    <AuthLayout title="регистрация" footerLink={{ text: "войти", to: "/login" }}>
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
          placeholder="пароль (минимум 8 символов)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <input
          className="auth-page__input"
          type="text"
          name="username"
          placeholder="юзернейм"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />
        <button
          className="auth-page__btn auth-page__btn--primary"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "регистрируем..." : "зарегаться"}
        </button>
      </form>
      <AuthDivider />
      <GoogleAuthButton onClick={handleGoogleRegister} label="зарегистрироваться через Google" />
    </AuthLayout>
  );
}
