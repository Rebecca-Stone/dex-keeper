const rawBase = import.meta.env.VITE_API_URL || "";
const withScheme = (base) => {
  if (base.startsWith("http")) return base;
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(base)
    ? `http://${base}`
    : `https://${base}`;
};
const API_BASE = rawBase
  ? withScheme(rawBase)
  : "";
const TOKEN_KEY = "dexkeeper:token";
const USER_KEY = "dexkeeper:user";

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || "Request failed");
    err.status = res.status;
    throw err;
  }
  if (!data || typeof data !== "object") {
    // A 2xx response that isn't JSON means we aren't talking to the real API
    // (e.g. a misconfigured deployment serving the app's HTML for /api routes).
    const err = new Error("Unexpected response from the server.");
    err.status = res.status;
    throw err;
  }
  return data;
}

export function getStoredSession() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const username = sessionStorage.getItem(USER_KEY);
  return token && username ? { token, username } : null;
}

export function storeSession({ token, username }) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, username);
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

function validSession(data) {
  return typeof data.token === "string" && data.token && typeof data.username === "string" && data.username;
}

export async function signup(username, password) {
  const data = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!validSession(data)) throw new Error("Unexpected response from the server.");
  storeSession(data);
  return data;
}

export async function login(username, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!validSession(data)) throw new Error("Unexpected response from the server.");
  storeSession(data);
  return data;
}

export async function fetchLists() {
  const data = await request("/api/lists");
  if (!Array.isArray(data.lists)) throw new Error("Unexpected response from the server.");
  return data.lists;
}

export async function saveLists(lists) {
  await request("/api/lists", {
    method: "PUT",
    body: JSON.stringify({ lists }),
  });
}
