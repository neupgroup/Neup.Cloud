//to be remade

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/core/utils"

/**
 * ::neup.documentation::button-usage-guidelines
 *
 * ::private
 *
 * ============================================================================
 * Button Usage Guidelines (Neup Design System)
 * ============================================================================
 *
 * Button hierarchy should communicate importance, not just interactivity.
 * Avoid using Primary buttons everywhere.
 *
 * ---
 * Primary
 * ---
 * Reserved for the highest-priority action on a page or major flow.
 *
 * Use only when the action represents the user's primary objective.
 *
 * Examples:
 * - Create
 * - Publish
 * - Save Changes
 * - Get Started
 * - Continue
 * - Checkout
 * - Submit
 *
 * Recommended:
 * - Maximum 1 primary button per section.
 * - Prefer no more than 1-2 primary buttons across an entire page.
 * - Never place two primary buttons together.
 *
 * ---
 * Secondary
 * ---
 * Default button style.
 *
 * Use for normal actions throughout the interface where many actions exist.
 * If a page contains multiple independent sections with action buttons,
 * those buttons should generally be Secondary instead of Primary.
 *
 * Examples:
 * - Edit
 * - View Details
 * - Add Member
 * - Manage
 * - Configure
 * - Upload
 *
 * Recommended:
 * - Prefer 1 secondary button per action group.
 * - Do not place two secondary buttons side by side for opposing actions.
 * - A section may have 1-2 secondary buttons only when they are separated
 *   by layout or context so they do not appear equally important in the same
 *   decision point.
 *
 * ---
 * Tertiary
 * ---
 * Outline only.
 * No filled background.
 *
 * Use alongside a Secondary button when presenting a lower-priority or
 * alternative action.
 * Multiple tertiary buttons may appear together when they are supporting
 * actions.
 *
 * Examples:
 * - Secondary: Save
 * - Tertiary: Cancel
 *
 * - Secondary: Continue
 * - Tertiary: Back
 *
 * - Secondary: Apply
 * - Tertiary: Reset
 *
 * Commit/cancel pairs:
 * - Primary or Secondary: Save, Continue, Submit, Apply
 * - Tertiary: Back, Cancel, Reset, Dismiss
 *
 * ---
 * Plain
 * ---
 * No outline.
 * No resting background.
 *
 * Use only for persistent navigation links such as header links and sidebar
 * links. Hover may show a light background, and pressed state may show a
 * slightly darker background than hover.
 *
 * ---
 * Priority Order
 * ---
 *
 * Primary   -> Highest importance
 * Secondary -> Standard actions (default choice)
 * Tertiary  -> Supporting / alternative actions
 *
 * Always communicate visual hierarchy through button variants rather than
 * making every action Primary.
 * ============================================================================
 *
 * ::private end
 * ::end
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-primary/20 bg-primary/10 text-primary hover:border-primary/40 hover:bg-primary/25 hover:text-primary active:border-primary/60 active:bg-primary/35",
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
        outline:
          "border border-primary/25 bg-transparent text-primary hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:border-primary/60 active:bg-primary/20",
        secondary:
          "border border-primary/20 bg-primary/10 text-primary hover:border-primary/40 hover:bg-primary/25 hover:text-primary active:border-primary/60 active:bg-primary/35",
        tertiary:
          "border border-primary/25 bg-transparent text-primary hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:border-primary/60 active:bg-primary/20",
        plain:
          "border border-transparent bg-transparent text-foreground hover:bg-primary/10 hover:text-primary active:bg-primary/20 active:text-primary",
        destructiveTertiary:
          "border border-destructive/25 bg-transparent text-destructive hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive active:border-destructive/60 active:bg-destructive/20",
        ghost: "hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
