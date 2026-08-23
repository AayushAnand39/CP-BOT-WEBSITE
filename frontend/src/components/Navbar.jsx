import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { authUser, profile, logout } = useAuth();

  return (
    <header className="navbar">
      <Link to="/" className="brand">CP Bot</Link>

      <nav className="nav-links">
        {authUser ? (
          <>
            <Link to="/bots">Bots</Link>
            <Link to="/history">History</Link>
            <Link to="/admin/problems/import">Admin Problems</Link>
            <Link to="/profile">Profile</Link>

            <span className="rating-pill">
              {profile?.user?.rating ?? profile?.rating ?? 1200}
            </span>

            <button className="link-button" onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}
