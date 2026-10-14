
import { useState } from "react";
import { apiFetch } from "./api.js";
import { CheckCircle2, Clock3, Building2 } from "lucide-react";
import "./Login.css";

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registrationSubmitted, setRegistrationSubmitted] =
    useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const isLogin = mode === "login";
      const endpoint = isLogin ? "/auth/login" : "/auth/register";

      const body = isLogin
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

      // Registration does not create a login session.
      // The platform administrator must approve the business first.
      if (!isLogin) {
        setRegistrationSubmitted(true);
        setPassword("");
        return;
      }

      // Login must return a valid authenticated session.
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

  if (registrationSubmitted) {
    return (
      <main className="login-page">
        <section className="login-card registration-success">
          <div className="login-brand">
            <div className="login-logo">B</div>
            <h1>BillEase</h1>
            <p>Simple billing. Smarter business.</p>
          </div>

          <div className="registration-success-icon">
            <CheckCircle2 size={42} />
          </div>

          <div className="registration-success-heading">
            <h2>Registration successful!</h2>
            <p>Your business account has been submitted for approval.</p>
          </div>

          <div className="registration-status">
            <Clock3 size={22} />
            <div>
              <strong>Awaiting administrator approval</strong>
              <p>
                Your business workspace is pending review. You can sign in
                after the administrator approves your registration.
              </p>
            </div>
          </div>

          <div className="registration-business">
            <Building2 size={19} />
            <div>
              <span>Business</span>
              <strong>{businessName}</strong>
            </div>
          </div>

          <div className="registration-email">
            <span>Registered email</span>
            <strong>{email.trim().toLowerCase()}</strong>
          </div>

          <button
            className="login-submit"
            type="button"
            onClick={() => {
              setRegistrationSubmitted(false);
              setMode("login");
              setName("");
              setBusinessName("");
              setPassword("");
              setError("");
            }}
          >
            Go to sign in
          </button>

          <p className="login-security">
            Your account remains restricted until approval is granted.
          </p>
        </section>
      </main>
    );
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
                maxLength={100}
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
                maxLength={150}
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
              mode === "login" ? "current-password" : "new-password"
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
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>

        <p className="login-security">
          Your business workspace is protected by authentication.
        </p>
      </section>
    </main>
  );
}
