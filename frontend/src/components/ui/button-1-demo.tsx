import GradientButton from "@/components/ui/button-1"

const DemoOne = () => {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <GradientButton
        onClick={() => console.log("clicked")}
        width="300px"
        height="60px"
      >
        Button
      </GradientButton>
    </div>
  )
}

export { DemoOne }

