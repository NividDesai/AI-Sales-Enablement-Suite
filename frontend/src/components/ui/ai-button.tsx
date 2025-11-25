import * as React from "react"
import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { PremiumButton } from "./premium-button"

interface AIButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md" | "lg"
}

export const AIButton = React.forwardRef<HTMLButtonElement, AIButtonProps>(
  ({ className, loading, variant = "primary", size = "md", children, ...props }, ref) => {
    const sizeClasses = {
      sm: "px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm",
      md: "px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base",
      lg: "px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg",
    }

    const variantClasses = {
      primary: "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30",
      secondary: "bg-white/10 text-white border border-white/20",
      ghost: "bg-transparent text-white",
    }

    if (variant === "primary") {
      const { disabled, ...rest } = props
      return (
        <PremiumButton
          ref={ref}
          size={size}
          disabled={disabled || loading}
          className={cn("w-full sm:w-auto", className)}
          {...rest}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            children
          )}
        </PremiumButton>
      )
    }

    const {
      onAnimationStart,
      onAnimationEnd,
      onAnimationIteration,
      onDrag,
      onDragStart,
      onDragEnd,
      ...safeProps
    } = props

    return (
      <motion.button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl font-medium",
          "transition-all duration-300",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "w-full sm:w-auto",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        whileTap={{ scale: 0.98 }}
        {...safeProps}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          children
        )}
      </motion.button>
    )
  }
)
AIButton.displayName = "AIButton"

