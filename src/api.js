import axios from "axios";

// ✅ CORRECT URL — matches backend
export const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
});
