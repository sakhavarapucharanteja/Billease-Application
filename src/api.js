const API_BASE_URL = "https://billease-api-charan.onrender.com/api";
const AUTH_TOKEN_KEY = "billease_auth_token";

export function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveAuthToken(token) {
  if (!token) {
    throw new Error("Authentication token is missing.");
  }

  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const token = getAuthToken();
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
    response = await fetch(endpoint, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Cannot connect to BillEase. Please check your internet connection and try again."
    );
  }

  if (response.status === 401 && !path.startsWith("/auth/")) {
    window.dispatchEvent(new Event("billease:unauthorized"));
  }

  return response;
}
