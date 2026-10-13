import { useEffect, useMemo, useState } from "react";
import Login from "./Login";
import {
  apiFetch,
  getAuthToken,
  saveAuthToken,
  clearAuthToken,
} from "./api";
import { jsPDF } from "jspdf";
import Products from "./Products";
import Dashboard from "./Dashboard";
import "./Products.css";
import "./Dashboard.css";
import SalesHistory from "./SalesHistory";
import Customers from "./Customers";
import Reports from "./Reports";
import StoreSettings, { readStoreSettings } from "./Settings";
import {
Search, ShoppingCart,History, Plus, Minus, Trash2, ReceiptText,
Package, Users, LayoutDashboard, BarChart3, Settings,
CreditCard, Banknote, Smartphone, Printer, CheckCircle2,
X, Percent, Menu, MessageCircle
} from "lucide-react";
import "./App.css";
const money = (amount) =>
new Intl.NumberFormat("en-IN", {
style: "currency",
currency: "INR",
maximumFractionDigits: 2,
}).format(amount);
function App() {
const [activePage, setActivePage] = useState("pos");
const [products, setProducts] = useState([]);
const [productsLoading, setProductsLoading] = useState(true);
const [sales, setSales] = useState([]);
const [cart, setCart] = useState([]);
const [search, setSearch] = useState("");
const [category, setCategory] = useState("All");
const [discount, setDiscount] = useState(0);
// "product" keeps each product's configured GST; a number overrides GST for this bill.
const [gstOverride, setGstOverride] = useState("product");
const [payment, setPayment] = useState("UPI");
const [customer, setCustomer] = useState("");
const [mobile, setMobile] = useState("");
const [savedCustomers, setSavedCustomers] = useState([]);
const [customerSearch, setCustomerSearch] = useState("");
const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
const [sidebarOpen, setSidebarOpen] = useState(false);
const [lastReceipt, setLastReceipt] = useState(null);
const [notice, setNotice] = useState("");
const [isSavingSale, setIsSavingSale] = useState(false);
const [storeSettings, setStoreSettings] = useState(readStoreSettings);
const [authToken, setAuthToken] = useState(() => getAuthToken());
const [authUser, setAuthUser] = useState(null);
const [authChecking, setAuthChecking] = useState(true);
function handleLogin(token, user) {
  saveAuthToken(token);
  setAuthToken(token);
  setAuthUser(user);
}
function handleLogout() {
  clearAuthToken();
  setAuthToken(null);
  setAuthUser(null);
  setProducts([]);
  setSales([]);
  setSavedCustomers([]);
  setCart([]);
  setLastReceipt(null);
  setNotice("");
}

// Verify a saved session when the application opens.
useEffect(() => {
  let cancelled = false;

  async function verifySession() {
    const token = getAuthToken();

    if (!token) {
      if (!cancelled) {
        setAuthToken(null);
        setAuthUser(null);
        setAuthChecking(false);
      }
      return;
    }

    try {
      const response = await apiFetch("/auth/me");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Your session has expired.");
      }

      if (!cancelled) {
        setAuthToken(token);
        setAuthUser({ ...data.user, business: data.business });
      }
    } catch {
      if (!cancelled) {
        clearAuthToken();
        setAuthToken(null);
        setAuthUser(null);
      }
    } finally {
      if (!cancelled) setAuthChecking(false);
    }
  }

  verifySession();
  return () => {
    cancelled = true;
  };
}, []);

