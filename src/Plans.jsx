
import { ArrowLeft, Check, Sparkles, MessageCircle } from "lucide-react";
import "./Plans.css";

const plan = {
  name: "BillEase Lifetime",
  description:
    "Everything you need to manage billing, products, customers, and sales in one place.",
  features: [
    "Fast point-of-sale billing",
    "Product and inventory management",
    "Customer management",
    "Professional invoice printing",
    "Sales history and reports",
    "One-time payment",
    "Lifetime access",
  ],
};

export default function Plans({ onBack, onChoosePlan }) {
  return (
    <div className="plans-page">
      <button
        type="button"
        className="plans-back"
        onClick={onBack}
      >
        <ArrowLeft size={18} />
        Back to workspace
      </button>

      <header className="plans-heading">
        <div className="plans-icon">
          <Sparkles size={25} />
        </div>

        <span className="plans-eyebrow">
          SIMPLE BILLING. SMARTER BUSINESS.
        </span>

        <h1>Make billing effortless.</h1>

        <p>
          Meet BillEase — a simpler way to manage your
          store, inventory, and customers.
        </p>
      </header>

      <section className="plans-grid">
        <article className="plan-card plan-featured">
          <div className="plan-badge">
            <Sparkles size={14} />
            Lifetime plan
          </div>

          <h2>{plan.name}</h2>

          <p className="plan-description">
            {plan.description}
          </p>

          <div className="plan-price">
            <strong>Contact us</strong>
            <span>One-time payment</span>
          </div>

          <div className="plan-divider" />

          <h3 className="plan-includes">
            Everything included
          </h3>

          <ul className="plan-features">
            {plan.features.map((feature) => (
              <li key={feature}>
                <span className="plan-check">
                  <Check size={15} />
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          
            <button
            type="button"
            className="plan-button plan-button-primary"
            onClick={() => {
                const phone = "918497920031";
                const message =
                "Hi, I'm interested in BillEase Lifetime Access. Please share the pricing and setup details.";

                window.open(
                `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
                "_blank",
                "noopener,noreferrer"
                );
            }}
            >
            <MessageCircle size={18} />
            Contact on WhatsApp
            </button>


          <p className="plan-terms">
            No monthly fees. Contact us for pricing and setup.
          </p>
        </article>
      </section>

      <footer className="plans-footer">
        <Sparkles size={15} />
        <span>BillEase · Billing made simple.</span>
      </footer>
    </div>
  );
}
