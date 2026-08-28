//to be remade

"use client"

import * as React from "react"

import { cn } from "@/core/utils"

const AvatarContext = React.createContext<{
  imageLoaded: boolean
  setImageLoaded: (loaded: boolean) => void
} | null>(null)

const Avatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const [imageLoaded, setImageLoaded] = React.useState(false)

    return (
      <AvatarContext.Provider value={{ imageLoaded, setImageLoaded }}>
        <div
          ref={ref}
          className={cn(
            "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
            className
          )}
          {...props}
        />
      </AvatarContext.Provider>
    )
  }
)
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ComponentProps<"img">
>(({ className, onError, onLoad, src, ...props }, ref) => {
  const context = React.useContext(AvatarContext)

  return (
    <img
      ref={ref}
      src={src}
      className={cn(
        "absolute inset-0 h-full w-full object-cover",
        !context?.imageLoaded && "invisible",
        className
      )}
      onLoad={(event) => {
        context?.setImageLoaded(true)
        onLoad?.(event)
      }}
      onError={(event) => {
        context?.setImageLoaded(false)
        onError?.(event)
      }}
      {...props}
    />
  )
})
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const context = React.useContext(AvatarContext)

  return (
    <div
      ref={ref}
      className={cn(
        "absolute inset-0 flex h-full w-full items-center justify-center rounded-full bg-muted",
        context?.imageLoaded && "hidden",
        className
      )}
      {...props}
    />
  )
})
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