// Any protected API returning 401 ends the current session.
useEffect(() => {
  function handleUnauthorized() {
    clearAuthToken();
    setAuthToken(null);
    setAuthUser(null);
    setProducts([]);
    setSales([]);
    setSavedCustomers([]);
    setCart([]);
    setLastReceipt(null);
  }

  window.addEventListener("billease:unauthorized", handleUnauthorized);
  return () => {
    window.removeEventListener("billease:unauthorized", handleUnauthorized);
  };
}, []);
// Load the shared product catalog from MongoDB through the backend API.
useEffect(() => {
let cancelled = false;
if (!authToken) {
  setProducts([]);
  setProductsLoading(false);
  return () => { cancelled = true; };
}
async function loadProducts() {
try {
setProductsLoading(true);
const response = await apiFetch("/products");
const data = await response.json();
if (!response.ok || !data.success) {
throw new Error(data.message || "Could not load products.");
}
if (!cancelled) {
setProducts(
(data.products || []).map((product) => ({
...product,
price: Number(product.price) || 0,
gst: Number(product.gst) || 0,
stock: Number(product.stock) || 0,
purchasePrice: Number(product.purchasePrice ?? product.price) || 0,
color: product.color || "#e0e7ff",
symbol: product.symbol || "📦",
}))
);
}
} catch (error) {
console.error("Failed to load products:", error);
if (!cancelled) {
setNotice("Could not load products from the server. Check that the backend is running.");
}
} finally {
if (!cancelled) setProductsLoading(false);
}
}
loadProducts();
return () => {
cancelled = true;
};
}, [authToken]);
// Load saved sales from MongoDB so the Dashboard survives page refreshes.
useEffect(() => {
  let cancelled = false;
  if (!authToken) {
    setSales([]);
    return () => { cancelled = true; };
  }
  async function loadSales() {
    try {
      const response = await apiFetch("/sales");
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load sales.");
      }
      if (!cancelled) {
        setSales(Array.isArray(data.sales) ? data.sales : []);
      }
    } catch (error) {
      console.error("Failed to load sales:", error);
      if (!cancelled) {
        setNotice("Could not load sales history. Check that the backend is running.");
      }
    }
  }
  loadSales();
  return () => {
    cancelled = true;
  };
}, [authToken]);
useEffect(() => {
  let cancelled = false;
  if (!authToken) {
    setSavedCustomers([]);
    return () => { cancelled = true; };
  }
  async function loadSavedCustomers() {
    try {
      const response = await apiFetch("/customers");
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load customers.");
      }
      if (!cancelled) {
        setSavedCustomers(Array.isArray(data.customers) ? data.customers : []);
      }
    } catch (error) {
      console.error("Failed to load saved customers:", error);
    }
  }
  loadSavedCustomers();
  return () => { cancelled = true; };
}, [authToken]);
const filteredCustomers = savedCustomers.filter((savedCustomer) => {
  const term = customerSearch.trim().toLowerCase();
  if (!term) return false;
  return String(savedCustomer.name || "").toLowerCase().includes(term) ||
    String(savedCustomer.mobile || "").includes(term);
});
function selectSavedCustomer(savedCustomer) {
  setCustomer(savedCustomer.name || "");
  setMobile(savedCustomer.mobile || "");
  setCustomerSearch(savedCustomer.name || "");
  setShowCustomerSuggestions(false);
  setNotice("");
}
const categories = ["All", ...new Set(products.map((p) => p.category))];
const filteredProducts = products.filter((product) => {
const matchesSearch =
product.name.toLowerCase().includes(search.toLowerCase()) ||
product.sku.toLowerCase().includes(search.toLowerCase());
return matchesSearch &&
(category === "All" || product.category === category);
});
const subtotal = useMemo(
() => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
[cart]
);
const discountAmount = subtotal * Math.min(100, Math.max(0, Number(discount) || 0)) / 100;
const tax = useMemo(() => {
return cart.reduce((sum, item) => {
const lineTotal = item.price * item.qty;
const lineDiscount = subtotal ? discountAmount * lineTotal / subtotal : 0;
const gstRate = gstOverride === "product" ? (Number(item.gst) || 0) : Number(gstOverride);
return sum + (lineTotal - lineDiscount) * gstRate / 100;
}, 0);
}, [cart, subtotal, discountAmount, gstOverride]);
const total = subtotal - discountAmount + tax;
const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
function addToCart(product) {
if (product.stock <= 0) {
setNotice("This product is out of stock.");
return;
}
setCart((current) => {
const existing = current.find((item) => item.id === product.id);
if (existing) {
if (existing.qty >= product.stock) {
setNotice("You cannot add more than the available stock.");
return current;
}
return current.map((item) =>
item.id === product.id ? { ...item, qty: item.qty + 1 } : item
);
}
return [...current, { ...product, qty: 1 }];
});
setNotice("");
setLastReceipt(null);
}
function changeQuantity(id, amount) {
const product = products.find((p) => p.id === id);
setCart((current) =>
current
.map((item) =>
item.id === id
? { ...item, qty: Math.min(product.stock, item.qty + amount) }
: item
)
.filter((item) => item.qty > 0)
);
setLastReceipt(null);
}
function removeItem(id) {
setCart((current) => current.filter((item) => item.id !== id));
setLastReceipt(null);
}
async function completeSale() {
  if (isSavingSale) return;
  const customerMobile = mobile.trim();
  let customerName = customerSearch.trim() || customer.trim();

  if (!customerName) return setNotice("Please enter the customer name.");
  if (!/^[6-9]\d{9}$/.test(customerMobile)) return setNotice("Please enter a valid 10-digit Indian mobile number.");
  if (!cart.length) return setNotice("Add at least one product before checkout.");

  setIsSavingSale(true);
  setNotice("");
  try {
    // Find or create the customer. This does not change stock.
    const customersResponse = await apiFetch("/customers");
    const customersData = await customersResponse.json();
    if (!customersResponse.ok || !customersData.success) throw new Error(customersData.message || "Could not load customers.");

    let confirmedCustomer = (customersData.customers || []).find((item) => String(item.mobile).trim() === customerMobile);
    if (!confirmedCustomer) {
      const createResponse = await apiFetch("/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: customerName, mobile: customerMobile, email: "", address: "" }),
      });
      const createData = await createResponse.json();
      if (!createResponse.ok || !createData.success || !createData.customer) throw new Error(createData.message || "Could not save the customer.");
      confirmedCustomer = createData.customer;
    }

    customerName = confirmedCustomer.name;
    const receiptDraft = {
      id: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      date: new Date().toLocaleString("en-IN"),
      customer: customerName,
      mobile: confirmedCustomer.mobile,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku || "",
        qty: item.qty,
        price: item.price,
        gst: gstOverride === "product" ? (Number(item.gst) || 0) : Number(gstOverride),
      })),
      discountPercent: Number(discount) || 0,
      payment,
    };

    // The backend calculates authoritative totals and deducts stock while saving the invoice.
    const saleResponse = await apiFetch("/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(receiptDraft),
    });
    const saleData = await saleResponse.json();
    if (!saleResponse.ok || !saleData.success || !saleData.sale) throw new Error(saleData.message || "Could not save the sale.");
    const savedReceipt = saleData.sale;

    // Refresh the product stock from the database after the server confirms the sale.
    const [productsResponse, customersRefreshResponse, salesResponse] = await Promise.all([
      apiFetch("/products"),
      apiFetch("/customers"),
      apiFetch("/sales"),
    ]);
    const [productsData, customersRefreshData, salesData] = await Promise.all([
      productsResponse.json(), customersRefreshResponse.json(), salesResponse.json(),
    ]);
    if (productsResponse.ok && productsData.success) {
      setProducts((productsData.products || []).map((product) => ({
        ...product,
        price: Number(product.price) || 0,
        gst: Number(product.gst) || 0,
        stock: Number(product.stock) || 0,
        purchasePrice: Number(product.purchasePrice ?? product.price) || 0,
        color: product.color || "#e0e7ff",
        symbol: product.symbol || "📦",
      })));
    }
    if (customersRefreshResponse.ok && customersRefreshData.success) setSavedCustomers(customersRefreshData.customers || []);
    if (salesResponse.ok && salesData.success) setSales(salesData.sales || []);

    setCustomer(customerName);
    setCustomerSearch(customerName);
    setMobile(confirmedCustomer.mobile);
    setLastReceipt(savedReceipt);
    setCart([]);
    setDiscount(0);
    setGstOverride("product");
    setCustomer("");
    setMobile("");
    setCustomerSearch("");
    setShowCustomerSuggestions(false);
    setNotice("Sale completed successfully. Invoice saved and stock updated.");
  } catch (error) {
    console.error("Could not complete sale:", error);
    setNotice(error.message || "Could not complete sale. Refresh products and sales before retrying.");
  } finally {
    setIsSavingSale(false);
  }
}

