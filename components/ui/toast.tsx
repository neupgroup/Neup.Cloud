//to be remade

'use client'

import * as React from 'react'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react'

import { cn } from '@/core/utils'
import { useToast, type ToastState } from '@/core/hooks/useToast'
import { Button, type ButtonProps } from './button'

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-0 right-0 z-[9999] flex max-h-screen w-full flex-col gap-0 p-4 md:max-w-[420px]',
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  'group pointer-events-auto relative z-[10000] flex w-full items-start justify-between gap-4 overflow-hidden rounded-lg border bg-background/60 p-4 pr-10 shadow-lg backdrop-blur-2xl backdrop-saturate-150 transition-[transform,opacity,background-color,border-color,color] data-[state=closed]:animate-out data-[state=closed]:duration-600 data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
  {
    variants: {
      state: {
        info: 'border-primary/70 bg-background/60 text-foreground',
        warning: 'border-amber-500/80 bg-amber-50/60 text-amber-950',
        error: 'border-destructive/80 bg-red-50/60 text-red-950',
        success: 'border-emerald-600/80 bg-emerald-50/60 text-emerald-950',
      },
    },
    defaultVariants: {
      state: 'info',
    },
  }
)

type ToastProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants> & {
    state?: ToastState
  }

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  ToastProps
>(({ className, state, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(toastVariants({ state }), className)}
    {...props}
  />
))
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-current/30 bg-transparent px-3 text-sm font-medium transition-colors hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

function getStateIcon(state?: ToastState) {
  const className = 'h-5 w-5'

  switch (state) {
    case 'warning':
      return <TriangleAlert className={className} />
    case 'error':
      return <CircleX className={className} />
    case 'success':
      return <CircleCheck className={className} />
    case 'info':
    default:
      return <Info className={className} />
  }
}

export function Toaster() {
  const { toasts, dismiss, dismissByName } = useToast()
  const [dismissingNames, setDismissingNames] = React.useState<Set<string>>(new Set())
  const [dismissingIds, setDismissingIds] = React.useState<Set<string>>(new Set())
  const toastGroups = Array.from(
    toasts.filter((toast) => toast.open !== false).reduce((groups, toast) => {
      const group = groups.get(toast.name) ?? []
      group.push(toast)
      groups.set(toast.name, group)
      return groups
    }, new Map<string, typeof toasts>()).entries()
  )

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const overflow = toastGroups
      .filter(([, group]) => group.length > 2)
      .map(([name, group]) => ({
        name,
        count: group.length - 2,
        ids: group.slice(2).map((toast) => toast.id),
      }))

    window.sessionStorage.setItem('neup-toast-overflow', JSON.stringify(overflow))
  }, [toastGroups])

  const dismissToastGroup = (name: string) => {
    if (dismissingNames.has(name)) return

    setDismissingNames((current) => new Set(current).add(name))
    window.setTimeout(() => {
      dismissByName(name)
      setDismissingNames((current) => {
        const next = new Set(current)
        next.delete(name)
        return next
      })
    }, 600)
  }

  const dismissToast = (id: string) => {
    if (dismissingIds.has(id)) return

    setDismissingIds((current) => new Set(current).add(id))
    window.setTimeout(() => {
      dismiss(id)
      setDismissingIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }, 600)
  }

  return (
    <ToastProvider>
      <ToastViewport>
        {toastGroups.map(([name, group]) => (
          <div key={name} className={group.length > 1 ? 'flex flex-col items-end pt-7' : 'flex flex-col items-end'}>
            <div className="grid w-full grid-cols-1">
              {[...group].reverse().slice(-2).map(({ id, name: _name, title, description, action, icon, autoDismiss, state, onOpenChange: _onOpenChange, ...props }, index, stack) => (
                <Toast
                  key={id}
                  {...props}
                  onOpenChange={(open) => {
                    if (!open) dismissToast(id)
                  }}
                  state={state}
                  style={{
                    gridArea: '1 / 1',
                    opacity: dismissingNames.has(name) || dismissingIds.has(id) ? 0 : 1,
                    transform: dismissingNames.has(name) || dismissingIds.has(id)
                      ? 'translateX(110%)'
                      : props.open === false
                      ? undefined
                      : index === stack.length - 1
                        ? undefined
                        : 'translateY(-28px) scale(0.975)',
                    zIndex: index + 1,
                    pointerEvents: index === stack.length - 1 ? 'auto' : 'none',
                  }}
                  duration={autoDismiss === false || autoDismiss === undefined ? Infinity : autoDismiss * 1000}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 shrink-0">{icon ?? getStateIcon(state)}</div>
                    <div className="grid min-w-0 gap-1">
                      {title && <ToastTitle>{title}</ToastTitle>}
                      {description && <ToastDescription>{description}</ToastDescription>}
                      {props.open !== false && !dismissingNames.has(name) && !dismissingIds.has(id) && (autoDismiss === false || autoDismiss === undefined) && group.length >= 2 && index === stack.length - 1 && (
                        <ToastDismissButton
                          type="button"
                          size="sm"
                          className="mt-1 h-7 justify-self-start px-2 text-xs"
                          onClick={() => dismissToastGroup(name)}
                        >
                          Dismiss ({group.length})
                        </ToastDismissButton>
                      )}
                    </div>
                  </div>
                  {action}
                  <ToastClose />
                  {typeof autoDismiss === 'number' && (
                    <div
                      role="progressbar"
                      aria-label="Toast dismiss countdown"
                      aria-valuemin={0}
                      aria-valuemax={autoDismiss}
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-1 origin-left bg-current/40"
                      style={{ animation: `toast-progress ${autoDismiss}s linear forwards` }}
                    />
                  )}
                </Toast>
              ))}
            </div>
          </div>
        ))}
      </ToastViewport>
    </ToastProvider>
  )
}

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-md p-1 text-current/60 transition-colors hover:bg-black/10 hover:text-current focus:outline-none focus:ring-2 focus:ring-ring',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastDismissButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <Button
      ref={ref}
      variant="plain"
      className={cn(
        'border border-current/40 bg-current/10 text-current transition-colors duration-200 ease-out hover:border-current/70 hover:bg-current/20 active:border-current/80 active:bg-current/25',
        className
      )}
      {...props}
    />
  )
)
ToastDismissButton.displayName = 'ToastDismissButton'

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn('text-sm font-semibold', className)} {...props} />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn('text-sm opacity-95', className)} {...props} />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastDismissButton,
  ToastAction,
  type ToastProps,
}
