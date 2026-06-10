import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout/Layout";
import { HomePage } from "./pages/HomePage";
import { StubPage } from "./pages/StubPage";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/feeds" element={<StubPage title="Ленты" />} />
        <Route path="/chats" element={<StubPage title="Чаты" />} />
        <Route path="/tops" element={<StubPage title="Топы" />} />
        <Route path="/notifications" element={<StubPage title="Уведомления" />} />
        <Route path="/profile" element={<StubPage title="Профиль" />} />
      </Routes>
    </Layout>
  );
}

export default App;
