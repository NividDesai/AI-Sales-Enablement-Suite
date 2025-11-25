import React from "react"

import { cn } from "@/lib/utils"

export interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  width?: string
  height?: string
}

const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  (
    {
      children,
      width = "auto",
      height = "3rem",
      className,
      style,
      disabled,
      ...props
    },
    ref,
  ) => {
    const mergedStyle = {
      ...style,
      ["--btn-width" as string]: width,
      ["--btn-height" as string]: height,
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "gradient-button rotatingGradient flex items-center justify-center rounded-[50px] px-6 text-sm font-medium text-[var(--color-text)] transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        style={mergedStyle}
        {...props}
      >
        <span className="label relative z-10 flex items-center justify-center gap-2 text-[var(--color-text)]">
          {children}
        </span>
      </button>
    )
  },
)

GradientButton.displayName = "GradientButton"

export default GradientButton

