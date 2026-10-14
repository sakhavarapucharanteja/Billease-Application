
import { useState } from "react";
import {
  adminApiFetch,
  saveAdminAuthToken,
} from "./api.js";
import "./AdminLogin.css";

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await adminApiFetch("/admin/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.token) {
        throw new Error(data.message || "Admin login failed.");
      }

      if (data.admin?.role !== "platformAdmin") {
        throw new Error("This account is not a platform administrator.");
      }

      saveAdminAuthToken(data.token);
      onLogin(data.admin);
    } catch (err) {
      setError(err.message || "Could not log in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="admin-login-logo">B</div>

        <div className="admin-login-brand">
          <h1>BillEase</h1>
          <p>Platform administration</p>
        </div>

        <div className="admin-login-heading">
          <h2>Admin sign in</h2>
          <p>Sign in to manage business registrations and approvals.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="admin-email">Admin email</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            placeholder="Enter your admin email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && (
            <div className="admin-login-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in securely"}
          </button>
        </form>

        <p className="admin-login-security">
          Restricted access for authorized BillEase administrators.
        </p>
      </section>
    </main>
  );
}
