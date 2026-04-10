import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Modal — Accessible WCAG 2.1 AA dialog component.
 *
 * Built on top of Radix UI Dialog, which natively provides:
 * - role="dialog" + aria-modal="true"
 * - aria-labelledby (via <DialogPrimitive.Title>)
 * - Focus trap (Tab / Shift+Tab cycle within modal)
 * - Auto-focus first focusable element on open
 * - Escape closes the modal
 * - Focus restoration to the trigger on close
 * - Scroll lock on body while open
 * - Portal rendering to document.body
 *
 * API:
 *   <Modal open={open} onClose={onClose} title="Titre" size="md">
 *     {children}
 *   </Modal>
 *
 * Props:
 * - open           : controlled open state
 * - onClose        : called when modal requests close (escape, backdrop, close btn)
 * - title          : accessible title (required for aria-labelledby). If you need
 *                    a custom header, pass `title={null}` and render your own
 *                    header using <Modal.Title> inside children.
 * - description    : optional accessible description (aria-describedby)
 * - size           : 'sm' | 'md' | 'lg' | 'xl' — max-width preset
 * - closeOnBackdrop: default true — set false to disable backdrop click to close
 * - hideCloseButton: default false — hide the top-right X button
 * - className      : extra classes on the content container
 * - contentClassName: extra classes on the inner scrollable area
 * - children       : modal body
 */

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
}

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnBackdrop?: boolean
  hideCloseButton?: boolean
  className?: string
  contentClassName?: string
  children: React.ReactNode
  /** aria-label fallback when title is not a string */
  ariaLabel?: string
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  closeOnBackdrop = true,
  hideCloseButton = false,
  className,
  contentClassName,
  children,
  ariaLabel,
}: ModalProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        {/* Overlay: Radix handles scroll lock automatically via <html data-scroll-locked> */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        {/* Content */}
        <DialogPrimitive.Content
          aria-label={typeof title === 'string' ? undefined : ariaLabel}
          onPointerDownOutside={(e) => {
            if (!closeOnBackdrop) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (!closeOnBackdrop) e.preventDefault()
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2',
            SIZE_CLASSES[size],
            'bg-theme-card rounded-xl border border-theme-border',
            'max-h-[90vh] overflow-hidden flex flex-col',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            className
          )}
        >
          {title && (
            <div className="flex items-start justify-between gap-4 p-5 border-b border-theme-border flex-shrink-0">
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-base font-semibold text-theme-primary">
                  {title}
                </DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="text-xs text-theme-tertiary mt-0.5">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              {!hideCloseButton && (
                <DialogPrimitive.Close
                  aria-label="Fermer"
                  className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors text-theme-tertiary hover:text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  <X className="w-4 h-4" />
                </DialogPrimitive.Close>
              )}
            </div>
          )}

          {/* When no title is provided, still render the close button floating */}
          {!title && !hideCloseButton && (
            <DialogPrimitive.Close
              aria-label="Fermer"
              className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-theme-hover transition-colors text-theme-tertiary hover:text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>
          )}

          {/* When no title, provide a visually hidden title for screen readers */}
          {!title && (
            <DialogPrimitive.Title className="sr-only">
              {ariaLabel || 'Dialog'}
            </DialogPrimitive.Title>
          )}

          <div className={cn('flex-1 overflow-y-auto', contentClassName)}>
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Re-export Radix Title/Description for custom headers */
Modal.Title = DialogPrimitive.Title
Modal.Description = DialogPrimitive.Description
Modal.Close = DialogPrimitive.Close

export default Modal
