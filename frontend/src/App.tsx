import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout/Layout";
import { HomePage } from "./pages/HomePage";
import { ProfilePage } from "./pages/ProfilePage";
import { StubPage } from "./pages/StubPage";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/feeds" element={<StubPage title="Ленты" />} />
        <Route path="/chats" element={<StubPage title="Чаты" />} />
        <Route path="/notifications" element={<StubPage title="Уведомления" />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<StubPage title="Настройки" />} />
        <Route path="/faq" element={<StubPage title="FAQ" />} />
        <Route path="/subscription" element={<StubPage title="Подписка" />} />
      </Routes>
    </Layout>
  );
}

export default App;
