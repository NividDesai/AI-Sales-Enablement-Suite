'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, SkipForward, SkipBack, Shuffle, Repeat } from 'lucide-react'

// Helper to format time from seconds to MM:SS
const formatTime = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds)) return '00:00'
  const minutes = Math.floor(timeInSeconds / 60)
  const seconds = Math.floor(timeInSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// Interface for the component props
interface MusicPlayerProps {
  albumArt: string
  songTitle: string
  artistName: string
  audioSrc: string
}

// The main MusicPlayer component
export const MusicPlayer: React.FC<MusicPlayerProps> = ({ albumArt, songTitle, artistName, audioSrc }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isShuffle, setIsShuffle] = useState(false)
  const [isRepeat, setIsRepeat] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const progressBarRef = useRef<HTMLInputElement>(null)

  // Effect to handle audio playback and updates
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const setAudioData = () => {
      setDuration(audio.duration)
      setCurrentTime(audio.currentTime)
    }

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime)
      if (progressBarRef.current) {
        const progress = audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0
        progressBarRef.current.style.setProperty('--progress', `${progress}%`)
      }
    }

    audio.addEventListener('loadeddata', setAudioData)
    audio.addEventListener('timeupdate', setAudioTime)

    if (isPlaying) {
      audio.play().catch(error => console.error("Error playing audio:", error))
    } else {
      audio.pause()
    }

    // Cleanup event listeners
    return () => {
      audio.removeEventListener('loadeddata', setAudioData)
      audio.removeEventListener('timeupdate', setAudioTime)
    }
  }, [isPlaying, audioSrc])

  // Handle seeking through the song
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Number(e.target.value)
    }
  }

  const togglePlayPause = () => setIsPlaying(!isPlaying)
  const toggleShuffle = () => setIsShuffle(!isShuffle)
  const toggleRepeat = () => setIsRepeat(!isRepeat)

  return (
    <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg p-4 sm:p-6 flex flex-col items-center">
      <style>{`
        .progress-bar {
            --progress: 0%;
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            outline: none;
            cursor: pointer;
            background-image: linear-gradient(to right, white var(--progress), transparent var(--progress));
            background-repeat: no-repeat;
        }
        .progress-bar::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 14px;
            height: 14px;
            background: white;
            border: 2px solid white;
            border-radius: 50%;
            cursor: pointer;
            margin-top: -4px;
        }
        .progress-bar::-moz-range-thumb {
            width: 14px;
            height: 14px;
            background: white;
            border: 2px solid white;
            border-radius: 50%;
            cursor: pointer;
        }
      `}</style>
      <audio ref={audioRef} src={audioSrc} loop={isRepeat} preload="metadata" />

      {/* Album Art */}
      <motion.div
        className="relative mb-4"
        animate={{ rotate: isPlaying ? 360 : 0 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      >
        <img
          src={albumArt}
          alt={`${songTitle} album art`}
          className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover shadow-2xl border-2 border-white/20"
          onError={(e) => { e.currentTarget.src = 'https://placehold.co/160x160/1a1a1a/ffffff?text=Music' }}
        />
      </motion.div>

      {/* Song Info */}
      <div className="text-center mb-4 w-full">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white truncate">{songTitle}</h2>
        <p className="text-xs sm:text-sm text-white/60 truncate">{artistName}</p>
      </div>

      {/* Progress Bar and Timestamps */}
      <div className="w-full flex items-center gap-x-2 mb-4">
        <span className="text-xs font-mono text-white/60 w-10 text-left">{formatTime(currentTime)}</span>
        <input
          ref={progressBarRef}
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="progress-bar flex-grow"
        />
        <span className="text-xs font-mono text-white/60 w-10 text-right">{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-3 sm:space-x-4 w-full">
        <motion.button 
          whileHover={{ scale: 1.1 }} 
          whileTap={{ scale: 0.9 }} 
          onClick={toggleShuffle} 
          className={`transition-colors p-1.5 rounded-lg ${isShuffle ? 'text-white bg-white/10' : 'text-white/60 hover:text-white'}`}
          title="Shuffle"
        >
          <Shuffle size={16} />
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.1 }} 
          whileTap={{ scale: 0.9 }} 
          className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          title="Previous"
        >
          <SkipBack size={20} />
        </motion.button>

        <motion.button
          onClick={togglePlayPause}
          className="bg-white text-black w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg hover:bg-white/90 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isPlaying ? 'pause' : 'play'}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              {isPlaying ? <Pause size={20} className="sm:w-6 sm:h-6" /> : <Play size={20} className="sm:w-6 sm:h-6 ml-0.5" />}
            </motion.div>
          </AnimatePresence>
        </motion.button>

        <motion.button 
          whileHover={{ scale: 1.1 }} 
          whileTap={{ scale: 0.9 }} 
          className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          title="Next"
        >
          <SkipForward size={20} />
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.1 }} 
          whileTap={{ scale: 0.9 }} 
          onClick={toggleRepeat} 
          className={`transition-colors p-1.5 rounded-lg ${isRepeat ? 'text-white bg-white/10' : 'text-white/60 hover:text-white'}`}
          title="Repeat"
        >
          <Repeat size={16} />
        </motion.button>
      </div>
    </div>
  )
}

