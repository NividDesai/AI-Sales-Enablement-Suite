import React, { useRef, useEffect } from 'react'

interface ParticleTextHeaderProps {
  text: string
  fontSize?: number
  className?: string
  height?: string
}

const ParticleTextHeader: React.FC<ParticleTextHeaderProps> = ({
  text,
  fontSize = 120,
  className = '',
  height = '200px',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mouse = useRef<{ x: number | undefined; y: number | undefined; radius: number }>({
    x: undefined,
    y: undefined,
    radius: 150,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Store references to avoid null checks in nested functions
    const canvasEl = canvas
    const containerEl = container
    const ctxEl = ctx

    const updateCanvasSize = () => {
      if (!canvasEl || !containerEl || !ctxEl) return
      const rect = containerEl.getBoundingClientRect()
      canvasEl.width = rect.width
      canvasEl.height = rect.height
      init()
    }

    let particlesArray: Particle[] = []
    let animationFrameId: number

    class Particle {
      x: number
      y: number
      color: string
      size: number
      baseX: number
      baseY: number
      density: number

      constructor(x: number, y: number, color: string) {
        this.x = x
        this.y = y
        this.color = color
        this.size = 2
        this.baseX = x
        this.baseY = y
        this.density = Math.random() * 40 + 5
      }

      draw() {
        if (!ctxEl) return
        ctxEl.fillStyle = this.color
        ctxEl.beginPath()
        ctxEl.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctxEl.closePath()
        ctxEl.fill()
      }

      update() {
        if (mouse.current.x === undefined || mouse.current.y === undefined) return
        if (!containerEl) return

        const containerRect = containerEl.getBoundingClientRect()
        const mouseX = mouse.current.x - containerRect.left
        const mouseY = mouse.current.y - containerRect.top

        const dx = mouseX - this.x
        const dy = mouseY - this.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const forceDirectionX = dx / distance
        const forceDirectionY = dy / distance
        let force = (mouse.current.radius - distance) / mouse.current.radius
        if (force < 0) force = 0

        const directionX = forceDirectionX * force * this.density
        const directionY = forceDirectionY * force * this.density

        if (distance < mouse.current.radius) {
          this.x -= directionX
          this.y -= directionY
        } else {
          if (this.x !== this.baseX) {
            const dx = this.x - this.baseX
            this.x -= dx / 10
          }
          if (this.y !== this.baseY) {
            const dy = this.y - this.baseY
            this.y -= dy / 10
          }
        }
      }
    }

    function init() {
      if (!canvasEl || !ctxEl) return
      particlesArray = []

      const textX = canvasEl.width / 2
      const textY = canvasEl.height / 2

      ctxEl.font = `bold ${fontSize}px "Arial Black", Gadget, sans-serif`
      ctxEl.textAlign = 'center'
      ctxEl.textBaseline = 'middle'

      // Use silver color - a more visible silver/gray
      ctxEl.fillStyle = '#c0c0c0'

      ctxEl.fillText(text, textX, textY)
      const textCoordinates = ctxEl.getImageData(0, 0, canvasEl.width, canvasEl.height)
      ctxEl.clearRect(0, 0, canvasEl.width, canvasEl.height)

      // Silver color in RGB - using a brighter, more visible silver
      const silverColor = 'rgb(200, 200, 200)'

      for (let y = 0; y < textCoordinates.height; y += 4) {
        for (let x = 0; x < textCoordinates.width; x += 4) {
          const alphaIndex = y * 4 * textCoordinates.width + x * 4 + 3
          if (textCoordinates.data[alphaIndex] > 128) {
            // Use silver color directly instead of extracting from image
            particlesArray.push(new Particle(x, y, silverColor))
          }
        }
      }
    }

    function animate() {
      if (!canvasEl || !ctxEl) return
      ctxEl.clearRect(0, 0, canvasEl.width, canvasEl.height)
      particlesArray.forEach((p) => {
        p.draw()
        p.update()
      })
      animationFrameId = requestAnimationFrame(animate)
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX
      mouse.current.y = e.clientY
    }

    const handleResize = () => {
      updateCanvasSize()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('resize', handleResize)

    updateCanvasSize()
    animate()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [text, fontSize])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  )
}

export default ParticleTextHeader

