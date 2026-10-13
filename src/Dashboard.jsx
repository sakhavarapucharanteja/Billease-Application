import { useMemo } from "react";
import {
  Banknote,
  ShoppingBag,
  TrendingUp,
  Package,
  ArrowUpRight,
  ReceiptText,
  CircleDollarSign,
  ShoppingCart,
} from "lucide-react";

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const todayKey = (date) => {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

export default function Dashboard({ sales = [], products = [], onGoToPos }) {
  const today = todayKey(new Date());

  const todaySales = useMemo(
    () => sales.filter((sale) => todayKey(sale.createdAt || sale.date) === today),
    [sales, today]
  );

  const todayRevenue = todaySales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const todayTransactions = todaySales.length;
  const averageOrder = todayTransactions ? todayRevenue / todayTransactions : 0;
  const itemsSold = todaySales.reduce(
    (sum, sale) => sum + (sale.items || []).reduce((itemSum, item) => itemSum + (Number(item.qty) || 0), 0),
    0
  );
  const lowStockProducts = products.filter((product) => Number(product.stock) <= 5);
  const recentSales = [...sales].sort(
    (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
  ).slice(0, 6);

  const weeklyRevenue = useMemo(() => {
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      const key = todayKey(date);
      const amount = sales
        .filter((sale) => todayKey(sale.createdAt || sale.date) === key)
        .reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
      days.push({
        key,
        label: date.toLocaleDateString("en-IN", { weekday: "short" }),
        amount,
      });
    }
    return days;
  }, [sales]);

  const maxRevenue = Math.max(...weeklyRevenue.map((day) => day.amount), 1);

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <h3>Store overview</h3>
          <p>Here’s how your store is performing today.</p>
        </div>
        <button className="dashboard-primary-button" onClick={onGoToPos}>
          <ShoppingCart size={17} /> Create new bill
        </button>
      </div>

      <div className="dashboard-stats-grid">
        <article className="dashboard-stat-card">
          <div className="dashboard-stat-icon purple"><Banknote size={21} /></div>
          <div className="dashboard-stat-label">Today's revenue</div>
          <strong>{money(todayRevenue)}</strong>
          <span className="dashboard-stat-note">From completed demo sales today</span>
        </article>
        <article className="dashboard-stat-card">
          <div className="dashboard-stat-icon green"><ReceiptText size={21} /></div>
          <div className="dashboard-stat-label">Today's transactions</div>
          <strong>{todayTransactions}</strong>
          <span className="dashboard-stat-note">Completed bills today</span>
        </article>
        <article className="dashboard-stat-card">
          <div className="dashboard-stat-icon blue"><TrendingUp size={21} /></div>
          <div className="dashboard-stat-label">Average order value</div>
          <strong>{money(averageOrder)}</strong>
          <span className="dashboard-stat-note">Revenue divided by transactions</span>
        </article>
        <article className="dashboard-stat-card">
          <div className="dashboard-stat-icon orange"><ShoppingBag size={21} /></div>
          <div className="dashboard-stat-label">Items sold today</div>
          <strong>{itemsSold}</strong>
          <span className="dashboard-stat-note">Total units in completed bills</span>
        </article>
      </div>

      <div className="dashboard-main-grid">
        <section className="dashboard-panel revenue-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h4>Revenue overview</h4>
              <p>Daily revenue for the last 7 days</p>
            </div>
            <span className="dashboard-panel-badge"><CircleDollarSign size={15} /> {money(weeklyRevenue.reduce((sum, day) => sum + day.amount, 0))}</span>
          </div>
          <div className="revenue-chart" aria-label="Revenue for the last seven days">
            {weeklyRevenue.map((day) => (
              <div className="revenue-chart-column" key={day.key} title={`${day.label}: ${money(day.amount)}`}>
                <div className="revenue-bar-track">
                  <div className={`revenue-bar ${day.key === today ? "today" : ""}`} style={{ height: `${day.amount ? Math.max(6, (day.amount / maxRevenue) * 100) : 3}%` }} />
                </div>
                <span className="revenue-day-label">{day.label}</span>
                <span className="revenue-day-value">{day.amount >= 1000 ? `₹${(day.amount / 1000).toFixed(1)}k` : day.amount ? `₹${Math.round(day.amount)}` : "—"}</span>
              </div>
            ))}
          </div>
          {sales.length === 0 && <p className="dashboard-empty-hint">Your revenue chart will update after you complete your first sale.</p>}
        </section>

        <section className="dashboard-panel inventory-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h4>Inventory snapshot</h4>
              <p>Current catalog status</p>
            </div>
            <div className="inventory-heading-icon"><Package size={20} /></div>
          </div>
          <div className="inventory-metric">
            <span>Total products</span>
            <strong>{products.length}</strong>
          </div>
          <div className="inventory-metric">
            <span>Low-stock products</span>
            <strong className={lowStockProducts.length ? "low-stock-number" : ""}>{lowStockProducts.length}</strong>
          </div>
          {lowStockProducts.length > 0 ? (
            <div className="low-stock-list">
              {lowStockProducts.slice(0, 3).map((product) => (
                <div className="low-stock-item" key={product.id}>
                  <span>{product.name}</span><strong>{product.stock} left</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="inventory-ok"><Package size={16} /> No low-stock products right now</div>
          )}
        </section>
      </div>

      <section className="dashboard-panel transactions-panel">
        <div className="dashboard-panel-heading transactions-heading">
          <div>
            <h4>Recent transactions</h4>
            <p>Latest completed bills in this session</p>
          </div>
          <span className="transaction-count">{sales.length} total</span>
        </div>
        {recentSales.length ? (
          <div className="transactions-table-wrap">
            <table className="transactions-table">
              <thead>
                <tr><th>INVOICE</th><th>CUSTOMER</th><th>ITEMS</th><th>PAYMENT</th><th>DATE & TIME</th><th className="amount-cell">TOTAL</th></tr>
              </thead>
              <tbody>
                {recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td><span className="invoice-cell"><ReceiptText size={15} /> {sale.id}</span></td>
                    <td>{sale.customer || "Walk-in Customer"}</td>
                    <td>{(sale.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0)}</td>
                    <td><span className="payment-badge">{sale.payment || "—"}</span></td>
                    <td>{new Date(sale.createdAt || sale.date).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="amount-cell"><strong>{money(sale.total)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dashboard-empty-state">
            <div className="dashboard-empty-icon"><ReceiptText size={25} /></div>
            <strong>No transactions yet</strong>
            <span>Completed sales will appear here with invoice number, payment method and total.</span>
            <button className="dashboard-text-button" onClick={onGoToPos}>Go to POS Billing <ArrowUpRight size={15} /></button>
          </div>
        )}
      </section>
    </section>
  );
}
