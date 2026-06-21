import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout/Layout";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { StubPage } from "./pages/StubPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/*"
        element={
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
        }
      />
    </Routes>
  );
}

export default App;
