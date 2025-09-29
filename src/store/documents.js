// src/api/docs.ts
const API_BASE = "https://jsramverk-wisesang-e6hme9cec4d2fybq.northeurope-01.azurewebsites.net/api";

export async function getDocs() {
  try {
    const res = await fetch(`${API_BASE}/docs`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch docs:", error);
    return null;
  }
}