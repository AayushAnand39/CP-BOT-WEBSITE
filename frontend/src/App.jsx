import {
  BrowserRouter,
  Route,
  Routes
} from "react-router-dom";

import {
  AuthProvider
} from "./context/AuthContext";

import ProtectedRoute from "./routes/ProtectedRoute";
import Navbar from "./components/Navbar";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import BotsPage from "./pages/BotsPage";
import ChallengePage from "./pages/ChallengePage";
import ContestPage from "./pages/ContestPage";
import ResultPage from "./pages/ResultPage";
import ProfilePage from "./pages/ProfilePage";
import HistoryPage from "./pages/HistoryPage";
import AdminProblemImportPage from "./pages/AdminProblemImportPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />

        <Routes>
          <Route
            path="/"
            element={<HomePage />}
          />

          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route
            path="/register"
            element={<RegisterPage />}
          />

          <Route
            path="/bots"
            element={
              <ProtectedRoute>
                <BotsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/challenge/:challengeId"
            element={
              <ProtectedRoute>
                <ChallengePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/contest/:contestId"
            element={
              <ProtectedRoute>
                <ContestPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/result/:id"
            element={
              <ProtectedRoute>
                <ResultPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/problems/import"
            element={
              <ProtectedRoute>
                <AdminProblemImportPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
