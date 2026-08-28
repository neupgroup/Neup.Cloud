//to be remade

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/core/utils'

const navButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors duration-200 ease-out hover:bg-primary/10 hover:text-primary active:bg-primary/25 active:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      active: {
        false: '',
        true: 'bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary active:bg-primary/40',
      },
    },
    defaultVariants: {
      active: false,
    },
  }
)

export interface NavButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof navButtonVariants> {
  asChild?: boolean
}

const NavButton = React.forwardRef<HTMLButtonElement, NavButtonProps>(
  ({ className, active, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        data-active={active || undefined}
        className={cn(navButtonVariants({ active, className }), active && 'active')}
        {...props}
      />
    )
  }
)
NavButton.displayName = 'NavButton'

export { NavButton, navButtonVariants }
