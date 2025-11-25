import { motion, type HTMLMotionProps } from 'framer-motion'

export type MotionButtonProps = HTMLMotionProps<'button'> & {
  asChild?: boolean
}

export function MotionButton({ children, className = '', disabled, ...props }: MotionButtonProps) {
  return (
    <motion.button
      whileHover={!disabled ? { y: -2, boxShadow: '0 8px 20px rgba(0,0,0,0.15)' } : undefined}
      whileTap={!disabled ? { y: 0, scale: 0.98, boxShadow: '0 2px 8px rgba(0,0,0,0.12) inset' } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`btn-3d ${disabled ? 'btn-3d-disabled' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  )
}
