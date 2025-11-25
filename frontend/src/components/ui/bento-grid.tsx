"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "grid md:auto-rows-[18rem] grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto",
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
}: {
  name: string;
  className?: string;
  background: React.ReactNode;
  Icon: React.ElementType;
  description: string;
  href: string;
  cta: string;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={cn(
        "row-span-1 rounded-xl group/bento hover:shadow-xl transition duration-200 shadow-input dark:shadow-none p-4 dark:bg-black dark:border-white/[0.2] bg-white border border-white/10 justify-between flex flex-col space-y-4",
        className
      )}
    >
      {background}
      <div className="group-hover/bento:translate-x-2 transition duration-200">
        <Icon className="h-6 w-6 text-white mb-2" />
        <div className="font-sans font-bold text-white dark:text-neutral-200 mb-2 mt-2">
          {name}
        </div>
        <div className="font-sans font-normal text-white/60 text-xs dark:text-neutral-300">
          {description}
        </div>
      </div>
    </motion.div>
  );
};

