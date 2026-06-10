import { Link } from "react-router-dom";
import { BellIcon, SearchIcon, UserIcon } from "../icons/Icons";
import "./Header.css";

export function Header() {
  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="header__logo">
          ЕПТА
        </Link>

        <div className="header__toolbar">
          <div className="header__search">
            <SearchIcon size={16} className="header__search-icon" />
            <input
              type="search"
              className="header__search-input"
              placeholder="поиск..."
              aria-label="Поиск"
            />
          </div>

          <div className="header__actions">
            <Link to="/notifications" className="header__action-btn" aria-label="Уведомления">
              <BellIcon size={20} />
            </Link>
            <Link to="/profile" className="header__action-btn" aria-label="Профиль">
              <UserIcon size={20} />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
