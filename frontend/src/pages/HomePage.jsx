import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { authUser } = useAuth();

  return (
    <main className="hero">
      <div className="hero-content">
        <span className="eyebrow">
          Competitive Programming
        </span>

        <h1>
          Challenge bots.
          <br />
          Improve your rating.
        </h1>

        <p>
          Play deterministic contests
          against bots of different
          competitive-programming ratings.
        </p>

        <Link
          className="primary-button hero-button"
          to={
            authUser
              ? "/bots"
              : "/register"
          }
        >
          {authUser
            ? "Choose a Bot"
            : "Get Started"}
        </Link>
      </div>
    </main>
  );
}
