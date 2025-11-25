"use client";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, icon, actions }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div className="flex items-center gap-4">
        {icon && (
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2">
            {title}
          </h1>
          {description && (
            <p className="text-white/60 text-sm sm:text-base">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </motion.div>
  );
}