// Both receipt actions use this one A4 PDF template, so the printed
// invoice and the downloaded WhatsApp invoice have exactly the same design.
function createInvoicePdf(receipt) {
  const items = Array.isArray(receipt.items) ? receipt.items : [];
  const business = readStoreSettings();
  const pageWidth = 76.2; // 3-inch thermal receipt
  const margin = 3.5;
  const right = pageWidth - margin;
  const tableWidth = right - margin;
  const currency = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
  const subtotal = Number(receipt.subtotal) || 0;
  const discountAmount = Number(receipt.discountAmount) || 0;
  const discountPercent = Number(receipt.discountPercent) || 0;
  const preparedItems = items.map((item) => {
    const qty = Number(item.qty) || 0;
    const price = Number(item.price) || 0;
    const gstRate = Number(item.gst) || 0;
    const gross = price * qty;
    const itemDiscount = subtotal > 0
      ? (discountAmount * gross) / subtotal
      : 0;
    const taxableValue = gross - itemDiscount;
    const gstAmount = (taxableValue * gstRate) / 100;
    return {
      name: String(item.name || item.productName || "Product"),
      qty,
      price,
      gstRate,
      gross,
      itemDiscount,
      taxableValue,
      gstAmount,
      total: taxableValue + gstAmount,
    };
  });
  const estimatedHeight = Math.max(
    112,
    112 + (business.logo ? 10 : 0) +
      (business.address ? Math.max(0, Math.ceil(String(business.address).length / 32) - 1) * 3 : 0) +
      preparedItems.reduce((height, item) => {
        const nameLines = Math.max(1, Math.ceil(item.name.length / 16));
        return height + Math.max(9, nameLines * 3.4) + 2;
      }, 0)
  );
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pageWidth, estimatedHeight],
    compress: true,
  });
  let y = 5;
  function setFont(size = 7, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
  }
  function write(value, size = 7, bold = false) {
    setFont(size, bold);
    const lines = doc.splitTextToSize(String(value ?? ""), tableWidth);
    doc.text(lines, margin, y);
    y += lines.length * (size * 0.42 + 0.5) + 1;
  }
  function centered(value, size = 7, bold = false) {
    setFont(size, bold);
    doc.text(String(value), pageWidth / 2, y, { align: "center" });
    y += size * 0.42 + 0.8;
  }
  function drawRule() {
    doc.setDrawColor(125, 125, 125);
    doc.setLineWidth(0.15);
    doc.line(margin, y, right, y);
  }
  function summaryRow(label, value, bold = false) {
    setFont(bold ? 7.5 : 6.8, bold);
    doc.text(String(label), margin, y);
    doc.text(currency(value), right, y, { align: "right" });
    y += bold ? 6 : 4.8;
  }
  // Compact, non-overlapping store header sourced from Store Settings.
  if (business.logo) {
    try {
      const format = business.logo.startsWith("data:image/png") ? "PNG" :
        business.logo.startsWith("data:image/webp") ? "WEBP" : "JPEG";
      const logoSize = 10;
      doc.addImage(business.logo, format, (pageWidth - logoSize) / 2, y, logoSize, logoSize);
      y += logoSize + 5; // Keep a clear gap between the logo and business name.
    } catch (error) {
      console.warn("Could not add store logo to receipt:", error);
      y += 2;
    }
  }
  const businessName = String(business.businessName || "My Store").trim();
  const nameLines = doc.splitTextToSize(businessName, tableWidth - 4);
  setFont(nameLines.length > 1 ? 8 : 9, true);
  doc.text(nameLines, pageWidth / 2, y, { align: "center" });
  y += nameLines.length * 4.2 + 1.5;
  if (business.address) {
    const addressLines = doc.splitTextToSize(String(business.address).replace(/\s+/g, " ").trim(), tableWidth - 2);
    setFont(5.8, false);
    doc.text(addressLines, pageWidth / 2, y, { align: "center" });
    y += addressLines.length * 2.8 + 1;
  }
  const contactLine = [business.phone, business.email].filter(Boolean).join(" | ");
  if (contactLine) {
    const contactLines = doc.splitTextToSize(contactLine, tableWidth - 2);
    setFont(5.8, false);
    doc.text(contactLines, pageWidth / 2, y, { align: "center" });
    y += contactLines.length * 2.8 + 1;
  }
  if (business.gstin) centered(`GSTIN: ${business.gstin}`, 5.8, false);
  y += 1;
  centered("PAYMENT RECEIPT", 7.5, true);
  y += 2;
  drawRule();
  y += 2.5;
  // Receipt and customer details
  write(`Receipt No: ${receipt.id || "N/A"}`, 7, true);
  write(`Date: ${receipt.date || new Date().toLocaleString("en-IN")}`, 6.5);
  write(`Customer: ${receipt.customer || "Walk-in Customer"}`, 6.5);
  if (receipt.mobile) write(`Mobile: ${receipt.mobile}`, 6.5);
  write(`Payment method: ${receipt.payment || "N/A"}`, 6.5);
  y += 1;
  drawRule();
  y += 2.5;
  // Compact item table
  write("ITEMS PURCHASED", 7.5, true);
  const itemX = margin + 1;
  const qtyX = margin + 26;
  const rateX = margin + 39;
  const gstX = margin + 51;
  const amountX = right - 1;
  const headerY = y;
  doc.setFillColor(235, 239, 245);
  doc.rect(margin, headerY - 3, tableWidth, 8, "F");
  setFont(5.6, true);
  doc.text("ITEM", itemX, headerY + 2);
  doc.text("QTY", qtyX, headerY + 2, { align: "center" });
  doc.text("RATE", rateX, headerY + 2, { align: "right" });
  doc.text("GST", gstX, headerY + 2, { align: "right" });
  doc.text("AMOUNT", amountX, headerY + 2, { align: "right" });
  y += 9;
  preparedItems.forEach((item, index) => {
    const nameLines = doc.splitTextToSize(item.name, 22);
    const rowHeight = Math.max(8, nameLines.length * 3.2 + 2);
    const rowTop = y - 2;
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, rowTop, tableWidth, rowHeight, "F");
    }
    setFont(5.5);
    doc.text(nameLines, itemX, y + 2);
    doc.text(String(item.qty), qtyX, y + 2, { align: "center" });
    doc.text(currency(item.price), rateX, y + 2, { align: "right" });
    doc.text(`${item.gstRate}%`, gstX, y + 2, { align: "right" });
    doc.text(currency(item.total), amountX, y + 2, { align: "right" });
    y += rowHeight;
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.12);
    doc.line(margin, y, right, y);
    y += 2;
  });
  y += 1;
  drawRule();
  y += 2.5;
  // Payment summary
  write("PAYMENT SUMMARY", 7.5, true);
  summaryRow("Subtotal", subtotal);
  if (discountAmount > 0) {
    summaryRow(`Discount (${discountPercent}%)`, -discountAmount);
  }
  const taxableTotal = preparedItems.reduce(
    (sum, item) => sum + item.taxableValue, 0
  );
  const totalGST = preparedItems.reduce(
    (sum, item) => sum + item.gstAmount, 0
  );
  summaryRow("Taxable value", taxableTotal);
  summaryRow("GST", totalGST);
  y += 0.5;
  doc.setFillColor(235, 239, 245);
  doc.roundedRect(margin, y - 3, tableWidth, 10, 1, 1, "F");
  setFont(7.5, true);
  doc.text("TOTAL PAID", margin + 2, y + 3.2);
  doc.text(currency(receipt.total), right - 2, y + 3.2, { align: "right" });
  y += 11;
  y += 1;
  drawRule();
  y += 2.5;
  centered("Thank you for your purchase!", 7, true);
  centered("Generated by BillEase", 5.5);
  y += 1;
  return doc;
}
function printReceipt() {
if (!lastReceipt) {
setNotice("Complete a sale before printing a receipt.");
return;
}
try {
const doc = createInvoicePdf(lastReceipt);
doc.autoPrint();
const pdfUrl = doc.output("bloburl");
const printWindow = window.open(pdfUrl, "_blank");
if (!printWindow) {
doc.save(`${lastReceipt.id}.pdf`);
setNotice("The invoice PDF was downloaded because the print window was blocked.");
return;
}
setNotice("Invoice opened for printing. Choose your printer or Save as PDF.");
} catch (error) {
console.error("Could not prepare invoice for printing:", error);
setNotice("Could not create the invoice PDF. Please try again.");
}
}
function sendReceiptWhatsApp() {
const receipt = lastReceipt;
if (!receipt) {
setNotice("Complete a sale before sending a receipt.");
return;
}
const phone = String(receipt.mobile || "").replace(/\D/g, "");
if (!/^[6-9]\d{9}$/.test(phone)) {
setNotice("This receipt does not contain a valid 10-digit Indian mobile number.");
return;
}
try {
const doc = createInvoicePdf(receipt);
doc.save(`${receipt.id}.pdf`);
window.open(`https://wa.me/91${phone}`, "_blank", "noopener,noreferrer");
setNotice("The invoice PDF was downloaded. Attach it in WhatsApp and press Send.");
} catch (error) {
console.error("Could not create invoice PDF:", error);
setNotice("Could not create the invoice PDF. Please try again.");
}
}
function startNewSale() {
setLastReceipt(null);
setNotice("");
}
if (authChecking) {
  return (
    <div className="login-page">
      <div className="login-card" role="status">Checking your BillEase session...</div>
    </div>
  );
}

