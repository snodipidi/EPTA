import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

/**
 * Напоминание подтвердить почту. Рендерится только для залогиненного, но ещё не
 * верифицированного пользователя; иначе — ничего. Запись (посты, комментарии,
 * правки профиля) до подтверждения недоступна — об этом и сообщает баннер.
 */
export function VerifyEmailBanner() {
  const { user, isAuthenticated, bootstrapping } = useAuth();

  if (bootstrapping || !isAuthenticated || !user || user.emailVerified) {
    return null;
  }

  return (
    <div className="verify-banner" role="status">
      <span className="verify-banner__text">
        Подтвердите почту, чтобы публиковать посты и менять профиль.
      </span>
      <Link to="/verify-email" className="verify-banner__link">
        Подтвердить
      </Link>
    </div>
  );
}
