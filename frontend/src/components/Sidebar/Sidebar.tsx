import { NavLink } from "react-router-dom";
import { mockTopUsers } from "../../data/mockTopUsers";
import { AvatarIcon } from "../icons/Icons";

const NAV_ITEMS = [
  { label: "Профиль", to: "/profile" },
  { label: "Уведомления", to: "/notifications" },
  { label: "Ленты", to: "/feeds" },
  { label: "Чаты", to: "/chats" },
  { label: "Настройки", to: "/settings" },
  { label: "FAQ", to: "/faq" },
  { label: "Подписка", to: "/subscription" },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  return (
    <aside className={className ? `sidebar ${className}` : "sidebar"}>
      {/* Шапка — видна только в мобильном drawer */}
      <div className="sidebar__mobile-header">
        <span className="sidebar__mobile-logo">ЕПТА</span>
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `sidebar__link${isActive ? " sidebar__link--active" : ""}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__tops">
        <h2 className="sidebar__tops-title">Топы</h2>
        <ul className="sidebar__tops-list">
          {mockTopUsers.map((user) => (
            <li key={user.id} className="sidebar__tops-item">
              <span className="sidebar__tops-rank">{user.rank}</span>
              <div className="sidebar__tops-avatar">
                <AvatarIcon size={28} />
              </div>
              <div className="sidebar__tops-info">
                <span className="sidebar__tops-name">{user.displayName}</span>
                <span className="sidebar__tops-handle">@{user.username}</span>
              </div>
              <span className="sidebar__tops-score">{user.score}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
