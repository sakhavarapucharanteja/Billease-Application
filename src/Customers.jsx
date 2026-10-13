import { useEffect, useMemo, useState } from "react";
import {
  Search, Plus, Users, Phone, Mail, MapPin, Pencil, Trash2, X,
  UserRound, RefreshCw, ArrowLeft, ReceiptText, ShoppingBag, IndianRupee,
  CalendarDays, Eye, CreditCard,
} from "lucide-react";
import { apiFetch } from "./api";
import "./Customers.css";

const API_URL = "/customers";
const SALES_URL = "/sales";

const emptyForm = { name: "", mobile: "", email: "", address: "" };
const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

function saleTotal(sale) {
  if (sale.total !== undefined && sale.total !== null) return Number(sale.total) || 0;
  return (sale.items || []).reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0),
    0
  );
}

function saleDate(sale) {
  const raw = sale.createdAt || sale.date;
  if (!raw) return "Date unavailable";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleString("en-IN");
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState("");

  async function loadCustomers(showSpinner = true) {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const response = await apiFetch(API_URL);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load customers.");
      }
      setCustomers(data.customers || []);
    } catch (err) {
      setError(err.message || "Could not connect to the backend.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.mobile, customer.email, customer.address].some(
        (value) => String(value || "").toLowerCase().includes(term)
      )
    );
  }, [customers, search]);

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEditModal(customer) {
    setEditingId(customer.id);
    setForm({
      name: customer.name || "",
      mobile: customer.mobile || "",
      email: customer.email || "",
      address: customer.address || "",
    });
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const cleanMobile = form.mobile.trim();
    if (!form.name.trim()) {
      setError("Enter the customer name.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    setSaving(true);
    try {
      const isEditing = editingId !== null;
      const response = await apiFetch(
        isEditing ? `${API_URL}/${editingId}` : API_URL,
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            mobile: cleanMobile,
            email: form.email.trim(),
            address: form.address.trim(),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not save customer.");
      }
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setNotice(isEditing ? "Customer updated successfully." : "Customer added successfully.");
      await loadCustomers(false);
      if (selectedCustomer && String(selectedCustomer.id) === String(editingId)) {
        setSelectedCustomer(data.customer || { ...selectedCustomer, ...form, mobile: cleanMobile });
      }
    } catch (err) {
      setError(err.message || "Could not save customer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customer) {
    const confirmed = window.confirm(
      `Delete customer "${customer.name}"? This will not delete their past invoices.`
    );
    if (!confirmed) return;
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(`${API_URL}/${customer.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not delete customer.");
      }
      setCustomers((previous) => previous.filter((item) => item.id !== customer.id));
      if (selectedCustomer && String(selectedCustomer.id) === String(customer.id)) {
        setSelectedCustomer(null);
      }
      setNotice("Customer deleted successfully.");
    } catch (err) {
      setError(err.message || "Could not delete customer.");
    }
  }

  async function openCustomerDetails(customer) {
    setSelectedCustomer(customer);
    setSales([]);
    setSalesLoading(true);
    setSalesError("");
    try {
      const response = await apiFetch(SALES_URL);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load order history.");
      }
      setSales(data.sales || []);
    } catch (err) {
      setSalesError(err.message || "Could not load order history.");
    } finally {
      setSalesLoading(false);
    }
  }

  const customerSales = useMemo(() => {
    if (!selectedCustomer) return [];
    const mobile = String(selectedCustomer.mobile || "").replace(/\D/g, "");
    return sales
      .filter((sale) => {
        const saleMobile = String(sale.mobile || sale.customerMobile || "").replace(/\D/g, "");
        return mobile && saleMobile === mobile;
      })
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || a.date || 0).getTime() || 0;
        const dateB = new Date(b.createdAt || b.date || 0).getTime() || 0;
        return dateB - dateA;
      });
  }, [sales, selectedCustomer]);

  const totalSpent = customerSales.reduce((sum, sale) => sum + saleTotal(sale), 0);
  const lastPurchase = customerSales[0];

  if (selectedCustomer) {
    return (
      <div className="customers-page customer-profile-page">
        <div className="customers-heading">
          <div>
            <button
              type="button"
              className="customer-back-btn"
              onClick={() => { setSelectedCustomer(null); setSalesError(""); }}
            >
              <ArrowLeft size={17} /> Back to Customers
            </button>
            <h1>Customer Profile</h1>
            <p>Customer details and purchase history.</p>
          </div>
          <button className="customer-primary-btn" onClick={() => openEditModal(selectedCustomer)}>
            <Pencil size={17} /> Edit Customer
          </button>
        </div>

        {notice && <div className="customer-alert customer-alert-success">{notice}</div>}
        {error && !modalOpen && <div className="customer-alert customer-alert-error">{error}</div>}

        <section className="customer-profile-card">
          <div className="customer-profile-identity">
            <div className="customer-profile-avatar">
              {selectedCustomer.name?.charAt(0)?.toUpperCase() || "C"}
            </div>
            <div>
              <h2>{selectedCustomer.name}</h2>
              <p>Customer #{selectedCustomer.id}</p>
            </div>
          </div>
          <div className="customer-profile-contact-grid">
            <div><Phone size={17} /><span><small>Mobile number</small><strong>{selectedCustomer.mobile || "Not provided"}</strong></span></div>
            <div><Mail size={17} /><span><small>Email address</small><strong>{selectedCustomer.email || "Not provided"}</strong></span></div>
            <div><MapPin size={17} /><span><small>Address</small><strong>{selectedCustomer.address || "Not provided"}</strong></span></div>
          </div>
        </section>

        <div className="customer-purchase-stats">
          <div className="customer-purchase-stat"><span className="customer-stat-icon"><ReceiptText size={20} /></span><div><span>Total orders</span><strong>{salesLoading ? "—" : customerSales.length}</strong></div></div>
          <div className="customer-purchase-stat"><span className="customer-stat-icon"><IndianRupee size={20} /></span><div><span>Total spent</span><strong>{salesLoading ? "—" : money(totalSpent)}</strong></div></div>
          <div className="customer-purchase-stat"><span className="customer-stat-icon"><CalendarDays size={20} /></span><div><span>Last purchase</span><strong>{salesLoading ? "Loading…" : lastPurchase ? saleDate(lastPurchase) : "No purchases yet"}</strong></div></div>
        </div>

        <section className="customer-orders-card">
          <div className="customer-orders-heading">
            <div><h2>Order History</h2><p>Invoices associated with this customer's mobile number.</p></div>
            <span className="customer-orders-count">{salesLoading ? "Loading…" : `${customerSales.length} orders`}</span>
          </div>
          {salesLoading ? (
            <div className="customers-state"><RefreshCw size={24} className="customer-spin" /><p>Loading order history…</p></div>
          ) : salesError ? (
            <div className="customers-state"><ReceiptText size={30} /><h3>Unable to load orders</h3><p>{salesError}</p><button className="customer-primary-btn" onClick={() => openCustomerDetails(selectedCustomer)}>Try Again</button></div>
          ) : customerSales.length === 0 ? (
            <div className="customers-state"><ShoppingBag size={32} /><h3>No orders yet</h3><p>Sales made using this customer's mobile number will appear here.</p></div>
          ) : (
            <div className="customers-table-wrap">
              <table className="customers-table customer-orders-table">
                <thead><tr><th>Invoice</th><th>Date</th><th>Items</th><th>Payment</th><th>Total</th><th>Details</th></tr></thead>
                <tbody>
                  {customerSales.map((sale, index) => (
                    <tr key={sale._id || sale.id || index}>
                      <td><strong>{sale.id || sale.invoiceNumber || `Order ${index + 1}`}</strong></td>
                      <td>{saleDate(sale)}</td>
                      <td>{(sale.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0)} item(s)</td>
                      <td><span className="customer-payment-label"><CreditCard size={14} /> {sale.payment || sale.paymentMethod || "Not specified"}</span></td>
                      <td><strong>{money(saleTotal(sale))}</strong></td>
                      <td><button type="button" className="customer-icon-btn" title="View invoice details" onClick={() => window.alert(`Invoice: ${sale.id || sale.invoiceNumber || "—"}\nDate: ${saleDate(sale)}\nCustomer: ${sale.customer || selectedCustomer.name}\n\n${(sale.items || []).map((item) => `${item.name} × ${item.qty} — ${money((Number(item.price) || 0) * (Number(item.qty) || 0))}`).join("\n")}\n\nTotal: ${money(saleTotal(sale))}\nPayment: ${sale.payment || sale.paymentMethod || "Not specified"}`)}><Eye size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {modalOpen && renderCustomerModal()}
      </div>
    );
  }

  function renderCustomerModal() {
    return (
      <div className="customer-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
        <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title">
          <div className="customer-modal-heading"><div><h2 id="customer-modal-title">{editingId !== null ? "Edit Customer" : "Add Customer"}</h2><p>{editingId !== null ? "Update the customer's details." : "Enter the customer's contact information."}</p></div><button className="customer-icon-btn" onClick={closeModal} disabled={saving} aria-label="Close form"><X size={20} /></button></div>
          {error && <div className="customer-alert customer-alert-error">{error}</div>}
          <form className="customer-form" onSubmit={handleSubmit}>
            <label>Customer Name <span>*</span><input name="name" value={form.name} onChange={updateField} placeholder="Enter full name" maxLength={100} required autoFocus /></label>
            <label>Mobile Number <span>*</span><input name="mobile" type="tel" value={form.mobile} onChange={updateField} placeholder="10-digit mobile number" inputMode="numeric" maxLength={10} pattern="[6-9][0-9]{9}" required /></label>
            <label>Email Address<input name="email" type="email" value={form.email} onChange={updateField} placeholder="customer@example.com" maxLength={150} /></label>
            <label>Address<textarea name="address" value={form.address} onChange={updateField} placeholder="Enter address (optional)" maxLength={500} rows={3} /></label>
            <div className="customer-form-actions"><button type="button" className="customer-secondary-btn" onClick={closeModal} disabled={saving}>Cancel</button><button type="submit" className="customer-primary-btn" disabled={saving}>{saving ? "Saving…" : editingId !== null ? "Save Changes" : "Save Customer"}</button></div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="customers-page">
      <div className="customers-heading"><div><h1>Customer Management</h1><p>Manage your customers and their contact information.</p></div><button className="customer-primary-btn" onClick={openAddModal}><Plus size={18} /> Add Customer</button></div>
      {notice && <div className="customer-alert customer-alert-success">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={16} /></button></div>}
      {error && !modalOpen && <div className="customer-alert customer-alert-error">{error}<button type="button" aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
      <div className="customers-summary"><div className="customer-summary-icon"><Users size={24} /></div><div><span>Total customers</span><strong>{customers.length}</strong></div><button className="customer-refresh-btn" onClick={() => loadCustomers()} disabled={loading} title="Refresh customers" aria-label="Refresh customers"><RefreshCw size={17} /></button></div>
      <div className="customers-toolbar"><div className="customer-search"><Search size={19} /><input type="search" placeholder="Search by name, mobile, email or address..." value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={16} /></button>}</div></div>
      {loading ? <div className="customers-state"><RefreshCw size={24} className="customer-spin" /><p>Loading customers...</p></div> : error && customers.length === 0 ? <div className="customers-state"><Users size={34} /><h3>Unable to load customers</h3><p>{error}</p><button className="customer-primary-btn" onClick={() => loadCustomers()}>Try Again</button></div> : filteredCustomers.length === 0 ? <div className="customers-state"><div className="customer-empty-icon"><UserRound size={32} /></div><h3>{search ? "No customers found" : "No customers yet"}</h3><p>{search ? "Try a different search term." : "Add your first customer to start building your customer list."}</p>{!search && <button className="customer-primary-btn" onClick={openAddModal}><Plus size={18} /> Add First Customer</button>}</div> : (
        <div className="customers-table-card"><div className="customers-table-wrap"><table className="customers-table"><thead><tr><th>Customer</th><th>Mobile</th><th>Email</th><th>Address</th><th>Actions</th></tr></thead><tbody>
          {filteredCustomers.map((customer) => <tr key={customer.id} className="customer-clickable-row" onClick={() => openCustomerDetails(customer)} title={`View orders for ${customer.name}`}>
            <td><button type="button" className="customer-name-button" onClick={(event) => { event.stopPropagation(); openCustomerDetails(customer); }}><div className="customer-name-cell"><div className="customer-avatar">{customer.name?.charAt(0)?.toUpperCase() || "C"}</div><div><strong>{customer.name}</strong><span>Customer #{customer.id}</span></div></div></button></td>
            <td><span className="customer-contact"><Phone size={15} />{customer.mobile}</span></td>
            <td>{customer.email ? <span className="customer-contact"><Mail size={15} />{customer.email}</span> : <span className="customer-muted">Not provided</span>}</td>
            <td>{customer.address ? <span className="customer-contact customer-address"><MapPin size={15} />{customer.address}</span> : <span className="customer-muted">Not provided</span>}</td>
            <td><div className="customer-actions"><button className="customer-icon-btn" title="Edit customer" aria-label={`Edit ${customer.name}`} onClick={(event) => { event.stopPropagation(); openEditModal(customer); }}><Pencil size={16} /></button><button className="customer-icon-btn customer-delete-btn" title="Delete customer" aria-label={`Delete ${customer.name}`} onClick={(event) => { event.stopPropagation(); handleDelete(customer); }}><Trash2 size={16} /></button></div></td>
          </tr>)}
        </tbody></table></div><div className="customers-table-footer">Showing {filteredCustomers.length} of {customers.length} customers · Click a customer to view orders</div></div>
      )}
      {modalOpen && renderCustomerModal()}
    </div>
  );
}
