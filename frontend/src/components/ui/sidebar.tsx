import { DocText } from "lucide-react";

type PlainDockItemProps = {
  label: string
  icon?: React.ReactNode
}

export function PlainDockItem({ label, icon }: PlainDockItemProps) {
  return (
    <div className="flex flex-col items-center gap-2 text-center text-sm text-zinc-600 dark:text-zinc-300">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        {icon ?? <DocText className="h-6 w-6" />}
      </div>
      <span className="text-xs">{label}</span>
    </div>
  )
}

