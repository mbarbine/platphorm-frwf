const SERVER_NAME = "platphorm-frwf"
const PROTOCOL_VERSION = "2024-11-05"

function result(id, value) {
  return { jsonrpc: "2.0", id: id ?? null, result: value }
}

function error(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } }
}

function dispatch(message) {
  const id = message && typeof message === "object" ? message.id : null
  if (!message || typeof message !== "object" || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return error(id, -32600, "Invalid Request")
  }
  switch (message.method) {
    case "initialize":
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: "1.1.0" },
        instructions: "FRWF exposes MCP introspection only; no gameplay mutation tools are registered.",
      })
    case "ping": return result(id, {})
    case "tools/list": return result(id, { tools: [] })
    case "resources/list": return result(id, { resources: [] })
    case "prompts/list": return result(id, { prompts: [] })
    case "tools/call": return error(id, -32602, "No tools are registered for this site.")
    case "resources/read": return error(id, -32002, "Resource not found.")
    case "prompts/get": return error(id, -32602, "Prompt not found.")
    case "notifications/initialized": return null
    default: return error(id, -32601, "Method not found")
  }
}

export default function handler(request, response) {
  if (request.method === "GET") {
    return response.status(200).json({
      ok: true,
      data: {
        server: { name: SERVER_NAME, version: "1.1.0" },
        protocol: "JSON-RPC 2.0",
        protocolVersion: PROTOCOL_VERSION,
        status: "introspection_only",
        capabilities: { tools: [], resources: [], prompts: [] },
      },
    })
  }
  if (request.method !== "POST") return response.status(405).json(error(null, -32600, "Method not allowed"))

  let payload = request.body
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload) } catch { return response.status(400).json(error(null, -32700, "Parse error")) }
  }
  if (Array.isArray(payload)) {
    if (payload.length === 0) return response.status(400).json(error(null, -32600, "Invalid Request"))
    // SECURITY ENHANCEMENT: Limit batch request size to prevent DoS from large arrays (CWE-400)
    if (payload.length > 20) {
      return response.status(400).json(error(null, -32600, "Batch limit exceeded (maximum 20 requests per batch)"))
    }
    const responses = payload.map(dispatch).filter(Boolean)
    return responses.length ? response.status(200).json(responses) : response.status(204).end()
  }
  const rpcResponse = dispatch(payload)
  return rpcResponse ? response.status(200).json(rpcResponse) : response.status(204).end()
}

