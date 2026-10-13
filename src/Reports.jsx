import { useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  IndianRupee,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  CreditCard,
  Package,
  FileSpreadsheet,
} from "lucide-react";
import "./Reports.css";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

function getSaleDate(sale) {
  const value = sale.createdAt || sale.date;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function Reports({ sales = [], products = [] }) {
  const today = dateKey(new Date());
  const firstOfMonth = dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const date = getSaleDate(sale);
      if (!date) return false;
      const key = dateKey(date);
      return (!startDate || key >= startDate) && (!endDate || key <= endDate);
    });
  }, [sales, startDate, endDate]);

  const metrics = useMemo(() => {
    const revenue = filteredSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const gst = filteredSales.reduce((sum, sale) => sum + (Number(sale.tax) || 0), 0);
    const units = filteredSales.reduce(
      (sum, sale) => sum + (Array.isArray(sale.items)
        ? sale.items.reduce((itemSum, item) => itemSum + (Number(item.qty) || 0), 0)
        : 0),
      0
    );
    const paymentMethods = filteredSales.reduce((result, sale) => {
      const method = sale.payment || "Unknown";
      result[method] = (result[method] || 0) + (Number(sale.total) || 0);
      return result;
    }, {});
    return {
      revenue,
      gst,
      units,
      count: filteredSales.length,
      average: filteredSales.length ? revenue / filteredSales.length : 0,
      paymentMethods,
    };
  }, [filteredSales]);

  const dailySales = useMemo(() => {
    const groups = {};
    filteredSales.forEach((sale) => {
      const date = getSaleDate(sale);
      if (!date) return;
      const key = dateKey(date);
      groups[key] = (groups[key] || 0) + (Number(sale.total) || 0);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).slice(-7);
  }, [filteredSales]);

  const bestSellers = useMemo(() => {
    const groups = {};
    filteredSales.forEach((sale) => {
      (Array.isArray(sale.items) ? sale.items : []).forEach((item) => {
        const name = item.name || item.productName || "Product";
        if (!groups[name]) groups[name] = { name, quantity: 0, revenue: 0 };
        const quantity = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        const gstRate = Number(item.gst) || 0;
        groups[name].quantity += quantity;
        groups[name].revenue += price * quantity * (1 + gstRate / 100);
      });
    });
    return Object.values(groups).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }, [filteredSales]);

  const maxDaily = Math.max(...dailySales.map(([, amount]) => amount), 1);
  const lowStock = products.filter((product) => Number(product.stock) <= 5);

  function exportSales() {
    const rows = [
      ["Invoice", "Date", "Customer", "Mobile", "Payment Method", "Subtotal", "Discount", "GST", "Total"],
      ...filteredSales.map((sale) => [
        sale.id || sale.invoiceNumber || sale._id || "",
        sale.date || getSaleDate(sale)?.toLocaleString("en-IN") || "",
        sale.customer || sale.customerName || "",
        sale.mobile || "",
        sale.payment || "",
        sale.subtotal ?? "",
        sale.discountAmount ?? "",
        sale.tax ?? "",
        sale.total ?? "",
      ]),
    ];
    downloadCsv("billease-sales-report.csv", rows);
  }

  function exportProducts() {
    const rows = [
      ["Product", "SKU", "Category", "Stock", "Price", "GST %"],
      ...products.map((product) => [
        product.name || "",
        product.sku || "",
        product.category || "",
        product.stock ?? 0,
        product.price ?? 0,
        product.gst ?? 0,
      ]),
    ];
    downloadCsv("billease-inventory-report.csv", rows);
  }

  return (
    <div className="page-content reports-page">
      <div className="page-heading reports-heading">
        <div>
          <h3>Reports & Analytics</h3>
          <p>Review sales performance, payments, products and inventory.</p>
        </div>
        <div className="reports-actions">
          <button className="report-export-btn" onClick={exportSales}>
            <Download size={16} /> Export sales
          </button>
          <button className="report-export-btn report-export-secondary" onClick={exportProducts}>
            <FileSpreadsheet size={16} /> Export inventory
          </button>
        </div>
      </div>

      <section className="reports-filter">
        <div className="reports-filter-title"><CalendarDays size={18} /><strong>Report period</strong></div>
        <label>
          <span>From</span>
          <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <button className="report-reset-btn" onClick={() => { setStartDate(firstOfMonth); setEndDate(today); }}>This month</button>
      </section>

      <div className="reports-metrics">
        <article className="report-metric-card">
          <div className="report-metric-icon purple"><IndianRupee size={19} /></div>
          <span>Total revenue</span>
          <strong>{money(metrics.revenue)}</strong>
          <small>For selected period</small>
        </article>
        <article className="report-metric-card">
          <div className="report-metric-icon blue"><ReceiptText size={19} /></div>
          <span>Completed bills</span>
          <strong>{metrics.count}</strong>
          <small>Saved transactions</small>
        </article>
        <article className="report-metric-card">
          <div className="report-metric-icon green"><TrendingUp size={19} /></div>
          <span>Average bill</span>
          <strong>{money(metrics.average)}</strong>
          <small>Revenue per bill</small>
        </article>
        <article className="report-metric-card">
          <div className="report-metric-icon orange"><CreditCard size={19} /></div>
          <span>GST collected</span>
          <strong>{money(metrics.gst)}</strong>
          <small>Recorded GST total</small>
        </article>
      </div>

      <div className="reports-main-grid">
        <section className="report-panel">
          <div className="report-panel-heading">
            <div><h4>Sales trend</h4><p>Daily revenue in the selected period</p></div>
            <span className="report-panel-icon"><TrendingUp size={18} /></span>
          </div>
          {dailySales.length ? (
            <div className="sales-chart" role="img" aria-label="Daily sales revenue bar chart">
              {dailySales.map(([day, amount]) => (
                <div className="sales-chart-column" key={day}>
                  <strong>{money(amount)}</strong>
                  <div className="sales-chart-track"><div className="sales-chart-bar" style={{ height: `${Math.max(5, (amount / maxDaily) * 100)}%` }} /></div>
                  <span>{new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="report-empty"><ShoppingBag size={28} /><strong>No sales for this period</strong><span>Completed bills will appear here once saved.</span></div>
          )}
        </section>

        <section className="report-panel">
          <div className="report-panel-heading">
            <div><h4>Payment methods</h4><p>Revenue grouped by payment type</p></div>
            <span className="report-panel-icon"><CreditCard size={18} /></span>
          </div>
          {Object.keys(metrics.paymentMethods).length ? (
            <div className="payment-report-list">
              {Object.entries(metrics.paymentMethods).sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
                <div className="payment-report-row" key={method}>
                  <span>{method}</span><div className="payment-report-track"><div style={{ width: `${metrics.revenue ? amount / metrics.revenue * 100 : 0}%` }} /></div><strong>{money(amount)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="report-empty compact"><CreditCard size={25} /><span>No payment data available yet.</span></div>
          )}
          <div className="report-summary-line"><span>Items sold</span><strong>{metrics.units}</strong></div>
        </section>
      </div>

      <div className="reports-bottom-grid">
        <section className="report-panel">
          <div className="report-panel-heading">
            <div><h4>Top-selling products</h4><p>Ranked by units sold</p></div>
            <span className="report-panel-icon"><Package size={18} /></span>
          </div>
          {bestSellers.length ? (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead><tr><th>Product</th><th>Qty sold</th><th>Estimated revenue</th></tr></thead>
                <tbody>{bestSellers.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.quantity}</td><td>{money(item.revenue)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <div className="report-empty compact"><ShoppingBag size={25} /><span>No product sales found for this period.</span></div>}
        </section>

        <section className="report-panel">
          <div className="report-panel-heading">
            <div><h4>Inventory overview</h4><p>Current stock from your product catalog</p></div>
            <span className="report-panel-icon"><Package size={18} /></span>
          </div>
          <div className="inventory-summary">
            <div><span>Total products</span><strong>{products.length}</strong></div>
            <div><span>Low stock (5 or fewer)</span><strong className={lowStock.length ? "low-stock-number" : ""}>{lowStock.length}</strong></div>
          </div>
          {lowStock.length ? (
            <div className="low-stock-list">{lowStock.slice(0, 5).map((product) => <div key={product.id || product._id}><span>{product.name}</span><strong>{Number(product.stock) || 0} left</strong></div>)}</div>
          ) : <div className="stock-ok-note">No products are at or below the low-stock threshold.</div>}
        </section>
      </div>

      <section className="report-panel report-transactions">
        <div className="report-panel-heading">
          <div><h4>Recent transactions</h4><p>{filteredSales.length} bills in the selected period</p></div>
          <button className="report-text-btn" onClick={exportSales}><Download size={15} /> Download CSV</button>
        </div>
        {filteredSales.length ? (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Payment</th><th>Total</th></tr></thead>
              <tbody>{[...filteredSales].sort((a, b) => (getSaleDate(b)?.getTime() || 0) - (getSaleDate(a)?.getTime() || 0)).slice(0, 10).map((sale, index) => (
                <tr key={sale._id || sale.id || index}>
                  <td>{sale.id || sale.invoiceNumber || sale._id || "—"}</td>
                  <td>{getSaleDate(sale)?.toLocaleDateString("en-IN") || sale.date || "—"}</td>
                  <td>{sale.customer || sale.customerName || "Walk-in customer"}</td>
                  <td><span className="report-payment-badge">{sale.payment || "—"}</span></td>
                  <td>{money(sale.total)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="report-empty compact"><ReceiptText size={25} /><span>No saved transactions match this date range.</span></div>}
      </section>
      <p className="reports-footnote">Reports use the sales and product data currently returned by your BillEase backend. Inventory counts reflect current stock, not historical stock levels.</p>
    </div>
  );
}