if (!authToken || !authUser) {
  return <Login onLogin={handleLogin} />;
}

return (
<div className="app-shell">
<style>{`
  .gst-row { gap: 12px; }
  .gst-row > label { flex: 1; min-width: 76px; }
  .gst-select-wrap { position: relative; display: inline-flex; align-items: center; flex: 0 0 auto; }
  .gst-select { appearance: none; -webkit-appearance: none; min-width: 148px; height: 42px; padding: 0 36px 0 13px; border: 1px solid #dce3f0; border-radius: 10px; background: #fff; color: #27324a; font-family: inherit; font-size: 14px; font-weight: 500; line-height: 1.2; cursor: pointer; outline: none; box-shadow: 0 1px 2px rgba(20, 35, 70, 0.03); transition: border-color .18s ease, box-shadow .18s ease; }
  .gst-select:hover { border-color: #b8b5ff; }
  .gst-select:focus, .gst-select:focus-visible { outline: none; border-color: #6857ff; box-shadow: 0 0 0 3px rgba(104, 87, 255, .13); }
  .gst-select-arrow { position: absolute; right: 13px; pointer-events: none; color: #7770d8; font-size: 12px; }
  @media (max-width: 520px) { .gst-select { min-width: 130px; } }
`}</style>
<aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
<div className="brand">
<div className="brand-icon"><ReceiptText size={23} /></div>
<div>
<h1>BillEase</h1>
<span>Billing & Inventory</span>
</div>
<button className="icon-btn close-menu" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
<X size={20} />
</button>
</div>
<div className="workspace">
<div className="workspace-avatar">S</div>
<div className="workspace-text">
<strong>{authUser?.business?.name || storeSettings.businessName || "My Store"}</strong>
<span>Store workspace</span>
</div>
<span className="online-dot" />
</div>
<span className="nav-label">WORKSPACE</span>
<nav className="nav-menu">
<button
className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}
onClick={() => {
setActivePage("dashboard");
setSidebarOpen(false);
setNotice("");
}}
>
<LayoutDashboard size={19} /> Dashboard
</button>
<button
className={`nav-item ${activePage === "pos" ? "active" : ""}`}
onClick={() => {
setActivePage("pos");
setSidebarOpen(false);
startNewSale();
}}
>
<ShoppingCart size={19} /> POS Billing
<span className="nav-pill">POS</span>
</button>
<button
className={`nav-item ${activePage === "products" ? "active" : ""}`}
onClick={() => {
setActivePage("products");
setSidebarOpen(false);
setNotice("");
}}
>
<Package size={19} />
Products
</button>
<button
  className={`nav-item ${activePage === "customers" ? "active" : ""}`}
  onClick={() => {
    setActivePage("customers");
    setSidebarOpen(false);
    setNotice("");
  }}
