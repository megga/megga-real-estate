import * as React from 'react'

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 5000

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info'

interface ToastData {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
}

type ToastAction =
  | { type: 'ADD'; toast: ToastData }
  | { type: 'DISMISS'; toastId: string }

interface ToastState {
  toasts: ToastData[]
}

function reducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }
    case 'DISMISS':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
    default:
      return state
  }
}

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

// Global listeners for cross-component access
const listeners: Array<(state: ToastState) => void> = []
let memoryState: ToastState = { toasts: [] }

function dispatch(action: ToastAction) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
}

function toast({ title, description, variant = 'default' }: ToastOptions) {
  const id = genId()
  dispatch({ type: 'ADD', toast: { id, title, description, variant } })

  // Auto-dismiss
  setTimeout(() => {
    dispatch({ type: 'DISMISS', toastId: id })
  }, TOAST_REMOVE_DELAY)

  return id
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: 'success' })

toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: 'error' })

toast.warning = (title: string, description?: string) =>
  toast({ title, description, variant: 'warning' })

toast.info = (title: string, description?: string) =>
  toast({ title, description, variant: 'info' })

function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const idx = listeners.indexOf(setState)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (toastId: string) => dispatch({ type: 'DISMISS', toastId }),
  }
}

export { useToast, toast, type ToastData, type ToastVariant }
