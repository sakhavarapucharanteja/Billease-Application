
const API_BASE_URL = "https://billease-api-charan.onrender.com/api";

const AUTH_TOKEN_KEY = "billease_auth_token";
const ADMIN_TOKEN_KEY = "billease_admin_auth_token";

export function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveAuthToken(token) {
  if (!token) throw new Error("Authentication token is missing.");
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getAdminAuthToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveAdminAuthToken(token) {
  if (!token) throw new Error("Admin authentication token is missing.");
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminAuthToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function request(path, options, token) {
  const headers = new Headers(options.headers || {});

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const endpoint = `${API_BASE_URL}/${String(path).replace(/^\/+/, "")}`;

  let response;

  try {
    response = await fetch(endpoint, { ...options, headers });
  } catch {
    throw new Error(
      "Cannot connect to BillEase. Check your internet connection and try again."
    );
  }

  if (response.status === 401) {
    if (token === getAdminAuthToken() && token) {
      window.dispatchEvent(new Event("billease:admin-unauthorized"));
    } else if (!path.startsWith("/auth/")) {
      window.dispatchEvent(new Event("billease:unauthorized"));
    }
  }

  return response;
}

export function apiFetch(path, options = {}) {
  return request(path, options, getAuthToken());
}

export function adminApiFetch(path, options = {}) {
  return request(path, options, getAdminAuthToken());
}
