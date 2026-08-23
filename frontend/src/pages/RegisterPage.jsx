import { useState } from "react";
import {
  Link,
  useNavigate
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import ErrorBox from "../components/ErrorBox";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] =
    useState({
      email: "",
      password: "",
      username: "",
      displayName: ""
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
      setLoading(true);
      setError(null);

      await register({
        email: form.email,
        password: form.password,
        username: form.username,
        ...(form.displayName
          ? {
              displayName:
                form.displayName
            }
          : {})
      });

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
        <h1>Create account</h1>

        <ErrorBox error={error} />

        <label>
          Username
          <input
            name="username"
            value={form.username}
            onChange={update}
            minLength={3}
            maxLength={20}
            required
          />
        </label>

        <label>
          Display name
          <input
            name="displayName"
            value={form.displayName}
            onChange={update}
            maxLength={80}
          />
        </label>

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
            minLength={8}
            required
          />
        </label>

        <button
          className="primary-button"
          disabled={loading}
        >
          {loading
            ? "Creating..."
            : "Create Account"}
        </button>

        <p>
          Already registered?{" "}
          <Link to="/login">
            Login
          </Link>
        </p>
      </form>
    </main>
  );
}