>
  <Users size={19} />
  Customers
</button>
<button
  className={`nav-item ${activePage === "reports" ? "active" : ""}`}
  onClick={() => {
    setActivePage("reports");
    setSidebarOpen(false);
    setNotice("");
  }}
>
  <BarChart3 size={19} /> Reports
</button>
<button
  className={`nav-item ${activePage === "sales-history" ? "active" : ""}`}
  onClick={() => {
    setActivePage("sales-history");
    setSidebarOpen(false);
    setNotice("");
  }}
>
  <History size={19} />
  Sales History
</button>
</nav>
<div className="sidebar-bottom">
<button
  className={`nav-item ${activePage === "settings" ? "active" : ""}`}
  onClick={() => {
    setActivePage("settings");
    setSidebarOpen(false);
    setNotice("");
  }}
>
  <Settings size={19} /> Settings
</button>
<div className="plan-card">
<div className="plan-top"><span className="plan-spark">✦</span><strong>Free trial</strong></div>
<p>Your demo workspace is ready. Explore billing features.</p>
<button onClick={() => setNotice("Subscription plans will be added later.")}>Explore plans <span>→</span></button>
</div>
<div className="profile">
<div className="profile-avatar">{(authUser?.name || "U").charAt(0).toUpperCase()}</div>
<div className="profile-info"><strong>{authUser?.name || "Account"}</strong><span>{authUser?.email || "Signed in"}</span></div>
<button type="button" className="profile-menu" onClick={handleLogout} title="Sign out" aria-label="Sign out">↪</button>
</div>
</div>
</aside>
{sidebarOpen && <button className="mobile-overlay" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />}
<main className="main-content">
<header className="topbar">
<div className="topbar-left">
<button className="icon-btn mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
<div>
<div className="breadcrumb">
Workspace <span>/</span>
<strong>
  {activePage === "pos"
    ? "POS Billing"
    : activePage === "products"
      ? "Products"
      : activePage === "customers"
        ? "Customers"
        : activePage === "sales-history"
          ? "Sales History"
          : activePage === "reports"
            ? "Reports"
            : "Dashboard"}
