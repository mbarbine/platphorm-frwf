function trustedSite(hostname) {
  return hostname === "platphormnews.com" || hostname.endsWith(".platphormnews.com")
}

export default function handler(request, response) {
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
  target.searchParams.set("timeoutMs", String(request.query?.timeoutMs || "1200"))
  response.setHeader("Location", target.toString())
  return response.status(307).end()
}
