import axios, { AxiosError } from "axios";
import { clearToken, emitLogout, getToken } from "./auth-storage";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    // 401 anywhere → drop the session and let the app redirect to login.
    if (error.response?.status === 401 && getToken()) {
      clearToken();
      emitLogout();
    }
    return Promise.reject(error);
  },
);

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

/** Extract a human-readable message from an axios error. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
    if (error.message) return error.message;
  }
  return fallback;
}
