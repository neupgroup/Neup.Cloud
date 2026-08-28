//to be remade

"use client"

import * as React from "react"

import { cn } from "@/core/utils"

export type InputValidation =
  | "email"
  | "domain"
  | "link"
  | "linkwithoutprotocol"
  | "username"

const defaultValidationMessages: Record<InputValidation, string> = {
  email: "Enter a valid email address.",
  domain: "Enter a valid domain.",
  link: "Please enter a valid link.",
  linkwithoutprotocol: "Please enter a valid link.",
  username:
    "Username can only contain letters, numbers, periods, underscores, and hyphens.",
}

function isValidDomain(value: string) {
  return /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/.test(
    value
  )
}

function isValidLink(value: string, withoutProtocol: boolean) {
  if (withoutProtocol && /^[a-z][a-z\d+.-]*:\/\//i.test(value)) return false
  if (!withoutProtocol && !/^https?:\/\//i.test(value)) return false

  try {
    const url = new URL(withoutProtocol ? `https://${value}` : value)
    const isIpAddress = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname)
    const hasValidHost =
      url.hostname === "localhost" ||
      isIpAddress ||
      isValidDomain(url.hostname)

    return hasValidHost && !/\s/.test(value)
  } catch {
    return false
  }
}

function validateInput(value: string, validation: InputValidation) {
  if (!value.trim()) return true

  switch (validation) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    case "domain":
      return isValidDomain(value)
    case "link":
      return isValidLink(value, false)
    case "linkwithoutprotocol":
      return isValidLink(value, true)
    case "username":
      return /^[a-zA-Z0-9._-]+$/.test(value)
  }
}

export interface InputProps extends React.ComponentProps<"input"> {
  error?: string | null
  preIcon?: React.ReactNode
  postIcon?: React.ReactNode
  validation?: InputValidation
  validationMessage?: string
  validationMessages?: Partial<Record<InputValidation, string>>
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      error,
      preIcon,
      postIcon,
      validation,
      validationMessage,
      validationMessages,
      onChange,
      onBlur,
      id,
      ...props
    },
    ref
  ) => {
    const [validationError, setValidationError] = React.useState<string | null>(
      null
    )
    const validationTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
      null
    )
    const displayError = error || validationError
    const errorId = id && displayError ? `${id}-error` : undefined
    const describedBy = [props["aria-describedby"], errorId]
      .filter(Boolean)
      .join(" ") || undefined

    const clearValidationTimer = () => {
      if (validationTimer.current) {
        clearTimeout(validationTimer.current)
        validationTimer.current = null
      }
    }

    const runValidation = (value: string) => {
      if (!validation) return

      const valid = validateInput(value, validation)
      setValidationError(
        valid
          ? null
          : validationMessage ||
              validationMessages?.[validation] ||
              defaultValidationMessages[validation]
      )
    }

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (validation) {
        const value = event.currentTarget.value
        clearValidationTimer()
        if (validateInput(value, validation)) {
          setValidationError(null)
        }
        validationTimer.current = setTimeout(() => {
          runValidation(value)
          validationTimer.current = null
        }, 3000)
      }

      onChange?.(event)
    }

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      if (validation) {
        clearValidationTimer()
        runValidation(event.currentTarget.value)
      }

      onBlur?.(event)
    }

    React.useEffect(() => clearValidationTimer, [])

    return (
      <div className="w-full">
        <div className="relative flex w-full items-center">
          {preIcon && (
            <span className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
              {preIcon}
            </span>
          )}
          <input
            {...props}
            id={id}
            ref={ref}
            type={type}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-invalid={displayError ? true : props["aria-invalid"]}
            aria-describedby={describedBy}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-[border-color,box-shadow,background-color,color] duration-500 ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              preIcon && "pl-10",
              postIcon && "pr-10",
              displayError &&
                "border-destructive focus-visible:ring-destructive",
              className
            )}
          />
          {postIcon && (
            <span className="pointer-events-none absolute right-3 flex items-center text-muted-foreground">
              {postIcon}
            </span>
          )}
        </div>
        <div
          aria-live="polite"
          className={cn(
            "overflow-hidden transition-[max-height,opacity,margin] duration-500 ease-out",
            displayError ? "mt-1 max-h-20 opacity-100" : "mt-0 max-h-0 opacity-0"
          )}
        >
          <p id={errorId} className="text-sm text-destructive">
            {displayError}
          </p>
        </div>
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
