const LOCAL_API_BASE = "http://localhost:8000/api";

export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return LOCAL_API_BASE;
  }

  return "/api";
}