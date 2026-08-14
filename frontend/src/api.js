const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost/meetup/backend/api'

function getToken() {
  return localStorage.getItem('token')
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {}
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  // Let the browser set the multipart boundary for FormData; only JSON needs a type.
  if (body && !isForm) headers['Content-Type'] = 'application/json'
  if (auth) {
    const t = getToken()
    if (t) headers['Authorization'] = `Bearer ${t}`
  }

  // PUT and DELETE go out as POST carrying the real method in a header.
  //
  // Plenty of shared hosts (cPanel + mod_security is the usual culprit) reject
  // those two verbs outright, which breaks every edit and delete in the app
  // while GETs keep working — a confusing failure that only shows up in
  // production. POST is never blocked, and _bootstrap.php puts the real method
  // back before any endpoint sees the request. Done for local requests too, so
  // what we test is what ships.
  let wireMethod = method
  if (method === 'PUT' || method === 'DELETE') {
    wireMethod = 'POST'
    headers['X-HTTP-Method-Override'] = method
  }

  const res = await fetch(`${API_BASE}/${path}`, {
    method: wireMethod,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    // An authenticated call that comes back 401 means the saved token is gone
    // or invalid (e.g. the session was ended in another tab). Clear it and send
    // the user to the right login instead of a dead-end "Not authenticated".
    if (res.status === 401 && auth) {
      localStorage.removeItem('token')
      const h = window.location.hash || ''
      if (!h.includes('login')) {
        const login = h.includes('/admin') ? '#/admin/login'
          : h.includes('/business') ? '#/business/login'
          : '#/login'
        window.location.hash = login
      }
      const err = new Error('Your session has expired. Please log in again to continue.')
      err.status = 401
      err.data = data
      throw err
    }
    const err = new Error((data && data.error) || `Request failed (${res.status})`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  // ---- auth ----
  register: (b) => request('register.php', { method: 'POST', body: b }),
  sendOtp: (b) => request('otp-send.php', { method: 'POST', body: b }),
  verifyOtp: (b) => request('otp-verify.php', { method: 'POST', body: b }),
  login: (b) => request('login.php', { method: 'POST', body: b }),
  logout: () => request('logout.php', { method: 'POST', auth: true }),
  me: () => request('me.php', { auth: true }),
  updateMe: (b) => request('me.php', { method: 'PUT', body: b, auth: true }),
  uploadAvatar: (file) => {
    const fd = new FormData()
    fd.append('avatar', file)
    return request('me-avatar.php', { method: 'POST', body: fd, auth: true })
  },
  deleteAvatar: () => request('me-avatar.php', { method: 'DELETE', auth: true }),

  // ---- public data ----
  companies: (qs = '') => request(`companies.php${qs}`),
  company: (slug, qs = '') => request(`company.php?slug=${encodeURIComponent(slug)}${qs}`),
  menu: (slug) => request(`menu.php?slug=${encodeURIComponent(slug)}`),
  // Bookable tables for the reservation picker. Passing a slot marks the tables
  // already taken for it, so they can be shown as unavailable.
  tables: (slug, slot) => {
    const qs = new URLSearchParams({ slug })
    if (slot?.date && slot?.from && slot?.to) {
      qs.set('date', slot.date)
      qs.set('from', slot.from)
      qs.set('to', slot.to)
    }
    return request(`tables.php?${qs}`)
  },
  categories: () => request('categories.php'),
  locations: () => request('locations.php'),
  moods: () => request('moods.php'),
  recentReviews: (limit = 12) => request(`recent-reviews.php?limit=${limit}`),

  // ---- reviews ----
  myReviews: () => request('reviews.php?mine=1', { auth: true }),
  createReview: (b) => request('reviews.php', { method: 'POST', body: b, auth: true }),
  updateReview: (id, b) => request(`review.php?id=${id}`, { method: 'PUT', body: b, auth: true }),
  deleteReview: (id) => request(`review.php?id=${id}`, { method: 'DELETE', auth: true }),
  markUseful: (id) => request(`review.php?id=${id}&action=useful`, { method: 'POST' }),

  // ---- reservations ----
  createReservation: (b) => request('reservations.php', { method: 'POST', body: b, auth: true }),
  myReservations: () => request('reservations.php?mine=1', { auth: true }),
  updateReservation: (id, b) => request(`reservation.php?id=${id}`, { method: 'POST', body: b, auth: true }),
  deleteReservation: (id) => request(`reservation.php?id=${id}`, { method: 'DELETE', auth: true }),

  // ---- notifications ----
  notifications: () => request('notifications.php', { auth: true }),
  dismissNotification: (id) => request(`notifications.php?id=${id}`, { method: 'DELETE', auth: true }),
  clearNotifications: () => request('notifications.php?all=1', { method: 'DELETE', auth: true }),

  // ---- business (company) ----
  myCompany: () => request('my-company.php', { auth: true }),
  updateMyCompany: (b) => request('my-company-update.php', { method: 'PUT', body: b, auth: true }),
  updateCompanyAbout: (about) => request('my-company-about.php', { method: 'POST', body: { about }, auth: true }),
  myHours: () => request('my-company-hours.php', { auth: true }),
  saveMyHours: (hours) => request('my-company-hours.php', { method: 'POST', body: { hours }, auth: true }),
  setTodayHours: (today) => request('my-company-hours.php', { method: 'POST', body: { today }, auth: true }),
  clearTodayHours: () => request('my-company-hours.php?today=1', { method: 'DELETE', auth: true }),
  myCards: () => request('my-company-cards.php', { auth: true }),
  addCard: (fd) => request('my-company-cards.php', { method: 'POST', body: fd, auth: true }),
  deleteCard: (id) => request(`my-company-cards.php?id=${id}`, { method: 'DELETE', auth: true }),
  myMenu: () => request('my-company-menu.php', { auth: true }),
  addMenuItem: (fd) => request('my-company-menu.php', { method: 'POST', body: fd, auth: true }),
  // Takes a plain object (the availability switch) or FormData (the edit form,
  // which may carry a new photo) — request() picks the right encoding.
  updateMenuItem: (id, b) => request(`my-company-menu.php?id=${id}`, { method: 'POST', body: b, auth: true }),
  deleteMenuItem: (id) => request(`my-company-menu.php?id=${id}`, { method: 'DELETE', auth: true }),
  myMoods: () => request('my-company-moods.php', { auth: true }),
  saveMyMoods: (moodIds) => request('my-company-moods.php', { method: 'POST', body: { mood_ids: moodIds }, auth: true }),
  myTables: () => request('my-company-tables.php', { auth: true }),
  addTable: (fd) => request('my-company-tables.php', { method: 'POST', body: fd, auth: true }),
  updateTable: (id, b) => request(`my-company-tables.php?id=${id}`, { method: 'POST', body: b, auth: true }),
  deleteTable: (id) => request(`my-company-tables.php?id=${id}`, { method: 'DELETE', auth: true }),
  tableByToken: (token) => request(`table-by-token.php?token=${encodeURIComponent(token)}`),

  // ---- QR ordering at a table (guests, no account needed) ----
  tableMenu: (token) => request(`table-menu.php?token=${encodeURIComponent(token)}`),
  // auth is opt-in on the server: a guest orders fine without a token, and a
  // logged-in customer gets the order linked to their account.
  placeOrder: (body) => request('place-order.php', { method: 'POST', body, auth: true }),
  orderStatus: (t) => request(`order-status.php?t=${encodeURIComponent(t)}`),

  // ---- company: the orders screen ----
  myOrders: () => request('my-company-orders.php', { auth: true }),
  setOrderStatus: (id, status) => request(`my-company-orders.php?id=${id}`, { method: 'POST', body: { status }, auth: true }),
  deleteOrder: (id) => request(`my-company-orders.php?id=${id}`, { method: 'DELETE', auth: true }),
  // ---- POS / billing (per company) ----
  posProducts: () => request('pos-products.php', { auth: true }),
  addPosProduct: (b) => request('pos-products.php', { method: 'POST', body: b, auth: true }),
  updatePosProduct: (id, b) => request(`pos-products.php?id=${id}`, { method: 'PUT', body: b, auth: true }),
  deletePosProduct: (id) => request(`pos-products.php?id=${id}`, { method: 'DELETE', auth: true }),
  posInvoices: () => request('pos-invoices.php', { auth: true }),
  posInvoice: (id) => request(`pos-invoices.php?id=${id}`, { auth: true }),
  createPosInvoice: (b) => request('pos-invoices.php', { method: 'POST', body: b, auth: true }),
  posReport: (date) => request(`pos-report.php${date ? `?date=${date}` : ''}`, { auth: true }),

  uploadCompanyLogo: (file) => {
    const fd = new FormData()
    fd.append('logo', file)
    return request('my-company-logo.php', { method: 'POST', body: fd, auth: true })
  },
  deleteCompanyLogo: () => request('my-company-logo.php', { method: 'DELETE', auth: true }),
  addCompanyCovers: (files) => {
    const fd = new FormData()
    Array.from(files).forEach((f) => fd.append('covers[]', f))
    return request('my-company-covers.php', { method: 'POST', body: fd, auth: true })
  },
  removeCompanyCover: (id) => request(`my-company-covers.php?id=${id}`, { method: 'DELETE', auth: true }),
  uploadCoverVideo: (blob) => {
    const fd = new FormData()
    const ext = (blob.type || '').includes('mp4') ? 'mp4' : 'webm'
    fd.append('video', blob, `cover-video.${ext}`)
    return request('my-company-cover-video.php', { method: 'POST', body: fd, auth: true })
  },
  removeCoverVideo: () => request('my-company-cover-video.php', { method: 'DELETE', auth: true }),
  reply: (b) => request('reply.php', { method: 'POST', body: b, auth: true }),
  approveReview: (reviewId, approved) => request('review-approve.php', { method: 'POST', body: { review_id: reviewId, approved }, auth: true }),
  saveReviewOrder: (order) => request('review-order.php', { method: 'POST', body: { order }, auth: true }),
  deleteMyReview: (id) => request(`review-delete.php?id=${id}`, { method: 'DELETE', auth: true }),

  // ---- admin ----
  adminStats: () => request('admin-stats.php', { auth: true }),
  adminCompanies: () => request('admin-companies.php', { auth: true }),
  setUserStatus: (b) => request('admin-user-status.php', { method: 'POST', body: b, auth: true }),
  adminCategories: () => request('admin-categories.php', { auth: true }),
  createCategory: (name) => request('admin-categories.php', { method: 'POST', body: { name }, auth: true }),
  deleteCategory: (id) => request(`admin-categories.php?id=${id}`, { method: 'DELETE', auth: true }),

  // ---- admin: mood tags ----
  adminMoods: () => request('admin-moods.php', { auth: true }),
  createMood: (b) => request('admin-moods.php', { method: 'POST', body: b, auth: true }),
  updateMood: (id, b) => request(`admin-moods.php?id=${id}`, { method: 'PUT', body: b, auth: true }),
  deleteMood: (id) => request(`admin-moods.php?id=${id}`, { method: 'DELETE', auth: true }),

  // ---- admin: districts & cities ----
  adminDistricts: () => request('admin-districts.php', { auth: true }),
  adminCities: (districtId) => request(`admin-cities.php?district_id=${districtId}`, { auth: true }),
  createCity: (districtId, name) => request('admin-cities.php', { method: 'POST', body: { district_id: districtId, name }, auth: true }),
  deleteCity: (id) => request(`admin-cities.php?id=${id}`, { method: 'DELETE', auth: true }),

  // ---- admin: hard delete ----
  deleteUser: (id) => request(`admin-user-delete.php?id=${id}`, { method: 'DELETE', auth: true }),
  deleteCompanyAdmin: (id) => request(`admin-company-delete.php?id=${id}`, { method: 'DELETE', auth: true }),
  deleteReviewAdmin: (id) => request(`admin-review-delete.php?id=${id}`, { method: 'DELETE', auth: true }),
  updateCompanyAdmin: (id, b) => request(`admin-company-update.php?id=${id}`, { method: 'PUT', body: b, auth: true }),
  setCompanyStatus: (id, status) => request('admin-company-status.php', { method: 'POST', body: { id, status }, auth: true }),
  adminCompanyDetail: (id) => request(`admin-company-detail.php?id=${id}`, { auth: true }),
  adminCustomerDetail: (id) => request(`admin-customer-detail.php?id=${id}`, { auth: true }),
  resetUserPassword: (userId, password) => request('admin-reset-password.php', { method: 'POST', body: { user_id: userId, password }, auth: true }),
  pendingCounts: () => request('admin-pending-counts.php', { auth: true }),
}

export { API_BASE }
