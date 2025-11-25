// Placeholder file - component removed
// This file exists to prevent Tailwind CSS errors during build
import React, { ReactNode, useRef } from 'react'
import { motion, useInView } from 'framer-motion'

type Variant = {
  [key: string]: any
}

type UseInViewOptions = {
  once?: boolean
  margin?: string
  amount?: number | 'some' | 'all'
}

interface InViewProps {
  children: ReactNode
  variants?: {
    hidden: Variant
    visible: Variant
  }
  transition?: any
  viewOptions?: UseInViewOptions
}

const defaultVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export function InView({
  children,
  variants = defaultVariants,
  transition,
  viewOptions,
}: InViewProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, viewOptions)

  return (
    <motion.div
      ref={ref}
      initial='hidden'
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      transition={transition}
    >
      {children}
    </motion.div>
  )
}

