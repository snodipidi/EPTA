import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Header } from "../Header/Header";
import { MobileBottomNav } from "../MobileBottomNav/MobileBottomNav";
import { Sidebar } from "../Sidebar/Sidebar";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  return (
    <div className="layout">
      <Header />

      {menuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="layout__container">
        {/* Desktop sidebar — скрыт на мобильном через CSS (position: fixed + transform) */}
        <Sidebar
          className={menuOpen ? "sidebar--open" : undefined}
          onNavigate={() => setMenuOpen(false)}
        />
        <div className="layout__body">
          <main className="layout__content">{children}</main>
        </div>
      </div>

      <MobileBottomNav
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((open) => !open)}
      />
    </div>
  );
}
