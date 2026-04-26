import { apiClient, setAuthToken } from "./apiClient";

let currentUser = null;
let initialized = false;
let refreshPromise = null;
const listeners = new Set();

function toLegacyUserShape(user) {
  if (!user) return null;
  return {
    uid: user.id,
    displayName: user.name,
    email: user.email,
    role: user.role,
  };
}

function notifyAuthState() {
  for (const callback of listeners) {
    callback(currentUser);
  }
}

export async function refreshAuthState(force = false) {
  if (refreshPromise && !force) {
    return refreshPromise;
  }

  refreshPromise = apiClient
    .get("/auth/me")
    .then((response) => {
      currentUser = toLegacyUserShape(response.data.user);
      initialized = true;
      notifyAuthState();
      return currentUser;
    })
    .catch(() => {
      currentUser = null;
      initialized = true;
      notifyAuthState();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export function setAuthenticatedUser(user) {
  currentUser = toLegacyUserShape(user);
  initialized = true;
  notifyAuthState();
}

export const auth = {
  get currentUser() {
    return currentUser;
  },
  onAuthStateChanged(callback) {
    listeners.add(callback);
    callback(currentUser);

    if (!initialized) {
      refreshAuthState().catch(() => null);
    }

    return () => listeners.delete(callback);
  },
  async signOut() {
    setAuthToken(null);
    currentUser = null;
    initialized = true;
    notifyAuthState();
  },
};

