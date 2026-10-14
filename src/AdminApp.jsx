
import { useEffect, useState } from "react";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";
import {
  adminApiFetch,
  getAdminAuthToken,
  clearAdminAuthToken,
} from "./api.js";

export default function AdminApp() {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkAdminSession() {
      const token = getAdminAuthToken();

      if (!token) {
        if (!cancelled) setChecking(false);
        return;
      }

      try {
        const response = await adminApiFetch(
          "/admin/businesses?status=pending"
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error("Admin session is invalid.");
        }

        if (!cancelled) {
          setAdmin({
            name: "BillEase Administrator",
            email: "",
            role: "platformAdmin",
          });
        }
      } catch {
        clearAdminAuthToken();
        if (!cancelled) setAdmin(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    checkAdminSession();

    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <main className="admin-login-page">
        <section className="admin-login-card" role="status">
          Checking administrator session...
        </section>
      </main>
    );
  }

  if (!admin) {
    return <AdminLogin onLogin={setAdmin} />;
  }

  return (
    <AdminDashboard
      admin={admin}
      onLogout={() => setAdmin(null)}
    />
  );
}
