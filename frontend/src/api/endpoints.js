// One function per backend endpoint (plan_backend.txt section 2). All URLs are RELATIVE so the
// login cookie stays first-party (Vite proxy locally, Vercel rewrite in production).
// Quantities are always strings; the frontend never does ration arithmetic.
import { apiDelete, apiGet, apiPost, apiPut } from './client.js'

export const api = {
  health: () => apiGet('/api/health'),

  // stateless, public
  calculate: (caseData) => apiPost('/api/calculate', caseData),
  parseReceipt: ({ text, period, knownItems }) =>
    apiPost('/api/receipt/parse', { text, period, known_items: knownItems }),

  // saved cases (login required)
  listCases: () => apiGet('/api/cases'),
  getCase: (id) => apiGet(`/api/cases/${id}`),
  saveCase: (caseData) => apiPost('/api/cases', caseData),
  updateCase: (id, caseData) => apiPut(`/api/cases/${id}`, caseData),
  deleteCase: (id) => apiDelete(`/api/cases/${id}`),
  nextMonth: (id) => apiPost(`/api/cases/${id}/next-month`, {}),

  // reports
  createReport: (caseId) => apiPost(`/api/cases/${caseId}/reports`, {}),
  getReport: (reportId) => apiGet(`/api/reports/${reportId}`), // public
  emailReport: (reportId, lang) => apiPost(`/api/reports/${reportId}/email`, { lang }),

  tracker: (months = 6) => apiGet(`/api/tracker?months=${months}`),
  shopsNearby: (lat, lon, radiusKm = 5) =>
    apiGet(`/api/shops/nearby?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`),

  // grievance notes: the user's own diary, nothing is filed anywhere
  listGrievances: (caseId) => apiGet(`/api/cases/${caseId}/grievances`),
  createGrievance: (caseId, note) => apiPost(`/api/cases/${caseId}/grievances`, note),
  updateGrievance: (caseId, id, note) => apiPut(`/api/cases/${caseId}/grievances/${id}`, note),
  deleteGrievance: (caseId, id) => apiDelete(`/api/cases/${caseId}/grievances/${id}`),
}
