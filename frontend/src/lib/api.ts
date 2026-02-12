import { getIdToken } from "./firebase";

const API_BASE = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getIdToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Er ging iets mis" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// Dashboard
export const getDashboard = () => request("/dashboard");

// Invoices
export const getInvoices = () => request("/invoices");
export const getInvoice = (id: string) => request(`/invoices/${id}`);
export const createInvoice = (data: any) =>
  request("/invoices", { method: "POST", body: JSON.stringify(data) });
export const updateInvoice = (id: string, data: any) =>
  request(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteInvoice = (id: string) =>
  request(`/invoices/${id}`, { method: "DELETE" });
export const generateInvoicePdf = (id: string) =>
  request(`/invoices/${id}/pdf`, { method: "POST" });
export const sendInvoice = (id: string) =>
  request(`/invoices/${id}/send`, { method: "POST" });

// Expenses
export const getExpenses = () => request("/expenses");
export const getExpense = (id: string) => request(`/expenses/${id}`);
export const uploadExpense = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return request("/expenses/upload", { method: "POST", body: formData });
};
export const createExpense = (data: any) =>
  request("/expenses", { method: "POST", body: JSON.stringify(data) });
export const updateExpense = (id: string, data: any) =>
  request(`/expenses/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteExpense = (id: string) =>
  request(`/expenses/${id}`, { method: "DELETE" });

// Customers
export const getCustomers = () => request("/customers");
export const getCustomer = (id: string) => request(`/customers/${id}`);
export const createCustomer = (data: any) =>
  request("/customers", { method: "POST", body: JSON.stringify(data) });
export const updateCustomer = (id: string, data: any) =>
  request(`/customers/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteCustomer = (id: string) =>
  request(`/customers/${id}`, { method: "DELETE" });