</strong>
</div>
<h2>
  {activePage === "pos"
    ? "Point of Sale"
    : activePage === "products"
      ? "Product Management"
      : activePage === "customers"
        ? "Customer Management"
        : activePage === "sales-history"
          ? "Sales History"
          : activePage === "reports"
            ? "Reports"
            : "Dashboard"}
</h2>
</div>
</div>
<div className="topbar-right">
<span className="live-status"><span /> Signed in</span>
<div className="today-date">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
</div>
</header>
{activePage === "dashboard" ? (
<div className="page-content">
<Dashboard
sales={sales}
products={products}
onGoToPos={() => {
setActivePage("pos");
setSidebarOpen(false);
startNewSale();
}}
/>
</div>
) : activePage === "pos" ? (
<div className="page-content">
{productsLoading && (
<div className="notice" role="status">Loading products from MongoDB...</div>
)}
<div className="page-heading">
<div>
<h3>Create a new bill</h3>
<p>Choose products, manage your cart, and complete the sale.</p>
</div>
<div className="invoice-tag"><ReceiptText size={17} /> New transaction</div>
</div>
{notice && (
<div className={`notice ${notice.includes("successfully") ? "notice-success" : ""}`} role="status">
{notice.includes("successfully") && <CheckCircle2 size={17} />}
<span>{notice}</span>
<button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={16} /></button>
</div>
)}
{lastReceipt && (
<div className="sale-success">
<div className="success-icon"><CheckCircle2 size={23} /></div>
<div className="success-copy">
<strong>Sale completed successfully!</strong>
<span>{lastReceipt.id} · Total paid {money(lastReceipt.total)}</span>
</div>
<div className="receipt-actions">
<button
className="btn-secondary"
onClick={printReceipt}
>
<Printer size={16} />
Print receipt
</button>
<button
className="btn-primary"
onClick={sendReceiptWhatsApp}
>
<MessageCircle size={16} />
Send via WhatsApp
</button>
</div>
<button className="btn-primary" onClick={startNewSale}>New sale</button>
</div>
)}
<div className="pos-layout">
<section className="catalog-panel">
<div className="section-header">
<div><h4>Products</h4><span>{filteredProducts.length} products available</span></div>
<div className="catalog-icon"><Package size={19} /></div>
</div>
<label className="search-box">
<Search size={19} />
<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product or SKU..." />
{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={15} /></button>}
</label>
<div className="category-list">
{categories.map((item) => (
<button key={item} className={`category-chip ${category === item ? "selected" : ""}`} onClick={() => setCategory(item)}>
{item}
</button>
))}
</div>
<div className="product-grid">
{filteredProducts.map((product) => (
<button
className="product-card"
key={product.id}
onClick={() => addToCart(product)}
disabled={product.stock === 0}
aria-label={`Add ${product.name} to cart`}
>
<div className="product-art" style={{ background: product.color }}>
<span>{product.symbol}</span>
<span className="add-product"><Plus size={17} /></span>
</div>
<div className="product-info">
<span className="product-sku">{product.sku}</span>
<strong>{product.name}</strong>
<div className="product-bottom">
<span className="product-price">{money(product.price)}</span>
<span className={product.stock <= 5 ? "stock-low" : "stock-count"}>{product.stock} left</span>
</div>
</div>
</button>
))}
</div>
{filteredProducts.length === 0 && <div className="empty-state"><Search size={28} /><strong>No products found</strong><span>Try another name or category.</span></div>}
<div className="catalog-footer"><span className="stock-indicator" /> Stock availability is shown for demo purposes</div>
</section>
<section className="cart-panel">
<div className="cart-header">
<div>
<h4>Current order</h4>
<span>{itemCount} {itemCount === 1 ? "item" : "items"} in cart</span>
</div>
<div className="cart-header-icon"><ShoppingCart size={20} /></div>
</div>
<div className="customer-fields">
  <label>
    <span>Customer name <small>Required</small></span>
    <input
      value={customerSearch}
      onChange={(e) => {
        const value = e.target.value;
        setCustomerSearch(value);
        setCustomer("");
        setMobile("");
        setShowCustomerSuggestions(true);
        setNotice("");
      }}
      onFocus={() => setShowCustomerSuggestions(true)}
      placeholder="Search saved customer or enter name"
    />
    {showCustomerSuggestions && customerSearch.trim() && (
      <div className="customer-suggestions">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((savedCustomer) => (
            <button
              type="button"
              key={savedCustomer.id}
              onClick={() => selectSavedCustomer(savedCustomer)}
            >
              <strong>{savedCustomer.name}</strong>
              <span>{savedCustomer.mobile}</span>
            </button>
          ))
        ) : (
          <p>No saved customer found. Enter the mobile number to check.</p>
        )}
      </div>
    )}
  </label>
  <label>
    <span>Mobile number <small>Required</small></span>
    <input
      value={mobile}
      onChange={async (e) => {
        const value = e.target.value.replace(/\D/g, "").slice(0, 10);
        setMobile(value);
        setNotice("");
        if (value.length !== 10) return;
        try {
          const response = await apiFetch(
            "/customers"
          );
          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error("Could not check customers in MongoDB.");
          }
          const match = (data.customers || []).find(
            (c) => String(c.mobile).trim() === value
          );
          if (match) {
            setCustomer(match.name || "");
            setCustomerSearch(match.name || "");
            setShowCustomerSuggestions(false);
            setNotice("Existing customer found and selected.");
          } else {
            setNotice("New customer number. Enter the name and complete the sale to save the customer.");
          }
        } catch (error) {
          console.error(error);
          setNotice("Could not check the customer. Check the backend.");
        }
      }}
      inputMode="numeric"
      maxLength={10}
      placeholder="Enter 10-digit mobile"
    />
  </label>
