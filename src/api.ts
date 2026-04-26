const API_BASE_URL = import.meta.env.VITE_LIBRA_API_BASE_URL ?? "http://localhost:8080";

export async function getBackendHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/actuator/health`);
  if (!response.ok) {
    throw new Error(`Backend health check failed: ${response.status}`);
  }
  return response.json() as Promise<{ status: string }>;
}
