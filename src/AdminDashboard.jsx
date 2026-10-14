
import { useCallback, useEffect, useState } from "react";
import {
  adminApiFetch,
  clearAdminAuthToken,
} from "./api.js";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Clock3,
  RefreshCw,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import "./AdminDashboard.css";

const FILTERS = [
  { value: "pending", label: "Pending", icon: Clock3 },
  { value: "active", label: "Approved", icon: CheckCircle2 },
  { value: "rejected", label: "Rejected", icon: XCircle },
  { value: "suspended", label: "Suspended", icon: ShieldCheck },
];

export default function AdminDashboard({ admin, onLogout }) {
  const [status, setStatus] = useState("pending");
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await adminApiFetch(
        `/admin/businesses?status=${encodeURIComponent(status)}`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load businesses.");
      }

      setBusinesses(Array.isArray(data.businesses) ? data.businesses : []);
    } catch (err) {
      setError(err.message || "Could not load business registrations.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadBusinesses();
  }, [loadBusinesses]);

  async function updateBusiness(business, action) {
    const actionLabel = action === "approve" ? "approve" : "reject";

    if (
      !window.confirm(
        `Are you sure you want to ${actionLabel} "${business.name}"?`
      )
    ) {
      return;
    }

    setWorkingId(String(business._id));
    setError("");
    setNotice("");

    try {
      const response = await adminApiFetch(
        `/admin/businesses/${business._id}/${action}`,
        {
          method: "PATCH",
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || `Could not ${actionLabel} business.`);
      }

      setNotice(
        action === "approve"
          ? `${business.name} has been approved.`
          : `${business.name} has been rejected.`
      );

      await loadBusinesses();
    } catch (err) {
      setError(err.message || `Could not ${actionLabel} this business.`);
    } finally {
      setWorkingId("");
    }
  }

  function handleLogout() {
    clearAdminAuthToken();
    onLogout();
  }

  return (
    <main className="admin-dashboard">
      <header className="admin-topbar">
        <div className="admin-brand">
          <div className="admin-brand-icon">
            <Building2 size={23} />
          </div>
          <div>
            <h1>BillEase Admin</h1>
            <p>Business approval center</p>
          </div>
        </div>

        <div className="admin-account">
          <div className="admin-account-details">
            <strong>{admin?.name || "Administrator"}</strong>
            <span>{admin?.email || ""}</span>
          </div>
          <button
            type="button"
            className="admin-logout"
            onClick={handleLogout}
          >
            <LogOut size={17} />
            <span>Log out</span>
          </button>
        </div>
      </header>

      <section className="admin-content">
        <div className="admin-welcome">
          <div>
            <span className="admin-eyebrow">ADMINISTRATION</span>
            <h2>Business registrations</h2>
            <p>Review applications and manage access to BillEase.</p>
          </div>

          <button
            type="button"
            className="admin-refresh"
            onClick={loadBusinesses}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <nav className="admin-filters" aria-label="Business status filters">
          {FILTERS.map(({ value, label, icon: Icon }) => (
            <button
              type="button"
              key={value}
              className={`admin-filter ${status === value ? "selected" : ""}`}
              onClick={() => {
                setStatus(value);
                setNotice("");
                setError("");
              }}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        {notice && (
          <div className="admin-alert success" role="status">
            <CheckCircle2 size={18} />
            {notice}
          </div>
        )}

        {error && (
          <div className="admin-alert error" role="alert">
            <XCircle size={18} />
            {error}
          </div>
        )}

        <section className="admin-business-panel">
          <div className="admin-panel-heading">
            <div>
              <h3>
                {FILTERS.find((item) => item.value === status)?.label} businesses
              </h3>
              <p>Business owner and registration information</p>
            </div>
            <span className="admin-count">
              {loading ? "Loading..." : `${businesses.length} shown`}
            </span>
          </div>

          {loading ? (
            <div className="admin-empty">
              <RefreshCw size={23} />
              <p>Loading business registrations...</p>
            </div>
          ) : businesses.length === 0 ? (
            <div className="admin-empty">
              <Building2 size={30} />
              <strong>No businesses found</strong>
              <p>There are no businesses with this status yet.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Owner</th>
                    <th>Email</th>
                    <th>Registered</th>
                    {status === "pending" && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((business) => {
                    const owner = (business.owners || []).find(
                      (item) => item.role === "owner"
                    ) || (business.owners || [])[0];

                    return (
                      <tr key={business._id}>
                        <td>
                          <div className="admin-business-name">
                            <div className="admin-business-avatar">
                              {(business.name || "B")
                                .trim()
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div>
                              <strong>{business.name || "Unnamed business"}</strong>
                              <span className={`admin-status ${business.status}`}>
                                {business.status || "unknown"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>{owner?.name || "—"}</td>
                        <td>{owner?.email || "—"}</td>
                        <td>
                          {business.approvalRequestedAt || business.createdAt
                            ? new Date(
                                business.approvalRequestedAt ||
                                  business.createdAt
                              ).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        {status === "pending" && (
                          <td>
                            <div className="admin-row-actions">
                              <button
                                type="button"
                                className="admin-approve"
                                onClick={() =>
                                  updateBusiness(business, "approve")
                                }
                                disabled={Boolean(workingId)}
                              >
                                <CheckCircle2 size={15} />
                                {workingId === String(business._id)
                                  ? "Working..."
                                  : "Approve"}
                              </button>
                              <button
                                type="button"
                                className="admin-reject"
                                onClick={() =>
                                  updateBusiness(business, "reject")
                                }
                                disabled={Boolean(workingId)}
                              >
                                <XCircle size={15} />
                                Reject
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="admin-footer-note">
          <ShieldCheck size={15} />
          Only authorized platform administrators can manage business approvals.
        </p>
      </section>
    </main>
  );
}
