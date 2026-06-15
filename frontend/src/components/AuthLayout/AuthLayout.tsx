import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
  footerLink: {
    text: string;
    to: string;
  };
}

export function AuthLayout({ title, children, footerLink }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <div className="auth-page__logo">
        <Link to="/" className="auth-page__logo-link">
          ЕПТА
        </Link>
      </div>

      <div className="auth-page__form-wrap">
        <div className="auth-page__card">
          <h1 className="auth-page__title">{title}</h1>
          <div className="auth-page__body">{children}</div>
          <p className="auth-page__footer">
            <Link to={footerLink.to} className="auth-page__footer-link">
              {footerLink.text}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
