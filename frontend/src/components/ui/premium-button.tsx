import React from 'react'
import { cn } from '@/lib/utils'

export interface PremiumButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const PremiumButton = React.forwardRef<HTMLButtonElement, PremiumButtonProps>(
  (
    {
      variant = 'default',
      size = 'md',
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const sizeClasses = {
      sm: 'px-5 py-2 text-sm',
      md: 'px-8 py-3 text-base',
      lg: 'px-10 py-4 text-lg',
    }

    const baseClasses = 'relative inline-flex items-center justify-center gap-2 font-medium tracking-tight rounded-lg transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-black/20 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-40 disabled:cursor-not-allowed'

    const variantClasses = {
      default: cn(
        '!bg-white !text-black',
        'border border-black/20',
        'shadow-[0_1px_2px_0_rgba(0,0,0,0.1)]',
        'hover:!bg-white hover:!text-black',
        'active:scale-[0.97]',
      ),
      outline: cn(
        'bg-transparent text-black',
        'border-2 border-black/30',
        'active:scale-[0.97]',
      ),
      ghost: cn(
        'bg-transparent text-black',
        'active:scale-[0.97]',
      ),
    }

    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          sizeClasses[size],
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {children}
        </span>
      </button>
    )
  },
)

PremiumButton.displayName = 'PremiumButton'

export { PremiumButton }
