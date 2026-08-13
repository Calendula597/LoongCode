// The endpoints' 401 error body is typed `unknown`, so res.error narrows to `{}`.
export function errorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "message" in error) return String(error.message)
  return fallback
}
