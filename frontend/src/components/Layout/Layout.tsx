import type { ReactNode } from "react";
import { Header } from "../Header/Header";
import { Sidebar } from "../Sidebar/Sidebar";
import "./Layout.css";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <Header />
      <div className="layout__container">
        <div className="layout__body">
          <Sidebar />
          <main className="layout__content">{children}</main>
        </div>
      </div>
    </div>
  );
}
