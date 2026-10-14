
import {
  Settings,
  Sparkles,
  ArrowRight,
  LogOut,
} from "lucide-react";
import "./SidebarFooter.css";

export default function SidebarFooter({
  user = { name: "User", email: "" },
  onSettings,
  onExplorePlans,
  onLogout,
}) {
  const initial = user?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="sidebar-footer">
      <button
        type="button"
        className="sidebar-settings"
        onClick={onSettings}
      >
        <Settings size={22} />
        <span>Settings</span>
      </button>

      <div className="trial-card lifetime-card">
        <div className="trial-heading">
          <Sparkles size={20} />
          <strong>BillEase Lifetime</strong>
        </div>

        <p>Simple billing for your business.</p>
        <p>One-time payment. No monthly fees.</p>

        <button
          type="button"
          className="explore-plans"
          onClick={onExplorePlans}
        >
          <span>Contact for access</span>
          <ArrowRight size={17} />
        </button>
      </div>

      <div className="sidebar-user">
        <div className="user-avatar">{initial}</div>

        <div className="user-details">
          <strong>{user?.name || "User"}</strong>
          <span>{user?.email || ""}</span>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={onLogout}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={19} />
        </button>
      </div>
    </div>
  );
}
