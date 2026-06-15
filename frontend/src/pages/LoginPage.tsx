import { type FormEvent, useState } from "react";
import { AuthDivider } from "../components/Auth/AuthDivider";
import { GoogleAuthButton } from "../components/Auth/GoogleAuthButton";
import { AuthLayout } from "../components/AuthLayout/AuthLayout";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function handleGoogleLogin() {
    // OAuth — TBD
  }

  return (
    <AuthLayout title="вход" footerLink={{ text: "зарегаться", to: "/register" }}>
      <form className="auth-page__fields" onSubmit={handleSubmit}>
        <input
          className="auth-page__input"
          type="email"
          name="email"
          placeholder="почта"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
        <input
          className="auth-page__input"
          type="password"
          name="password"
          placeholder="пароль"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
        <button className="auth-page__btn auth-page__btn--primary" type="submit">
          войти
        </button>
      </form>
      <AuthDivider />
      <GoogleAuthButton onClick={handleGoogleLogin} />
    </AuthLayout>
  );
}
