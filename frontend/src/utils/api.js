import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me')
}

export const sampleAPI = {
  list: () => api.get('/samples'),
  create: (data) => api.post('/samples', data),
  assign: (data) => api.post('/samples/assign', data),
  receive: (id, version) => api.post(`/samples/${id}/receive`, { version }),
  updateProgress: (id, data) => api.post(`/samples/${id}/update-progress`, data),
  submitForReview: (id, version) => api.post(`/samples/${id}/submit-for-review`, { version }),
  review: (id, data) => api.post(`/samples/${id}/review`, data),
  resubmit: (id, version) => api.post(`/samples/${id}/resubmit`, { version }),
  getAuditLogs: (id) => api.get(`/samples/${id}/audit-logs`)
}

export const userAPI = {
  getInspectors: () => api.get('/users/inspectors')
}

export const coldChainAPI = {
  recordTemperature: (data) => api.post('/cold-chain/readings', data),
  getReadings: (sampleId) => api.get(`/cold-chain/readings/${sampleId}`),
  getIssues: () => api.get('/cold-chain/issues'),
  getAllIssues: () => api.get('/cold-chain/issues/all'),
  getIssue: (id) => api.get(`/cold-chain/issues/${id}`),
  submitReceiverNote: (id, data) => api.post(`/cold-chain/issues/${id}/receiver-note`, data),
  submitInspectorAssess: (id, data) => api.post(`/cold-chain/issues/${id}/inspector-assess`, data),
  submitFinalDisposition: (id, data) => api.post(`/cold-chain/issues/${id}/final-disposition`, data)
}
