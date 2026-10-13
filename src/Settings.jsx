import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import {
  Building2,
  Save,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";

const API_URL = "/settings";
const STORAGE_KEY = "billease_store_settings_v1";

export const DEFAULT_STORE_SETTINGS = {
  businessName: "My Store",
  phone: "",
  email: "",
  address: "",
  gstin: "",
  logo: "",
};

export function readStoreSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved
      ? { ...DEFAULT_STORE_SETTINGS, ...JSON.parse(saved) }
      : { ...DEFAULT_STORE_SETTINGS };
  } catch (error) {
    console.error("Could not read BillEase store settings:", error);
    return { ...DEFAULT_STORE_SETTINGS };
  }
}

export default function Settings({ onSave }) {
  const [form, setForm] = useState(readStoreSettings);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const response = await apiFetch(API_URL);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Could not load store settings.");
        }

        // Support either { settings: {...} } or a flat settings object.
        const settingsData = data.settings || data.storeSettings || data;
        const settings = { ...DEFAULT_STORE_SETTINGS, ...settingsData };
        if (!cancelled) {
          setForm(settings);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
          onSave?.(settings);
          setError("");
        }
      } catch (loadError) {
        console.error("Could not load BillEase settings from the server:", loadError);
        if (!cancelled) {
          setForm({ ...DEFAULT_STORE_SETTINGS });
          setError(
            "Could not load your business settings. Please check your connection and try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setSaved(false);
    setError("");
  }

  function handleLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file for your logo.");
      event.target.value = "";
      return;
    }

    if (file.size > 1024 * 1024) {
      setError("Please choose a logo smaller than 1 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, logo: String(reader.result || "") }));
      setSaved(false);
      setError("");
    };
    reader.onerror = () => setError("Could not read this image. Please try another file.");
    reader.readAsDataURL(file);
  }

  async function saveSettings(event) {
    event.preventDefault();

    const businessName = form.businessName.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    const address = form.address.trim();
    const gstin = form.gstin.trim().toUpperCase();

    if (!businessName) {
      setError("Please enter your business name.");
      return;
    }
    if (phone && !/^[+\d()\-\s]{7,20}$/.test(phone)) {
      setError("Please enter a valid business phone number.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid business email address.");
      return;
    }
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      setError("Please check the GSTIN format, or leave it blank if not applicable.");
      return;
    }

    const next = { ...form, businessName, phone, email, address, gstin };
    setSaving(true);
    setSaved(false);
    setError("");

    try {
      const response = await apiFetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "The server could not save these settings.");
      }

      // Support either { settings: {...} } or a flat settings object.
      const settingsData = data.settings || data.storeSettings || data;
      const savedSettings = { ...DEFAULT_STORE_SETTINGS, ...settingsData };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSettings));
      setForm(savedSettings);
      setSaved(true);
      onSave?.(savedSettings);
    } catch (saveError) {
      console.error("Could not save BillEase settings:", saveError);
      setError(
        saveError.message ||
          "Settings could not be saved. Check that the backend is running and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetSettings() {
    const confirmed = window.confirm("Reset store details to the default values?");
    if (!confirmed) return;

    setSaving(true);
    setSaved(false);
    setError("");

    try {
      const response = await apiFetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEFAULT_STORE_SETTINGS),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not reset store settings.");
      }

      const settingsData = data.settings || data.storeSettings || data;
      const defaults = { ...DEFAULT_STORE_SETTINGS, ...settingsData };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      setForm(defaults);
      onSave?.(defaults);
      setSaved(true);
    } catch (resetError) {
      console.error("Could not reset BillEase settings:", resetError);
      setError(
        resetError.message ||
          "Could not reset settings. Check that the backend is running and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="store-settings-page">
      <style>{`
        .store-settings-page{max-width:1050px;margin:0 auto;padding:24px;color:#18233b}
        .settings-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}
        .settings-heading h3{margin:0 0 7px;font-size:23px;font-weight:750;letter-spacing:-.4px}
        .settings-heading p{margin:0;color:#7b879e;font-size:13px;line-height:1.6}
        .settings-card{background:#fff;border:1px solid #e5eaf3;border-radius:16px;padding:24px;box-shadow:0 3px 12px rgba(24,35,59,.025)}
        .settings-section-title{display:flex;align-items:center;gap:10px;padding-bottom:17px;margin-bottom:20px;border-bottom:1px solid #edf0f6}
        .settings-section-icon{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:#f0eeff;color:#5946f5}
        .settings-section-title h4{font-size:15px;margin:0 0 4px}
        .settings-section-title p{font-size:12px;color:#8490a7;margin:0}
        .settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 20px}
        .settings-field{display:flex;flex-direction:column;gap:8px;min-width:0}
        .settings-field.full{grid-column:1/-1}
        .settings-field label{font-size:12px;font-weight:650;color:#45516a}
        .settings-field input,.settings-field textarea{width:100%;box-sizing:border-box;border:1px solid #dfe5f0;border-radius:10px;padding:12px 13px;font:inherit;font-size:13px;color:#202b43;background:#fff;outline:none;transition:border-color .18s,box-shadow .18s}
        .settings-field input:focus,.settings-field textarea:focus{border-color:#6957ff;box-shadow:0 0 0 3px rgba(105,87,255,.12)}
        .settings-field textarea{min-height:88px;resize:vertical}
        .settings-field input::placeholder,.settings-field textarea::placeholder{color:#a0aabe}
        .settings-help{font-size:11px;color:#8a95aa;line-height:1.5}
        .settings-logo-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
        .settings-logo-preview{width:84px;height:84px;border:1px dashed #d7deec;border-radius:14px;display:grid;place-items:center;overflow:hidden;background:#fafbff;color:#9aa5ba;flex-shrink:0}
        .settings-logo-preview img{width:100%;height:100%;object-fit:contain}
        .settings-upload{display:inline-flex;align-items:center;gap:8px;padding:10px 13px;border:1px solid #dfe5f0;border-radius:10px;background:#fff;color:#5140e9;font-size:12px;font-weight:650;cursor:pointer}
        .settings-upload input{display:none}
        .settings-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:22px;padding-top:20px;border-top:1px solid #edf0f6}
        .settings-actions-right{display:flex;gap:10px;flex-wrap:wrap}
        .settings-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border-radius:10px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
        .settings-btn:disabled{opacity:.6;cursor:not-allowed}
        .settings-btn.primary{border:1px solid #5845f5;background:#5845f5;color:#fff;box-shadow:0 4px 10px rgba(88,69,245,.16)}
        .settings-btn.secondary{border:1px solid #dfe5f0;background:#fff;color:#5d6880}
        .settings-message{display:flex;align-items:flex-start;gap:8px;border-radius:10px;padding:11px 13px;margin-bottom:17px;font-size:12px;line-height:1.5}
        .settings-message.success{background:#ecfdf4;color:#087747;border:1px solid #c7f1dc}
        .settings-message.error{background:#fff1f2;color:#b42336;border:1px solid #ffd5db}
        @media(max-width:650px){.store-settings-page{padding:16px}.settings-card{padding:17px}.settings-grid{grid-template-columns:1fr}.settings-field.full{grid-column:auto}.settings-heading h3{font-size:20px}.settings-actions{align-items:stretch}.settings-actions-right{width:100%}.settings-actions-right .settings-btn{flex:1}}
      `}</style>

      <div className="settings-heading">
        <div>
          <h3>Store Settings</h3>
          <p>Manage your business details and logo for BillEase receipts.</p>
        </div>
      </div>

      <form className="settings-card" onSubmit={saveSettings}>
        {loading && <div className="settings-help">Loading store settings…</div>}
        {saved && (
          <div className="settings-message success">
            <CheckCircle2 size={17} /> Store settings saved to the database.
          </div>
        )}
        {error && <div className="settings-message error">{error}</div>}

        <div className="settings-section-title">
          <div className="settings-section-icon"><Building2 size={20} /></div>
          <div>
            <h4>Business information</h4>
            <p>These details can be shown on printed and downloaded receipts.</p>
          </div>
        </div>

        <div className="settings-grid">
          <div className="settings-field full">
            <label htmlFor="store-business-name">Business name *</label>
            <input id="store-business-name" name="businessName" value={form.businessName} onChange={updateField} placeholder="e.g. Sri Lakshmi Stores" required maxLength={100} />
          </div>

          <div className="settings-field">
            <label htmlFor="store-phone">Business phone</label>
            <input id="store-phone" name="phone" value={form.phone} onChange={updateField} placeholder="e.g. 9876543210" maxLength={20} />
          </div>

          <div className="settings-field">
            <label htmlFor="store-email">Business email</label>
            <input id="store-email" name="email" type="email" value={form.email} onChange={updateField} placeholder="you@example.com" maxLength={120} />
          </div>

          <div className="settings-field full">
            <label htmlFor="store-address">Business address</label>
            <textarea id="store-address" name="address" value={form.address} onChange={updateField} placeholder="Shop number, street, area, city, state and PIN code" maxLength={500} />
          </div>

          <div className="settings-field full">
            <label htmlFor="store-gstin">GSTIN (optional)</label>
            <input id="store-gstin" name="gstin" value={form.gstin} onChange={updateField} placeholder="15-character GSTIN" maxLength={15} autoCapitalize="characters" />
            <span className="settings-help">Enter a valid GSTIN if your business is registered for GST. Leave blank if not applicable.</span>
          </div>

          <div className="settings-field full">
            <label>Store logo</label>
            <div className="settings-logo-row">
              <div className="settings-logo-preview">
                {form.logo ? <img src={form.logo} alt="Store logo preview" /> : <ImageIcon size={26} />}
              </div>
              <div>
                <label className="settings-upload">
                  <Upload size={15} /> Choose logo
                  <input type="file" accept="image/*" onChange={handleLogo} />
                </label>
                <div className="settings-help" style={{ marginTop: 8 }}>PNG, JPG or WebP. Maximum size: 1 MB.</div>
                {form.logo && (
                  <button
                    type="button"
                    className="settings-btn secondary"
                    style={{ marginTop: 8, padding: "7px 10px", fontSize: 11 }}
                    onClick={() => {
                      setForm((current) => ({ ...current, logo: "" }));
                      setSaved(false);
                    }}
                  >
                    Remove logo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <button type="button" className="settings-btn secondary" onClick={resetSettings} disabled={saving}>
            <RotateCcw size={15} /> Reset
          </button>
          <div className="settings-actions-right">
            <button type="submit" className="settings-btn primary" disabled={saving || loading}>
              <Save size={16} /> {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
