import { Link } from "react-router-dom";
import { SearchIcon } from "../icons/Icons";

export function Header() {
  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="header__logo">
          ЕПТА
        </Link>

        <div className="header__search">
          <SearchIcon size={16} className="header__search-icon" />
          <input
            type="search"
            className="header__search-input"
            placeholder="поиск..."
            aria-label="Поиск"
          />
        </div>
      </div>
    </header>
  );
}
