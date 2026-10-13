
import { useMemo, useState } from "react";
import {
  Search,
  ReceiptText,
  CalendarDays,
  Eye,
  Printer,
  Download,
  X,
  Package,
  UserRound,
} from "lucide-react";
import "./SalesHistory.css";

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const getSaleDate = (sale) => {
  const value = sale.createdAt || sale.date;
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (sale) => {
  const date = getSaleDate(sale);

  return date
    ? date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Date unavailable";
};

export default function SalesHistory({
  sales = [],
  loading = false,
  onPrintInvoice,
  onDownloadInvoice,
}) {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...sales]
      .filter((sale) => {
        const invoice = String(sale.id || "").toLowerCase();
        const customer = String(sale.customer || "").toLowerCase();
        const mobile = String(sale.mobile || "").toLowerCase();

        const matchesSearch =
          !query ||
          invoice.includes(query) ||
          customer.includes(query) ||
          mobile.includes(query);

        const date = getSaleDate(sale);

        let matchesFrom = true;
        let matchesTo = true;

        if (fromDate) {
          matchesFrom =
            date !== null &&
            date >= new Date(`${fromDate}T00:00:00`);
        }

        if (toDate) {
          matchesTo =
            date !== null &&
            date <= new Date(`${toDate}T23:59:59.999`);
        }

        return matchesSearch && matchesFrom && matchesTo;
      })
      .sort((a, b) => {
        const dateA = getSaleDate(a)?.getTime() || 0;
        const dateB = getSaleDate(b)?.getTime() || 0;
        return dateB - dateA;
      });
  }, [sales, search, fromDate, toDate]);

  const filteredTotal = filteredSales.reduce(
    (sum, sale) => sum + (Number(sale.total) || 0),
    0
  );

  const clearFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
  };

  const closeDetails = () => setSelectedSale(null);

  return (
    <section className="sales-history-page">
      <div className="sales-history-heading">
        <div>
          <h3>Sales History</h3>
          <p>Search invoices, review completed sales, and view past bills.</p>
        </div>

        <div className="sales-history-count">
          <ReceiptText size={17} />
          {filteredSales.length} {filteredSales.length === 1 ? "invoice" : "invoices"}
        </div>
      </div>

      <div className="sales-history-summary">
        <div className="sales-history-summary-icon">
          <ReceiptText size={22} />
        </div>
        <div>
          <span>Total value of filtered invoices</span>
          <strong>{money(filteredTotal)}</strong>
        </div>
      </div>

      <div className="sales-history-filters">
        <label className="sales-history-search">
          <Search size={18} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search invoice, customer or mobile..."
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </label>

        <label className="sales-history-date">
          <span>From</span>
          <CalendarDays size={16} />
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>

        <label className="sales-history-date">
          <span>To</span>
          <CalendarDays size={16} />
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => setToDate(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="sales-history-clear"
          onClick={clearFilters}
        >
          Clear filters
        </button>
      </div>

      <div className="sales-history-table-panel">
        {loading ? (
          <div className="sales-history-empty">
            Loading saved invoices...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="sales-history-empty">
            <div className="sales-history-empty-icon">
              <ReceiptText size={27} />
            </div>
            <strong>No invoices found</strong>
            <span>
              {sales.length === 0
                ? "Completed sales saved in MongoDB will appear here."
                : "Try a different search or date range."}
            </span>
            {(search || fromDate || toDate) && (
              <button
                type="button"
                className="sales-history-clear"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="sales-history-table-wrap">
            <table className="sales-history-table">
              <thead>
                <tr>
                  <th>INVOICE</th>
                  <th>CUSTOMER</th>
                  <th>MOBILE</th>
                  <th>ITEMS</th>
                  <th>PAYMENT</th>
                  <th>DATE &amp; TIME</th>
                  <th className="sales-history-amount">TOTAL</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {filteredSales.map((sale) => {
                  const quantity = (sale.items || []).reduce(
                    (sum, item) => sum + (Number(item.qty) || 0),
                    0
                  );

                  return (
                    <tr key={sale._id || sale.id}>
                      <td>
                        <span className="sales-history-invoice">
                          <ReceiptText size={15} />
                          {sale.id || "Invoice"}
                        </span>
                      </td>
                      <td>{sale.customer || "Walk-in Customer"}</td>
                      <td>{sale.mobile || "—"}</td>
                      <td>{quantity}</td>
                      <td>
                        <span className="sales-history-payment">
                          {sale.payment || "—"}
                        </span>
                      </td>
                      <td>{formatDate(sale)}</td>
                      <td className="sales-history-amount">
                        <strong>{money(sale.total)}</strong>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="sales-history-view"
                          onClick={() => setSelectedSale(sale)}
                          title="View invoice details"
                        >
                          <Eye size={15} />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredSales.length > 0 && (
          <div className="sales-history-footer">
            Showing {filteredSales.length} of {sales.length} saved invoices
          </div>
        )}
      </div>

      {selectedSale && (
        <div
          className="sales-history-modal-backdrop"
          onClick={closeDetails}
        >
          <section
            className="sales-history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sales-history-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sales-history-modal-header">
              <div>
                <span>PAST INVOICE</span>
                <h3 id="sales-history-detail-title">
                  {selectedSale.id}
                </h3>
              </div>

              <button
                type="button"
                className="sales-history-close"
                onClick={closeDetails}
                aria-label="Close invoice details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="sales-history-customer">
              <UserRound size={19} />
              <div>
                <strong>
                  {selectedSale.customer || "Walk-in Customer"}
                </strong>
                <span>{selectedSale.mobile || "No mobile number"}</span>
              </div>
              <span className="sales-history-payment">
                {selectedSale.payment || "—"}
              </span>
            </div>

            <div className="sales-history-detail-date">
              {formatDate(selectedSale)}
            </div>

            <div className="sales-history-detail-items">
              <div className="sales-history-detail-label">
                <Package size={17} />
                <strong>Items purchased</strong>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th className="sales-history-amount">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedSale.items || []).map((item, index) => (
                    <tr key={item.id || item.sku || `${item.name}-${index}`}>
                      <td>{item.name || "Item"}</td>
                      <td>{Number(item.qty) || 0}</td>
                      <td>{money(item.price)}</td>
                      <td className="sales-history-amount">
                        {money(Number(item.price || 0) * Number(item.qty || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sales-history-totals">
              <div>
                <span>Subtotal</span>
                <strong>{money(selectedSale.subtotal)}</strong>
              </div>
              <div>
                <span>
                  Discount ({Number(selectedSale.discountPercent) || 0}%)
                </span>
                <strong>
                  −{money(selectedSale.discountAmount)}
                </strong>
              </div>
              <div>
                <span>GST</span>
                <strong>{money(selectedSale.tax)}</strong>
              </div>
              <div className="sales-history-grand-total">
                <span>Total payable</span>
                <strong>{money(selectedSale.total)}</strong>
              </div>
            </div>

            <div className="sales-history-modal-actions">
              <button
                type="button"
                className="sales-history-print"
                onClick={() => onPrintInvoice?.(selectedSale)}
              >
                <Printer size={16} />
                Print invoice
              </button>
              <button
                type="button"
                className="sales-history-download"
                onClick={() => onDownloadInvoice?.(selectedSale)}
              >
                <Download size={16} />
                Download PDF
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
