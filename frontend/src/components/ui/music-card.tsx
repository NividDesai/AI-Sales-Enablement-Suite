import { useState, useEffect, useRef } from 'react'
import { Howl } from 'howler'
import { Play, Pause, SkipForward, SkipBack } from 'lucide-react'

interface MusicCardProps {
  src: string
  poster: string
  autoPlay?: boolean
  mainColor?: string
  title?: string
  artist?: string
}

export function MusicCard({ 
  src, 
  poster, 
  autoPlay = false, 
  mainColor = '#3b82f6', 
  title = 'Unknown Title', 
  artist = 'Unknown Artist' 
}: MusicCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const howler = useRef<Howl | null>(null)
  const progressInterval = useRef<NodeJS.Timer>()

  useEffect(() => {
    if (howler.current) {
      howler.current.stop()
      clearInterval(progressInterval.current)
    }

    const sound = new Howl({
      src,
      onpause: () => {
        setIsPlaying(false)
        clearInterval(progressInterval.current)
      },
      onplay: () => {
        setIsPlaying(true)
        updateProgress()
      },
      onend: () => {
        setIsPlaying(false)
        clearInterval(progressInterval.current)
        setProgress(0)
      },
      onstop: () => {
        setIsPlaying(false)
        clearInterval(progressInterval.current)
        setProgress(0)
      },
      onload: () => {
        setDuration(sound.duration())
      }
    })

    howler.current = sound

    if (autoPlay) {
      sound.play()
    }

    return () => {
      clearInterval(progressInterval.current)
      if (howler.current) {
        howler.current.unload()
      }
    }
  }, [src, autoPlay])

  const updateProgress = () => {
    if (!howler.current) return

    progressInterval.current = setInterval(() => {
      const seek = howler.current?.seek() || 0
      setProgress(typeof seek === 'number' ? seek : 0)
    }, 1000)
  }

  const handlePlayPause = () => {
    if (!howler.current) return

    if (isPlaying) {
      howler.current.pause()
    } else {
      howler.current.play()
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!howler.current || duration === 0) return

    const container = e.currentTarget
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newPosition = percentage * duration

    howler.current.seek(newPosition)
    setProgress(newPosition)
  }

  const handleSkip = (direction: 'forward' | 'backward') => {
    if (!howler.current) return

    const currentTime = howler.current.seek()
    const current = typeof currentTime === 'number' ? currentTime : 0
    const skipAmount = 10 // 10 seconds

    const newTime = direction === 'forward'
      ? Math.min(current + skipAmount, duration)
      : Math.max(current - skipAmount, 0)

    howler.current.seek(newTime)
    setProgress(newTime)
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const cardStyle = {
    '--main-color': mainColor,
    '--hover-color': `${mainColor}33`,
  } as React.CSSProperties

  return (
    <section
      className="w-[20rem] bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-xl p-4 
        shadow-xl hover:shadow-2xl transition-all duration-300 
        hover:bg-white/20 dark:hover:bg-black/30"
      style={cardStyle}
    >
      {/* Poster Image Container */}
      <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden group bg-gray-100">
        <img
          src={poster}
          alt="music poster"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop'
          }}
        />
      </div>

      {/* Music Info */}
      <div className="mb-4 px-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {artist}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-4 px-2">
        <div
          className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer group"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-[var(--main-color)] rounded-full relative"
            style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 
              bg-[var(--main-color)] rounded-full shadow-md transform scale-0 
              group-hover:scale-100 transition-transform"
            />
          </div>
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between px-4">
        <button
          onClick={() => handleSkip('backward')}
          className="p-2 text-gray-600 dark:text-gray-400 
            hover:text-[var(--main-color)] dark:hover:text-[var(--main-color)] 
            transition-colors"
          title="Skip backward 10 seconds"
        >
          <SkipBack className="w-6 h-6" />
        </button>
        <button
          onClick={handlePlayPause}
          className="p-2 rounded-full bg-[var(--main-color)] text-white hover:opacity-80 transition-colors flex items-center justify-center"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </button>
        <button
          onClick={() => handleSkip('forward')}
          className="p-2 text-gray-600 dark:text-gray-400 
            hover:text-[var(--main-color)] dark:hover:text-[var(--main-color)] 
            transition-colors"
          title="Skip forward 10 seconds"
        >
          <SkipForward className="w-6 h-6" />
        </button>
      </div>
    </section>
  )
}

