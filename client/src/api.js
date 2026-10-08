export async function api(path, { body, ...options } = {}) {
  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    response = await fetch(path, {
      ...options,
      signal: options.signal || controller.signal,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...options.headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(controller.signal.aborted ? "The request took too long. Refresh to check whether it saved before trying again." : "Unable to reach Resolve. Check your connection and try again.");
  } finally { clearTimeout(timeout); }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Resolve could not complete the request (${response.status}).`);
  if (data === null) throw new Error("Resolve returned an unexpected response. Refresh and try again.");
  return data;
}
