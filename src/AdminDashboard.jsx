
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
  Pencil,
  X,
  Save,
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./AdminDashboard.css";

const FILTERS = [
  { value: "pending", label: "Pending", icon: Clock3 },
  { value: "active", label: "Approved", icon: CheckCircle2 },
  { value: "rejected", label: "Rejected", icon: XCircle },
  { value: "suspended", label: "Suspended", icon: ShieldCheck },
];

const EMPTY_FORM = {
  name: "",
  ownerName: "",
  email: "",
  phone: "",
};

export default function AdminDashboard({ admin, onLogout }) {
  const [status, setStatus] = useState("pending");
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadBusinesses = useCallback(async () => {
    setLoading(true);

    try {
      const response = await adminApiFetch(
        `/admin/businesses?status=${encodeURIComponent(status)}`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load businesses.");
      }

      setBusinesses(
        Array.isArray(data.businesses) ? data.businesses : []
      );
    } catch (err) {
      toast.error(err.message || "Could not load business registrations.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadBusinesses();
  }, [loadBusinesses]);

  function getOwner(business) {
    return (
      (business.owners || []).find((item) => item.role === "owner") ||
      (business.owners || [])[0] ||
      {}
    );
  }

  function startEditing(business) {
    const owner = getOwner(business);

    setEditingBusiness(business);
    setForm({
      name: business.name || "",
      ownerName: owner.name || "",
      email: owner.email || "",
      phone: business.phone || "",
    });
  }

  function closeEditor() {
    if (saving) return;
    setEditingBusiness(null);
    setForm(EMPTY_FORM);
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveBusiness(event) {
    event.preventDefault();

    if (!editingBusiness) return;

    setSaving(true);

    try {
      const response = await adminApiFetch(
        `/admin/businesses/${editingBusiness._id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name.trim(),
            ownerName: form.ownerName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not update business details.");
      }

      setEditingBusiness(null);
      setForm(EMPTY_FORM);
      toast.success("Business details updated successfully.");
      await loadBusinesses();
    } catch (err) {
      toast.error(err.message || "Could not save business details.");
    } finally {
      setSaving(false);
    }
  }

  async function updateBusiness(business, action) {
    const actionLabel = action === "approve" ? "approve" : "reject";

    setWorkingId(String(business._id));

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
        throw new Error(
          data.message || `Could not ${actionLabel} business.`
        );
      }

      toast.dismiss();
      toast.success(
        action === "approve"
          ? `${business.name} approved successfully!`
          : `${business.name} rejected successfully!`
      );

      await loadBusinesses();
    } catch (err) {
      toast.error(err.message || `Could not ${actionLabel} this business.`);
    } finally {
      setWorkingId("");
    }
  }


async function changeBusinessStatus(business, newStatus) {
  const action = newStatus === "suspended" ? "suspend" : "activate";

  setWorkingId(String(business._id));

  try {
    const response = await adminApiFetch(
      `/admin/businesses/${business._id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || `Could not ${action} business.`);
    }

    toast.dismiss();
    toast.success(
      newStatus === "suspended"
        ? `${business.name} has been suspended.`
        : `${business.name} has been activated.`
    );

    await loadBusinesses();
  } catch (err) {
    toast.error(err.message || `Could not ${action} this business.`);
  } finally {
    setWorkingId("");
  }
}

function confirmStatusChange(business, newStatus) {
  const suspending = newStatus === "suspended";

  toast.dismiss();

  toast(
    ({ closeToast }) => (
      <div className="billease-confirm-content">
        <div
          className={`billease-confirm-icon ${
            suspending ? "reject" : "approve"
          }`}
        >
          {suspending ? (
            <ShieldCheck size={30} />
          ) : (
            <CheckCircle2 size={30} />
          )}
        </div>

        <h3>{suspending ? "Suspend business?" : "Activate business?"}</h3>

        <p className="billease-confirm-business">{business.name}</p>

        <p className="billease-confirm-description">
          {suspending
            ? "The business owner will lose access to the BillEase workspace until the business is reactivated."
            : "The business owner will regain access to the BillEase workspace."}
        </p>

        <div className="billease-confirm-buttons">
          <button
            type="button"
            className="billease-confirm-cancel"
            onClick={closeToast}
          >
            Cancel
          </button>

          <button
            type="button"
            className={
              suspending
                ? "billease-confirm-reject"
                : "billease-confirm-approve"
            }
            onClick={() => {
              closeToast();
              changeBusinessStatus(business, newStatus);
            }}
          >
            {suspending ? "Yes, suspend" : "Yes, activate"}
          </button>
        </div>
      </div>
    ),
    {
      position: "top-center",
      autoClose: false,
      closeOnClick: false,
      draggable: false,
      closeButton: false,
      className: "billease-confirm-toast",
    }
  );
}


function confirmBusinessAction(business, action) {
  const approving = action === "approve";

  toast.dismiss();

  toast(
    ({ closeToast }) => (
      <div className="billease-confirm-content">
        <div
          className={`billease-confirm-icon ${
            approving ? "approve" : "reject"
          }`}
        >
          {approving ? (
            <CheckCircle2 size={30} />
          ) : (
            <XCircle size={30} />
          )}
        </div>

        <h3>
          {approving ? "Approve this business?" : "Reject registration?"}
        </h3>

        <p className="billease-confirm-business">
          {business.name}
        </p>

        <p className="billease-confirm-description">
          {approving
            ? "Approving this business will allow its owner to sign in and access the BillEase workspace."
            : "Rejecting this registration will prevent the business owner from accessing the workspace."}
        </p>

        <div className="billease-confirm-buttons">
          <button
            type="button"
            className="billease-confirm-cancel"
            onClick={closeToast}
          >
            Cancel
          </button>

          <button
            type="button"
            className={
              approving
                ? "billease-confirm-approve"
                : "billease-confirm-reject"
            }
            onClick={() => {
              closeToast();
              updateBusiness(business, action);
            }}
          >
            {approving ? "Confirm approval" : "Confirm rejection"}
          </button>
        </div>
      </div>
    ),
    {
      position: "top-center",
      autoClose: false,
      closeOnClick: false,
      draggable: false,
      closeButton: false,
      className: "billease-confirm-toast",
    }
  );
}


  function handleLogout() {
    clearAdminAuthToken();
    onLogout();
  }

  return (
    <main className="admin-dashboard">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="light"
      />

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
              onClick={() => setStatus(value)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

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
                    <th>Phone</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((business) => {
                    const owner = getOwner(business);

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
                        <td>{owner.name || "—"}</td>
                        <td>{owner.email || "—"}</td>
                        <td>{business.phone || "—"}</td>
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
                        <td>
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              className="admin-edit"
                              onClick={() => startEditing(business)}
                              disabled={Boolean(workingId) || saving}
                            >
                              <Pencil size={15} />
                              Edit
                            </button>

                            {(status === "active" || status === "suspended") && (
                            <button
                                type="button"
                                className={
                                status === "active"
                                    ? "admin-suspend"
                                    : "admin-activate"
                                }
                                onClick={() =>
                                confirmStatusChange(
                                    business,
                                    status === "active" ? "suspended" : "active"
                                )
                                }
                                disabled={Boolean(workingId) || saving}
                            >
                                {status === "active" ? (
                                <>
                                    <ShieldCheck size={15} />
                                    Suspend
                                </>
                                ) : (
                                <>
                                    <CheckCircle2 size={15} />
                                    Activate
                                </>
                                )}
                            </button>
                            )}

                            {status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  className="admin-approve"
                                  onClick={() =>
                                    confirmBusinessAction(business, "approve")
                                  }
                                  disabled={Boolean(workingId) || saving}
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
                                    confirmBusinessAction(business, "reject")
                                  }
                                  disabled={Boolean(workingId) || saving}
                                >
                                  <XCircle size={15} />
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
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

      {editingBusiness && (
        <div
          className="admin-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
          <section
            className="admin-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-edit-title"
          >
            <div className="admin-modal-heading">
              <div>
                <span className="admin-eyebrow">BUSINESS MANAGEMENT</span>
                <h2 id="admin-edit-title">Edit business details</h2>
                <p>Update the business and owner information.</p>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={closeEditor}
                disabled={saving}
                aria-label="Close edit form"
              >
                <X size={20} />
              </button>
            </div>

            <form className="admin-edit-form" onSubmit={saveBusiness}>
              <label>
                Business name
                <input
                  name="name"
                  value={form.name}
                  onChange={updateForm}
                  maxLength={150}
                  required
                />
              </label>

              <label>
                Owner name
                <input
                  name="ownerName"
                  value={form.ownerName}
                  onChange={updateForm}
                  maxLength={100}
                  required
                />
              </label>

              <label>
                Owner email
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={updateForm}
                  maxLength={150}
                  required
                />
              </label>

              <label>
                Phone number
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={updateForm}
                  maxLength={20}
                  placeholder="Enter business phone number"
                />
              </label>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-cancel"
                  onClick={closeEditor}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-save"
                  disabled={saving}
                >
                  <Save size={16} />
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}