import Swal from 'sweetalert2'

/**
 * Brand-themed SweetAlert2 wrappers (pink/purple). Use these everywhere instead
 * of window.confirm/alert or ad-hoc inline messages so every action gives the
 * user consistent feedback.
 */

// Shared look for modal dialogs.
const modal = Swal.mixin({
  confirmButtonColor: '#7C3AED', // brand purple
  cancelButtonColor: '#94a3b8',  // slate
  reverseButtons: true,
  buttonsStyling: true,
  customClass: {
    popup: 'rounded-2xl',
    title: 'swal-brand-title',
    confirmButton: 'swal-brand-btn',
    cancelButton: 'swal-brand-btn',
  },
})

// Small auto-dismissing toast (top-right).
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2400,
  timerProgressBar: true,
  didOpen: (el) => {
    el.addEventListener('mouseenter', Swal.stopTimer)
    el.addEventListener('mouseleave', Swal.resumeTimer)
  },
})

/** Yes/No confirmation for a destructive action. Resolves to true if confirmed. */
export function confirmDelete({ title = 'Are you sure?', text = "This can't be undone.", confirmText = 'Yes, delete' } = {}) {
  return modal
    .fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#DC2626', // red for destructive confirm
      focusCancel: true,
    })
    .then((r) => r.isConfirmed)
}

/** Generic confirmation. Resolves to true if confirmed. */
export function confirmAction({ title = 'Please confirm', text = '', confirmText = 'Confirm', icon = 'question' } = {}) {
  return modal
    .fire({ title, text, icon, showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: 'Cancel' })
    .then((r) => r.isConfirmed)
}

/** Success toast. */
export function toastOk(title = 'Done') {
  return Toast.fire({ icon: 'success', title })
}

/** Info toast. */
export function toastInfo(title) {
  return Toast.fire({ icon: 'info', title })
}

/** Success modal (use when you want to stop the user, e.g. after registration). */
export function alertOk(title = 'Success', text = '') {
  return modal.fire({ icon: 'success', title, text })
}

/** Error modal. Accepts a string or a thrown request error. */
export function alertErr(err, fallback = 'Something went wrong. Please try again.') {
  const text =
    typeof err === 'string'
      ? err
      : err?.data?.error || err?.message || fallback
  return modal.fire({ icon: 'error', title: 'Oops…', text })
}

export default Swal
