import { type FormEvent, useState } from "react";
import { AuthDivider } from "../components/Auth/AuthDivider";
import { GoogleAuthButton } from "../components/Auth/GoogleAuthButton";
import { AuthLayout } from "../components/AuthLayout/AuthLayout";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function handleGoogleRegister() {
    // OAuth — TBD
  }

  return (
    <AuthLayout title="регистрация" footerLink={{ text: "войти", to: "/login" }}>
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
          autoComplete="new-password"
        />
        <input
          className="auth-page__input"
          type="text"
          name="username"
          placeholder="юзернейм"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />
        <button className="auth-page__btn auth-page__btn--primary" type="submit">
          зарегаться
        </button>
      </form>
      <AuthDivider />
      <GoogleAuthButton onClick={handleGoogleRegister} label="зарегистрироваться через Google" />
    </AuthLayout>
  );
}
