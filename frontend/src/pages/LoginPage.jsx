import { useState } from "react";
import {
  Link,
  useNavigate
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import ErrorBox from "../components/ErrorBox";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] =
    useState({
      email: "",
      password: ""
    });

  const [error, setError] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  function update(event) {
    setForm({
      ...form,
      [event.target.name]:
        event.target.value
    });
  }

  async function submit(event) {
    event.preventDefault();

    try {
      setError(null);
      setLoading(true);

      await login(form);

      navigate("/bots");
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <form
        className="auth-card"
        onSubmit={submit}
      >
        <h1>Login</h1>

        <ErrorBox error={error} />

        <label>
          Email
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={update}
            required
          />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={update}
            required
          />
        </label>

        <button
          className="primary-button"
          disabled={loading}
        >
          {loading
            ? "Logging in..."
            : "Login"}
        </button>

        <p>
          No account?{" "}
          <Link to="/register">
            Register
          </Link>
        </p>
      </form>
    </main>
  );
}
