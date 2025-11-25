import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface SectionCardProps {
  title: string
  description?: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  defaultExpanded?: boolean
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  icon,
  children,
  className,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-xl sm:rounded-2xl bg-black/50",
        "backdrop-blur-xl border border-white/10",
        "p-4 sm:p-6 transition-all duration-300",
        "hover:border-white/20 hover:bg-black/70 hover:shadow-2xl",
        className
      )}
    >
      <div
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          {icon && <div className="text-white flex-shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-semibold text-white">{title}</h3>
            {description && (
              <p className="text-xs sm:text-sm text-white/50 mt-1">{description}</p>
            )}
          </div>
        </div>
      </div>
      <motion.div
        initial={false}
        animate={{ height: isExpanded ? "auto" : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="space-y-4">{children}</div>
      </motion.div>
    </motion.div>
  )
}

