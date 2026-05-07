import { computed, ref } from "vue";

export type UserSummary = {
  id: string;
  email: string;
  name: string;
  role: string;
  oauth_provider: string | null;
};

type TokenResponse = {
  access_token: string;
  access_token_expires_at: string;
  refresh_token: string;
  refresh_token_expires_at: string;
  token_type: string;
  user: UserSummary;
};

const ACCESS_KEY = "libra.auth.access_token";
const REFRESH_KEY = "libra.auth.refresh_token";
const USER_KEY = "libra.auth.user";

const API_BASE_URL = (import.meta.env.VITE_LIBRA_API_BASE_URL as string | undefined) ?? "";

const accessToken = ref<string | null>(localStorage.getItem(ACCESS_KEY));
const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_KEY));
const currentUser = ref<UserSummary | null>(readUser());
const ready = ref(false);

function readUser(): UserSummary | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSummary;
  } catch {
    return null;
  }
}

function persist(tokens: TokenResponse) {
  accessToken.value = tokens.access_token;
  refreshToken.value = tokens.refresh_token;
  currentUser.value = tokens.user;
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  localStorage.setItem(USER_KEY, JSON.stringify(tokens.user));
}

function clear() {
  accessToken.value = null;
  refreshToken.value = null;
  currentUser.value = null;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new AuthError(response.status, detail?.message ?? `${response.status} ${response.statusText}`, detail?.error);
  }
  return response.json() as Promise<T>;
}

let refreshPromise: Promise<boolean> | null = null;

function isAuthFailure(status: number) {
  return status === 401 || status === 403;
}

async function attemptRefresh(): Promise<boolean> {
  if (!refreshToken.value) return false;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const tokens = await postJson<TokenResponse>("/api/v1/auth/refresh", {
        refresh_token: refreshToken.value,
      });
      persist(tokens);
      return true;
    } catch {
      clear();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function fetchMe(): Promise<UserSummary | null> {
  if (!accessToken.value) return null;
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken.value}` },
  });
  if (response.ok) {
    return response.json() as Promise<UserSummary>;
  }
  if (isAuthFailure(response.status) && (await attemptRefresh())) {
    const retry = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken.value}` },
    });
    if (retry.ok) {
      return retry.json() as Promise<UserSummary>;
    }
    if (isAuthFailure(retry.status)) {
      clear();
    }
    return null;
  }
  if (isAuthFailure(response.status)) {
    clear();
  }
  return null;
}

async function bootstrap() {
  if (ready.value) return;
  if (accessToken.value || refreshToken.value) {
    const me = await fetchMe();
    if (me) {
      currentUser.value = me;
      localStorage.setItem(USER_KEY, JSON.stringify(me));
    } else {
      clear();
    }
  }
  ready.value = true;
}

async function login(email: string, password: string) {
  const tokens = await postJson<TokenResponse>("/api/v1/auth/login", { email, password });
  persist(tokens);
}

async function signup(email: string, password: string, name: string) {
  const tokens = await postJson<TokenResponse>("/api/v1/auth/signup", { email, password, name });
  persist(tokens);
}

async function logout() {
  const refresh = refreshToken.value;
  clear();
  if (refresh) {
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
    } catch {
      // ignore: client state is already cleared
    }
  }
}

function applyOauthCallback(params: URLSearchParams): boolean {
  const access = params.get("access_token");
  const refresh = params.get("refresh_token");
  if (!access || !refresh) return false;
  accessToken.value = access;
  refreshToken.value = refresh;
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  return true;
}

export function useAuth() {
  return {
    accessToken,
    refreshToken,
    currentUser,
    ready,
    isAuthenticated: computed(() => !!accessToken.value),
    bootstrap,
    login,
    signup,
    logout,
    attemptRefresh,
    fetchMe,
    applyOauthCallback,
    clear,
  };
}

export class AuthError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function authorizationHeader(): Record<string, string> {
  return accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {};
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const buildHeaders = (): HeadersInit => ({
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
    ...authorizationHeader(),
  });

  let response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: buildHeaders() });
  if (!isAuthFailure(response.status)) return response;
  if (!(await attemptRefresh())) return response;
  response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: buildHeaders() });
  if (isAuthFailure(response.status)) {
    clear();
  }
  return response;
}
