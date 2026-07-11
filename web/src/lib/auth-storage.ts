// Token persistence + a lightweight event bus so the axios interceptor can trigger logout.

const TOKEN_KEY = "ft_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export const AUTH_LOGOUT_EVENT = "auth:logout";

export function emitLogout(): void {
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
}
