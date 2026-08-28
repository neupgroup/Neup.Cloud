//to be remade

import * as React from 'react'

import { cn } from '@/core/utils'

export interface TextareaProps
  extends React.ComponentProps<'textarea'> {
  error?: string | null
}

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  TextareaProps
>(({ className, error, id, ...props }, ref) => {
  const errorId = id && error ? `${id}-error` : undefined
  const describedBy = [props['aria-describedby'], errorId]
    .filter(Boolean)
    .join(' ') || undefined

  return (
    <div className="w-full">
      <textarea
        {...props}
        id={id}
        ref={ref}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={describedBy}
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background transition-[border-color,box-shadow,background-color,color] duration-500 ease-out placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          error && 'border-destructive focus-visible:ring-destructive',
          className
        )}
      />
      <div
        aria-live="polite"
        className={cn(
          'overflow-hidden transition-[max-height,opacity,margin] duration-500 ease-out',
          error ? 'mt-1 max-h-20 opacity-100' : 'mt-0 max-h-0 opacity-0'
        )}
      >
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      </div>
    </div>
  )
})

Textarea.displayName = 'Textarea'

export { Textarea }
//to be remade
