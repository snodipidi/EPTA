export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

/** false (VITE_USE_MOCK=false) — ходить в реальный backend; иначе мок-данные. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