</div>
<div className="cart-column-labels"><span>ITEM</span><span>QTY</span><span>PRICE</span></div>
<div className="cart-items">
{cart.map((item) => (
<div className="cart-item" key={item.id}>
<div className="cart-item-art" style={{ background: item.color }}>{item.symbol}</div>
<div className="cart-item-details">
<strong>{item.name}</strong>
<span>{money(item.price)} · GST {gstOverride === "product" ? (Number(item.gst) || 0) : Number(gstOverride)}%</span>
<button className="remove-item" onClick={() => removeItem(item.id)}><Trash2 size={13} /> Remove</button>
</div>
<div className="quantity-control">
<button onClick={() => changeQuantity(item.id, -1)} aria-label={`Decrease ${item.name} quantity`}><Minus size={13} /></button>
<span>{item.qty}</span>
<button onClick={() => changeQuantity(item.id, 1)} disabled={item.qty >= item.stock} aria-label={`Increase ${item.name} quantity`}><Plus size={13} /></button>
</div>
<strong className="line-price">{money(item.price * item.qty)}</strong>
</div>
))}
{cart.length === 0 && (
<div className="empty-cart">
<div className="empty-cart-icon"><ShoppingCart size={25} /></div>
<strong>Your cart is empty</strong>
<span>Click on any product to add it to this bill.</span>
</div>
)}
</div>
<div className="bill-summary">
<div className="summary-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
<div className="summary-row discount-row">
<label htmlFor="discount"><Percent size={14} /> Discount</label>
<div className="discount-input">
<input id="discount" type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
<span>%</span>
</div>
<strong className="discount-value">−{money(discountAmount)}</strong>
</div>
<div className="summary-row gst-row">
  <label htmlFor="gst-rate">GST rate</label>
  <div className="gst-select-wrap">
    <select
      id="gst-rate"
      className="gst-select"
      value={gstOverride}
      onChange={(e) => setGstOverride(e.target.value)}
      aria-label="Select GST percentage"
    >
      <option value="0">0%</option>
      <option value="5">5%</option>
      <option value="12">12%</option>
      <option value="18">18%</option>
      <option value="28">28%</option>
    </select>
    <span className="gst-select-arrow" aria-hidden="true">▾</span>
  </div>
  <strong>{money(tax)}</strong>
