// Isomorphic: console + standard Response. Safe to import from server route
// handlers and from the tRPC client links in `router.tsx`.

export async function logBadResponse(
  label: string,
  request: { method?: string | undefined; url: string },
  response: Response,
): Promise<void> {
  if (response.ok) return
  let body = ''
  try {
    body = await response.clone().text()
    if (body.length > 1000) body = body.slice(0, 1000) + '… (truncated)'
  } catch {
    // body already consumed or unreadable — status line alone is still useful
  }
  const method = request.method ?? 'GET'
  console.error(
    `[${label}] ${method} ${request.url} → ${response.status} ${response.statusText}` +
      (body ? `\n${body}` : ''),
  )
}
