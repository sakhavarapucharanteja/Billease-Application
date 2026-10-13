import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Package,
  AlertTriangle,
} from "lucide-react";
import { apiFetch } from "./api";

const categoryOptions = ["Electronics", "Stationery", "Home", "Fashion", "Other"];

const categoryVisuals = {
  Electronics: { color: "#e0e7ff", symbol: "🔌" },
  Stationery: { color: "#fef3c7", symbol: "📒" },
  Home: { color: "#cffafe", symbol: "🏠" },
  Fashion: { color: "#fce7f3", symbol: "👕" },
  Other: { color: "#f3e8ff", symbol: "📦" },
};

const emptyForm = {
  name: "",
  sku: "",
  category: "Electronics",
  purchasePrice: "",
  price: "",
  gst: "18",
  stock: "0",
};

const currency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

async function readApiResponse(response, fallbackMessage) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    // Keep the fallback message if the server returned an empty/non-JSON response.
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || fallbackMessage);
  }

  return data;
}

function normalizeProduct(product, fallback = {}) {
  return {
    ...fallback,
    ...product,
    price: Number(product.price) || 0,
    gst: Number(product.gst) || 0,
    stock: Number(product.stock) || 0,
    purchasePrice: Number(product.purchasePrice ?? product.price) || 0,
    color: product.color || fallback.color || "#e0e7ff",
    symbol: product.symbol || fallback.symbol || "📦",
  };
}

