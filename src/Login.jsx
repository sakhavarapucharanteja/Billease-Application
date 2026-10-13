import { useState } from "react";
import { apiFetch } from "./api.js";
import "./Login.css";

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint =
        mode === "login" ? "/auth/login" : "/auth/register";

      const body =
        mode === "login"
          ? {
              email: email.trim().toLowerCase(),
              password,
            }
          : {
              name: name.trim(),
              ownerName: name.trim(),
              businessName: businessName.trim(),
              email: email.trim().toLowerCase(),
              password,
            };

      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Authentication failed.");
      }

      if (!data.token || !data.user) {
        throw new Error("The server did not return a valid login session.");
      }

      onLogin(data.token, {
        ...data.user,
        business: data.business || data.user.business,
      });
    } catch (err) {
      setError(
        err.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo">B</div>
          <h1>BillEase</h1>
          <p>Simple billing. Smarter business.</p>
        </div>

        <div className="login-heading">
          <h2>
            {mode === "login"
              ? "Welcome back"
              : "Create your business account"}
          </h2>
          <p>
            {mode === "login"
              ? "Sign in to manage your billing and inventory."
              : "Set up your own workspace to get started."}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <label htmlFor="login-name">Your name</label>
              <input
                id="login-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                autoComplete="name"
                required
              />

              <label htmlFor="business-name">Business name</label>
              <input
                id="business-name"
                type="text"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Enter your business name"
                autoComplete="organization"
                required
              />
            </>
          )}

          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete={
              mode === "login"
                ? "current-password"
                : "new-password"
            }
            minLength={mode === "register" ? 8 : undefined}
            required
          />

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button
            className="login-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="login-switch">
          {mode === "login"
            ? "New to BillEase?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode((current) =>
                current === "login" ? "register" : "login"
              );
              setError("");
            }}
          >
            {mode === "login"
              ? "Create an account"
              : "Sign in"}
          </button>
        </p>

        <p className="login-security">
          Your business workspace is protected by authentication.
        </p>
      </section>
    </main>
  );
}
