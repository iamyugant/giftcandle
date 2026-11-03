import mondaySdk from "monday-sdk-js";

export const monday = mondaySdk();

export class ApiError extends Error {
  status;
  fields;

  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function headersFor(body) {
  const { data: token } = await monday.get("sessionToken");

  return {
    Authorization: `Bearer ${token}`,
    ...(body ? { "Content-Type": "application/json" } : {}),
  };
}

async function toApiError(res) {
  const err = (await res.json().catch(() => null))?.error;
  return new ApiError(res.status, err?.message ?? "Request failed.", err?.fields);
}

async function request(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    headers: await headersFor(body),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) throw await toApiError(res);

  return res.status === 204 ? undefined : res.json();
}

export const fetchFragrances = () => request("/api/fragrances");
export const addFragrance = (input) => request("/api/fragrances", "POST", input);
export const updateFragrance = (id, input) => request(`/api/fragrances/${id}`, "PUT", input);
export const deleteFragrance = (id) => request(`/api/fragrances/${id}`, "DELETE");

export const createOrder = (order) => request("/api/orders", "POST", order);
