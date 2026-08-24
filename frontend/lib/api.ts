import type {
  DeckUploadResult,
  FundabilityAnalysis,
  InvestorView,
  Report,
  SIP,
  Stage,
  Startup,
  StartupSummary,
  User,
} from "./types"

const BASE = "/api"
const TOKEN_KEY = "token"

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = "ApiError"
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(TOKEN_KEY)
}

type FastApiDetail =
  | string
  | { msg?: string; loc?: (string | number)[] }[]
  | undefined

/** FastAPI sends `detail` as a string for HTTPException but as an array of
 *  objects for 422 validation errors. Rendering the array straight into a toast
 *  yields "[object Object]", so flatten it here once. */
function detailToMessage(detail: FastApiDetail): string | null {
  if (!detail) return null
  if (typeof detail === "string") return detail
  if (!Array.isArray(detail)) return null
  return (
    detail
      .map((d) => {
        const field = d.loc?.filter((p) => p !== "body").join(".")
        return field ? `${field}: ${d.msg ?? "invalid"}` : d.msg ?? "invalid"
      })
      .join("; ") || null
  )
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  { form = false }: { form?: boolean } = {},
): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(form ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (res.status === 401) {
    // Single place where an expired or tampered token logs the user out.
    clearToken()
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login"
    }
    throw new ApiError("Your session expired. Please sign in again.", 401)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(detailToMessage(body?.detail) ?? res.statusText, res.status)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** All three generations share a response shape and only differ by path. */
function triggerReport(id: string, kind: "fundability" | "memo" | "deck") {
  return request<{ report_id: string; status: string }>(`/analysis/${id}/${kind}`, {
    method: "POST",
  })
}

export const api = {
  register: (body: { email: string; password: string; full_name?: string }) =>
    request<User>("/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (username: string, password: string) =>
    request<{ access_token: string; token_type: string }>(
      "/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password }),
      },
      { form: true },
    ),

  me: () => request<User>("/users/me"),

  listStartups: () => request<StartupSummary[]>("/startups"),

  createStartup: (body: {
    name: string
    one_liner?: string
    stage?: Stage
    industry?: string[]
  }) => request<Startup>("/startups", { method: "POST", body: JSON.stringify(body) }),

  getStartup: (id: string) => request<Startup>(`/startups/${id}`),

  updateStartup: (
    id: string,
    body: {
      name?: string
      one_liner?: string
      stage?: Stage | null
      industry?: string[]
    },
  ) =>
    request<Startup>(`/startups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteStartup: (id: string) =>
    request<void>(`/startups/${id}`, { method: "DELETE" }),

  /** Extract a PDF deck into the profile. Fills only empty fields; anything
   *  already typed wins. Runs synchronously - the founder is watching. */
  uploadDeck: (id: string, file: File) => {
    const body = new FormData()
    body.append("file", file)
    // `form: true` omits the JSON Content-Type so the browser can set the
    // multipart boundary itself. Setting it by hand breaks the upload.
    return request<DeckUploadResult>(
      `/startups/${id}/upload-deck`,
      { method: "POST", body },
      { form: true },
    )
  },

  updateSip: (id: string, body: Partial<SIP>) =>
    request<Startup>(`/startups/${id}/sip`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  listReports: (id: string) => request<Report[]>(`/startups/${id}/reports`),

  analyze: (id: string) => triggerReport(id, "fundability"),
  generateMemo: (id: string) => triggerReport(id, "memo"),
  generateDeck: (id: string) => triggerReport(id, "deck"),

  getReport: (reportId: string) => request<Report>(`/analysis/reports/${reportId}`),

  createInvestorView: (id: string, body: { investor_name: string; investor_thesis?: string }) =>
    request<{ view_id: string; status: string }>(`/analysis/${id}/investor-views`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listInvestorViews: (id: string) =>
    request<InvestorView[]>(`/analysis/${id}/investor-views`),

  getInvestorView: (viewId: string) =>
    request<InvestorView>(`/analysis/investor-views/${viewId}`),
}

export type {
  FundabilityAnalysis,
  InvestorView,
  Report,
  Startup,
  StartupSummary,
  User,
}