export default function Products({ products = [], setProducts }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const term = search.trim().toLowerCase();
      const name = String(product.name || "").toLowerCase();
      const sku = String(product.sku || "").toLowerCase();
      const matchesSearch = !term || name.includes(term) || sku.includes(term);
      const matchesCategory = categoryFilter === "All" || product.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const inventoryValue = products.reduce(
    (sum, product) =>
      sum + (Number(product.purchasePrice ?? product.price) || 0) * (Number(product.stock) || 0),
    0
  );
  const lowStockCount = products.filter((product) => Number(product.stock) <= 5).length;

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(product) {
    setEditingId(product.id);
    setForm({
      name: product.name ?? "",
      sku: product.sku ?? "",
      category: product.category ?? "Other",
      purchasePrice: String(product.purchasePrice ?? product.price ?? ""),
      price: String(product.price ?? ""),
      gst: String(product.gst ?? 18),
      stock: String(product.stock ?? 0),
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const name = form.name.trim();
    const sku = form.sku.trim().toUpperCase();
    const sellingPrice = Number(form.price);
    const purchasePrice = Number(form.purchasePrice || 0);
    const gst = Number(form.gst);
    const stock = Number(form.stock);

    if (!name || !sku) {
      setError("Enter both product name and SKU.");
      return;
    }
    if (
      products.some(
        (product) =>
          String(product.sku || "").toLowerCase() === sku.toLowerCase() &&
          product.id !== editingId
      )
    ) {
      setError("That SKU already exists. Please use a unique SKU.");
      return;
    }
    if (
      !Number.isFinite(sellingPrice) ||
      sellingPrice < 0 ||
      !Number.isFinite(purchasePrice) ||
      purchasePrice < 0
    ) {
      setError("Enter valid purchase and selling prices.");
      return;
    }
    if (!Number.isFinite(gst) || gst < 0 || gst > 100) {
      setError("GST must be between 0 and 100.");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setError("Stock must be a whole number of 0 or more.");
      return;
    }

    const visual = categoryVisuals[form.category] || categoryVisuals.Other;
    const existing = products.find((product) => product.id === editingId);
    const productPayload = {
      name,
      sku,
      category: form.category,
      purchasePrice,
      price: sellingPrice,
      gst,
      stock,
      color: existing?.color || visual.color,
      symbol: existing?.symbol || visual.symbol,
    };

    setSaving(true);
    setError("");

    try {
      const isEditing = editingId !== null;
      const response = await apiFetch(
        isEditing ? `/products/${editingId}` : "/products",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productPayload),
        }
      );
      const data = await readApiResponse(
        response,
        isEditing ? "Could not update the product." : "Could not add the product."
      );

      const savedProduct = normalizeProduct(
        data.product || data,
        isEditing ? existing || productPayload : productPayload
      );

      if (isEditing) {
        setProducts((current) =>
          current.map((product) =>
            product.id === editingId ? savedProduct : product
          )
        );
      } else {
        setProducts((current) => [...current, savedProduct]);
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setError("");
    } catch (requestError) {
      console.error("Could not save product:", requestError);
      setError(requestError.message || "Could not save the product. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product) {
    const confirmed = window.confirm(`Delete "${product.name}"? This cannot be undone.`);
    if (!confirmed || deletingId !== null) return;

    setDeletingId(product.id);
    setError("");
    try {
      const response = await apiFetch(`/products/${product.id}`, {
        method: "DELETE",
      });
      await readApiResponse(response, `Could not delete ${product.name}.`);
      setProducts((current) => current.filter((item) => item.id !== product.id));
    } catch (requestError) {
      console.error("Could not delete product:", requestError);
      setError(requestError.message || "Could not delete the product. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="products-page">
      <div className="products-page-heading">
        <div>
          <h3>Products &amp; Inventory</h3>
          <p>Add products, update prices, and manage available stock.</p>
        </div>
        <button className="pm-primary-button" type="button" onClick={openAddModal}>
          <Plus size={18} /> Add product
        </button>
      </div>

      <div className="pm-stats-grid">
        <article className="pm-stat-card">
          <span>Total products</span>
          <strong>{products.length}</strong>
          <small><Package size={14} /> In your catalog</small>
        </article>
        <article className="pm-stat-card">
          <span>Inventory value</span>
          <strong>{currency(inventoryValue)}</strong>
          <small>Based on purchase price where available</small>
        </article>
        <article className={`pm-stat-card ${lowStockCount ? "pm-stat-warning" : ""}`}>
          <span>Low stock items</span>
          <strong>{lowStockCount}</strong>
          <small><AlertTriangle size={14} /> 5 units or fewer</small>
        </article>
      </div>

      {error && !modalOpen && <p className="pm-form-error" role="alert">{error}</p>}

      <div className="pm-table-card">
        <div className="pm-toolbar">
          <label className="pm-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product name or SKU..."
              aria-label="Search product name or SKU"
            />
          </label>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="Filter by category"
          >
            <option value="All">All categories</option>
            {[...new Set([...categoryOptions, ...products.map((product) => product.category)])]
              .filter(Boolean)
              .map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
          </select>
        </div>

        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Purchase price</th>
                <th>Selling price</th>
                <th>GST</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="pm-product-cell">
                      <span className="pm-product-icon" style={{ background: product.color || "#f3f4f6" }}>
                        {product.symbol || "📦"}
                      </span>
                      <strong>{product.name}</strong>
                    </div>
                  </td>
                  <td><span className="pm-sku">{product.sku}</span></td>
                  <td>{product.category}</td>
                  <td>{currency(product.purchasePrice ?? product.price)}</td>
                  <td><strong>{currency(product.price)}</strong></td>
                  <td>{Number(product.gst) || 0}%</td>
                  <td>
                    <span className={`pm-stock ${Number(product.stock) <= 5 ? "pm-stock-low" : ""}`}>
                      {product.stock}
                    </span>
                  </td>
                  <td>
                    <div className="pm-actions">
                      <button
                        type="button"
                        onClick={() => openEditModal(product)}
                        aria-label={`Edit ${product.name}`}
                        title="Edit"
                        disabled={saving || deletingId !== null}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="pm-delete-button"
                        onClick={() => deleteProduct(product)}
                        aria-label={`Delete ${product.name}`}
                        title={deletingId === product.id ? "Deleting..." : "Delete"}
                        disabled={deletingId !== null || saving}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="pm-empty">
              <Package size={28} />
              <strong>No products found</strong>
              <span>Try another search or add a new product.</span>
            </div>
          )}
        </div>
        <div className="pm-table-footer">
          Showing {filteredProducts.length} of {products.length} products
        </div>
      </div>

      {modalOpen && (
        <div
          className="pm-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setModalOpen(false);
          }}
        >
          <section className="pm-modal" role="dialog" aria-modal="true" aria-labelledby="pm-modal-title">
            <div className="pm-modal-header">
              <div>
                <h3 id="pm-modal-title">{editingId === null ? "Add product" : "Edit product"}</h3>
                <p>Product details used by your billing screen.</p>
              </div>
              <button
                type="button"
                className="pm-modal-close"
                onClick={() => !saving && setModalOpen(false)}
                aria-label="Close"
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="pm-form-grid">
                <label className="pm-form-full">
                  Product name
                  <input
                    autoFocus
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="e.g. Wireless Mouse"
                    required
                  />
                </label>
                <label>
                  SKU / product code
                  <input
                    value={form.sku}
                    onChange={(event) => setForm({ ...form, sku: event.target.value })}
                    placeholder="e.g. ACC003"
                    required
                  />
                </label>
                <label>
                  Category
                  <select
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                  >
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Purchase price (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.purchasePrice}
                    onChange={(event) => setForm({ ...form, purchasePrice: event.target.value })}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  Selling price (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) => setForm({ ...form, price: event.target.value })}
                    placeholder="0.00"
                    required
                  />
                </label>
                <label>
                  GST (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.gst}
                    onChange={(event) => setForm({ ...form, gst: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Available stock
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock}
                    onChange={(event) => setForm({ ...form, stock: event.target.value })}
                    required
                  />
                </label>
              </div>

              {error && <p className="pm-form-error" role="alert">{error}</p>}

              <div className="pm-modal-footer">
                <button
                  type="button"
                  className="pm-secondary-button"
                  onClick={() => !saving && setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="pm-primary-button" disabled={saving}>
                  {saving ? "Saving..." : editingId === null ? "Save product" : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
