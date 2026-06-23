import { NavLink } from "react-router-dom";
import { CloseIcon, BellIcon, HomeIcon, MenuIcon, UserIcon } from "../icons/Icons";

interface MobileBottomNavProps {
  menuOpen: boolean;
  onMenuToggle: () => void;
}

const LINK_ITEMS = [
  { to: "/", label: "Главная", end: true, Icon: HomeIcon },
  { to: "/notifications", label: "Уведомления", end: false, Icon: BellIcon },
  { to: "/profile", label: "Профиль", end: false, Icon: UserIcon },
] as const;

export function MobileBottomNav({ menuOpen, onMenuToggle }: MobileBottomNavProps) {
  return (
    <nav className="mobile-nav" aria-label="Мобильная навигация">
      <button
        type="button"
        className={`mobile-nav__item${menuOpen ? " mobile-nav__item--active" : ""}`}
        aria-label="Меню"
        aria-expanded={menuOpen}
        onClick={onMenuToggle}
      >
        {menuOpen ? <CloseIcon size={22} /> : <MenuIcon size={24} />}
      </button>

      {LINK_ITEMS.map(({ to, label, end, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `mobile-nav__item${isActive ? " mobile-nav__item--active" : ""}`
          }
          aria-label={label}
        >
          <Icon size={24} />
        </NavLink>
      ))}
    </nav>
  );
}