</div>
<div className="summary-divider" />
<div className="total-row"><span>Total payable</span><strong>{money(total)}</strong></div>
<div className="inclusive-note">Discount applied before calculating GST.</div>
</div>
<div className="payment-section">
<span className="payment-label">Payment method</span>
<div className="payment-options">
{[
{ name: "Cash", icon: Banknote },
{ name: "UPI", icon: Smartphone },
{ name: "Card", icon: CreditCard },
].map(({ name, icon: Icon }) => (
<button key={name} onClick={() => setPayment(name)} className={`payment-option ${payment === name ? "payment-selected" : ""}`}>
<Icon size={18} /><span>{name}</span>
</button>
))}
</div>
<button className="checkout-btn" onClick={completeSale} disabled={cart.length === 0 || isSavingSale}>
<span><CheckCircle2 size={19} /> {isSavingSale ? "Saving sale…" : "Complete sale"}</span>
<strong>{money(total)} <span>→</span></strong>
</button>
<p className="checkout-note">Demo only · No real payment will be collected</p>
</div>
</section>
</div>
</div>
) : (
<div className="page-content">
{notice && (
<div className="notice" role="status">
<span>{notice}</span>
<button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={16} /></button>
</div>
)}
{activePage === "settings" ? (
  <StoreSettings onSave={(nextSettings) => setStoreSettings(nextSettings)} />
) : activePage === "reports" ? (
  <Reports sales={sales} products={products} />
) : activePage === "customers" ? (
  <Customers />
) : activePage === "sales-history" ? (
  <SalesHistory
    sales={sales}
    loading={false}
    onPrintInvoice={(receipt) => {
      try {
        const doc = createInvoicePdf(receipt);
        doc.autoPrint();
        const pdfUrl = doc.output("bloburl");
        const printWindow = window.open(pdfUrl, "_blank");
        if (!printWindow) {
          doc.save(`${receipt.id}.pdf`);
          setNotice("Invoice PDF downloaded because the print window was blocked.");
        }
      } catch (error) {
        console.error("Could not print past invoice:", error);
        setNotice("Could not print this invoice.");
      }
    }}
    onDownloadInvoice={(receipt) => {
      try {
        createInvoicePdf(receipt).save(`${receipt.id}.pdf`);
        setNotice(`Invoice ${receipt.id} downloaded.`);
      } catch (error) {
        console.error("Could not download past invoice:", error);
        setNotice("Could not download this invoice.");
      }
    }}
  />
) : (
  <Products products={products} setProducts={setProducts} />
)}
</div>
)}
<footer className="app-footer"><span>BillEase POS <span className="footer-dot">·</span> Demo version</span><span>Built for simpler billing <span className="footer-heart">♥</span></span></footer>
</main>
{lastReceipt && (
<div className="print-receipt">
<h2>{storeSettings.businessName || "My Store"}</h2>
{storeSettings.address && <p>{storeSettings.address}</p>}
{[storeSettings.phone, storeSettings.email].filter(Boolean).join(" | ") && <p>{[storeSettings.phone, storeSettings.email].filter(Boolean).join(" | ")}</p>}
{storeSettings.gstin && <p>GSTIN: {storeSettings.gstin}</p>}
<p>Sales receipt</p>
<hr />
<p>Invoice: {lastReceipt.id}</p>
<p>Date: {lastReceipt.date}</p>
<p>Customer: {lastReceipt.customer}</p>
{lastReceipt.mobile && <p>Mobile: {lastReceipt.mobile}</p>}
<hr />
<table>
<thead><tr><th align="left">Item</th><th>Qty</th><th align="right">Amount</th></tr></thead>
<tbody>
{lastReceipt.items.map((item) => (
<tr key={item.id}><td>{item.name}</td><td align="center">{item.qty}</td><td align="right">{money(item.price * item.qty)}</td></tr>
))}
</tbody>
</table>
<hr />
<p>Subtotal: {money(lastReceipt.subtotal)}</p>
<p>Discount ({lastReceipt.discountPercent}%): −{money(lastReceipt.discountAmount)}</p>
<p>GST: {money(lastReceipt.tax)}</p>
<h3>Total: {money(lastReceipt.total)}</h3>
<p>Payment: {lastReceipt.payment}</p>
<hr />
<p>Thank you for shopping with us!</p>
</div>
)}
</div>
);
}
export default App;
