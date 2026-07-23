function trustedSite(hostname) {
  return hostname === "platphormnews.com" || hostname.endsWith(".platphormnews.com")
}

export default function handler(request, response) {
  // Defensive method validation to prevent unexpected side effects on non-safe methods (CWE-650)
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD")
    return response.status(405).json({
      ok: false,
      error: { code: "method_not_allowed", message: "Only GET and HEAD methods are allowed." },
    })
  }

  const host = String(request.headers["x-forwarded-host"] || request.headers.host || "").split(":")[0].toLowerCase()
  if (!trustedSite(host)) {
    return response.status(400).json({
      ok: false,
      error: { code: "untrusted_domain", message: "Route compliance is limited to trusted PlatPhormNews sites.", details: { domain: host } },
    })
  }
  const target = new globalThis.URL("https://base.platphormnews.com/api/v1/route-compliance")
  target.searchParams.set("domain", host)
  target.searchParams.set("mode", "full")

  // Defensively validate and sanitize timeoutMs query parameter to prevent downstream parsing failures, DoS, or parameter injection
  let timeoutMs = "1200"
  const rawTimeout = request.query?.timeoutMs
  if (rawTimeout !== undefined) {
    const parsed = parseInt(String(rawTimeout), 10)
    if (!isNaN(parsed) && parsed >= 100 && parsed <= 10000) {
      timeoutMs = String(parsed)
    }
  }
  target.searchParams.set("timeoutMs", timeoutMs)

  response.setHeader("Location", target.toString())
  return response.status(307).end()
}
