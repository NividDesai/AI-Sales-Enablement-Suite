import { useEffect, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { fbxAnimationLoader } from '../../utils/FBXAnimationLoader'

// Phoneme to ARKit Blendshape mapping (adapted from wass08's viseme approach)
// Backend sends: 'a', 'e', 'o', 'm', 'silence'
// IMPROVED: Better visibility with optimized values
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const corresponding: Record<string, Record<string, number>> = {
  // Backend phoneme 'a' = "ah" sound → viseme_AA (jaw open wide)
  // Reduced values for more natural appearance
  'a': { jawOpen: 0.25, mouthFunnel: 0.15, mouthLowerDownLeft: 0.12, mouthLowerDownRight: 0.12 },
  'A': { jawOpen: 0.25, mouthFunnel: 0.15, mouthLowerDownLeft: 0.12, mouthLowerDownRight: 0.12 },
  
  // Backend phoneme 'e' = "eh" sound → viseme_O (medium round)
  // Reduced values for more natural appearance
  'e': { jawOpen: 0.20, mouthFunnel: 0.18, mouthSmileLeft: 0.12, mouthSmileRight: 0.12 },
  'E': { jawOpen: 0.20, mouthFunnel: 0.18, mouthSmileLeft: 0.12, mouthSmileRight: 0.12 },
  
  // Backend phoneme 'o' = "oh" sound → viseme_U (pucker)
  // Reduced values for more natural appearance
  'o': { jawOpen: 0.18, mouthPucker: 0.25, mouthFunnel: 0.15 },
  'O': { jawOpen: 0.18, mouthPucker: 0.25, mouthFunnel: 0.15 },
  
  // Backend phoneme 'm' = closed lips → viseme_PP (lips closed)
  // Natural, subtle values
  'm': { jawOpen: 0.08, mouthClose: 0.50, mouthPressLeft: 0.30, mouthPressRight: 0.30 },
  'M': { jawOpen: 0.08, mouthClose: 0.50, mouthPressLeft: 0.30, mouthPressRight: 0.30 },
  
  // Additional phonemes for future expansion - natural, subtle values
  'i': { jawOpen: 0.18, mouthSmileLeft: 0.25, mouthSmileRight: 0.25 },  // "ee" smile
  'I': { jawOpen: 0.18, mouthSmileLeft: 0.25, mouthSmileRight: 0.25 },
  'u': { jawOpen: 0.15, mouthPucker: 0.30, mouthFunnel: 0.18 },  // "oo" pucker
  'U': { jawOpen: 0.15, mouthPucker: 0.30, mouthFunnel: 0.18 },
  'p': { jawOpen: 0.06, mouthClose: 0.45, mouthPressLeft: 0.28, mouthPressRight: 0.28 },  // P/B sound
  'P': { jawOpen: 0.06, mouthClose: 0.45, mouthPressLeft: 0.28, mouthPressRight: 0.28 },
  'b': { jawOpen: 0.06, mouthClose: 0.45, mouthPressLeft: 0.28, mouthPressRight: 0.28 },
  'B': { jawOpen: 0.06, mouthClose: 0.45, mouthPressLeft: 0.28, mouthPressRight: 0.28 },
  'f': { jawOpen: 0.12, mouthRollLower: 0.35, mouthUpperUpLeft: 0.20, mouthUpperUpRight: 0.20 },  // F/V sound
  'F': { jawOpen: 0.12, mouthRollLower: 0.35, mouthUpperUpLeft: 0.20, mouthUpperUpRight: 0.20 },
  'v': { jawOpen: 0.12, mouthRollLower: 0.30, mouthUpperUpLeft: 0.18, mouthUpperUpRight: 0.18 },
  'V': { jawOpen: 0.12, mouthRollLower: 0.30, mouthUpperUpLeft: 0.18, mouthUpperUpRight: 0.18 },
  'th': { jawOpen: 0.18, mouthRollLower: 0.18 },  // TH sound
  'TH': { jawOpen: 0.18, mouthRollLower: 0.18 },
  'k': { jawOpen: 0.22 },  // K/G sound - removed jawForward
  'K': { jawOpen: 0.22 },
  'g': { jawOpen: 0.22 },
  'G': { jawOpen: 0.22 },
  'l': { jawOpen: 0.16, tongueOut: 0.25 },  // L sound
  'L': { jawOpen: 0.16, tongueOut: 0.25 },
  'r': { jawOpen: 0.18, mouthFunnel: 0.22 },  // R sound
  'R': { jawOpen: 0.18, mouthFunnel: 0.22 },
  'n': { jawOpen: 0.14, mouthClose: 0.20 },  // N sound (nasal)
  'N': { jawOpen: 0.14, mouthClose: 0.20 },
  'ng': { jawOpen: 0.12, mouthClose: 0.22 },  // NG sound (nasal)
  'NG': { jawOpen: 0.12, mouthClose: 0.22 },
  's': { jawOpen: 0.16, mouthRollLower: 0.30, mouthUpperUpLeft: 0.20, mouthUpperUpRight: 0.20 },  // S sound (hiss)
  'S': { jawOpen: 0.16, mouthRollLower: 0.30, mouthUpperUpLeft: 0.20, mouthUpperUpRight: 0.20 },
  'sh': { jawOpen: 0.18, mouthFunnel: 0.25, mouthRollLower: 0.28 },  // SH sound
  'SH': { jawOpen: 0.18, mouthFunnel: 0.25, mouthRollLower: 0.28 },
  'ch': { jawOpen: 0.16, mouthFunnel: 0.24, mouthPressLeft: 0.20, mouthPressRight: 0.20 },  // CH sound
  'CH': { jawOpen: 0.16, mouthFunnel: 0.24, mouthPressLeft: 0.20, mouthPressRight: 0.20 },
  'j': { jawOpen: 0.15, mouthFunnel: 0.22, mouthPressLeft: 0.18, mouthPressRight: 0.18 },  // J sound
  'J': { jawOpen: 0.15, mouthFunnel: 0.22, mouthPressLeft: 0.18, mouthPressRight: 0.18 },
  
  // Silence / Rest
  'silence': {},
  'SILENCE': {},
  'X': {},
  '': {}
}

// Get all unique blendshape targets that we'll be animating
const getAllBlendshapeTargets = (): string[] => {
  const targets = new Set<string>()
  Object.values(corresponding).forEach(mapping => {
    Object.keys(mapping).forEach(key => targets.add(key))
  })
  return Array.from(targets)
}

// RICH EMOTION EXPRESSIONS - Multiple morph targets for each emotion
const EMOTION_BLENDSHAPES: Record<string, Record<string, number>> = {
  'happy': { 
    // Warm, genuine smile
    mouthSmileLeft: 0.6,
    mouthSmileRight: 0.6,
    cheekSquintLeft: 0.4, 
    cheekSquintRight: 0.4,
    mouthDimpleLeft: 0.3,
    mouthDimpleRight: 0.3,
    eyeSquintLeft: 0.15,
    eyeSquintRight: 0.15
  },
  'excited': { 
    // Energetic, wide-eyed excitement
    eyeWideLeft: 0.7, 
    eyeWideRight: 0.7,
    browInnerUp: 0.5,
    browOuterUpLeft: 0.4,
    browOuterUpRight: 0.4,
    mouthSmileLeft: 0.5,
    mouthSmileRight: 0.5,
    cheekSquintLeft: 0.3,
    cheekSquintRight: 0.3
  },
  'sad': { 
    // Empathetic and concerned - furrowed brow, frown
    browDownLeft: 0.4,
    browDownRight: 0.4,
    browInnerUp: 0.3,
    mouthFrownLeft: 0.35,
    mouthFrownRight: 0.35,
    mouthLowerDownLeft: 0.2,
    mouthLowerDownRight: 0.2,
    eyeSquintLeft: 0.2,
    eyeSquintRight: 0.2
  },
  'surprised': {
    // Shocked, wide open
    eyeWideLeft: 0.8,
    eyeWideRight: 0.8,
    browInnerUp: 0.7,
    browOuterUpLeft: 0.6,
    browOuterUpRight: 0.6,
    jawOpen: 0.3,
    mouthFunnel: 0.2
  },
  'angry': {
    // Frustrated, intense
    browDownLeft: 0.8,
    browDownRight: 0.8,
    eyeSquintLeft: 0.6,
    eyeSquintRight: 0.6,
    noseSneerLeft: 0.4,
    noseSneerRight: 0.4,
    jawForward: 0.3,
    mouthPressLeft: 0.3,
    mouthPressRight: 0.3
  },
  'confused': {
    // Thinking, uncertain
    browInnerUp: 0.6,
    browDownLeft: 0.3,
    eyeSquintLeft: 0.2,
    jawLeft: 0.2
  },
  'neutral': {
    // Calm, professional - no strong expression
  }
}

interface AvatarProps {
  url: string
  phonemes?: Array<{ start: number; end: number; value: string }>
  emotion?: string
  audioUrl?: string
}

export default function Avatar({ url, phonemes = [], emotion = 'neutral', audioUrl }: AvatarProps) {
  // Validate props - but don't block rendering!
  if (!url) {
    return null
  }
  
  // Only log "No phonemes" warning once using a ref (only in development)
  const hasLoggedNoPhonemesRef = useRef(false)
  const isDev = import.meta.env.DEV
  if (isDev && (!phonemes || phonemes.length === 0) && !hasLoggedNoPhonemesRef.current) {
    console.warn('⚠️ Avatar: No phonemes, but will still show static avatar')
    hasLoggedNoPhonemesRef.current = true
  } else if (phonemes && phonemes.length > 0) {
    hasLoggedNoPhonemesRef.current = false // Reset when phonemes arrive
  }
  
  // useGLTF hook - must be called unconditionally (React hook rules)
  // It uses Suspense internally - errors are handled by ErrorBoundary
  // If it throws a Promise, Suspense will catch it and show fallback
  const gltfResult = useGLTF(url)
  const scene = gltfResult.scene
  
  const startTimeRef = useRef<number | null>(null)
  const meshesWithMorphsRef = useRef<THREE.Mesh[]>([])
  const [isReady, setIsReady] = useState(false)
  const avatarGroupRef = useRef<THREE.Group>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const lastPhonemesRef = useRef<Array<{ start: number; end: number; value: string }>>([])
  const lastAudioUrlRef = useRef<string | undefined>(undefined)
  const isActuallySpeakingRef = useRef(false)
  
  // MIXAMO ANIMATION SYSTEM
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({})
  const currentActionRef = useRef<THREE.AnimationAction | null>(null)
  const [animationsLoaded, setAnimationsLoaded] = useState(false)
  
  // ANIMATION ROTATION SYSTEM - Track last played animations
  const lastIdleAnimRef = useRef<string | null>(null)
  const lastTalkingAnimRef = useRef<string | null>(null)
  const lastSpeakingStateRef = useRef(false)

  // Cleanup and reset when URL changes (persona switch)
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts or URL changes
      console.log('🧹 Cleaning up avatar resources for URL:', url)
      
      // Stop all animations
      if (currentActionRef.current) {
        currentActionRef.current.stop()
        currentActionRef.current = null
      }
      
      // Clear actions
      Object.values(actionsRef.current).forEach(action => {
        action.stop()
        action.reset()
      })
      actionsRef.current = {}
      
      // Reset mixer
      if (mixerRef.current) {
        mixerRef.current.stopAllAction()
        mixerRef.current = null
      }
      
      // Reset refs
      lastPhonemesRef.current = []
      isActuallySpeakingRef.current = false
      lastSpeakingStateRef.current = false
      lastIdleAnimRef.current = null
      lastTalkingAnimRef.current = null
      audioElementRef.current = null
      startTimeRef.current = null
      meshesWithMorphsRef.current = []
      setIsReady(false)
      setAnimationsLoaded(false)
    }
  }, [url]) // Re-run cleanup when URL changes

  // Find all meshes with morph targets
  useEffect(() => {
    if (isReady) return // Only run once
    
    const meshes: THREE.Mesh[] = []
    
    // First pass: collect meshes with morphs
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetDictionary) {
        meshes.push(child)
        if (import.meta.env.DEV) {
          const blendshapeNames = Object.keys(child.morphTargetDictionary)
          console.log(`✅ Found mesh with morphs: ${child.name} (${blendshapeNames.length} blendshapes)`)
          // Log mouth-related blendshapes for debugging
          const mouthBlendshapes = blendshapeNames.filter(name => 
            name.toLowerCase().includes('mouth') || name.toLowerCase().includes('jaw')
          )
          if (mouthBlendshapes.length > 0) {
            console.log(`👄 Mouth/Jaw blendshapes available:`, mouthBlendshapes.join(', '))
          }
          // Check specifically for jawOpen
          const jawOpenIndex = child.morphTargetDictionary['jawOpen']
          if (jawOpenIndex !== undefined) {
            console.log(`✅ jawOpen blendshape found at index ${jawOpenIndex}`)
          } else {
            console.warn(`⚠️ jawOpen blendshape NOT FOUND! Looking for alternatives...`)
            const jawAlternatives = blendshapeNames.filter(name => 
              name.toLowerCase().includes('jaw') && name.toLowerCase().includes('open')
            )
            if (jawAlternatives.length > 0) {
              console.warn(`   Found alternatives:`, jawAlternatives.join(', '))
            } else {
              console.warn(`   No jaw-related blendshapes found!`)
            }
          }
        }
      }
    })
    
    // USE DEFAULT POSE from GLB - No bone rotation overrides
    let bonesFound: string[] = []
    
    scene.traverse((child) => {
      if ((child as any).isBone || child.type === 'Bone' || child.name) {
        bonesFound.push(child.name)
      }
    })
    
    // Log unique bone names for animation retargeting (only in dev)
    if (import.meta.env.DEV) {
      const uniqueBones = [...new Set(bonesFound)].filter(name => name && name.length > 0)
      console.log(`🦴 Found ${uniqueBones.length} unique bones for animation`)
    }
    
    meshesWithMorphsRef.current = meshes
    setIsReady(true)
    
    // Start animation timer when new phonemes arrive
    // Check if phonemes actually changed (not just re-render)
    const phonemesChanged = JSON.stringify(phonemes) !== JSON.stringify(lastPhonemesRef.current)
    
    if (phonemes && phonemes.length > 0 && phonemesChanged) {
      const wasEmpty = lastPhonemesRef.current.length === 0
      const hadPhonemes = lastPhonemesRef.current.length > 0
      
      // Save old phonemes before updating for comparison
      const oldPhonemes = [...lastPhonemesRef.current]
      lastPhonemesRef.current = phonemes
      
      // Check if this is a completely new response (new audio file)
      // Compare audioUrl (most reliable) or phoneme data to see if it's truly new
      const audioUrlChanged = audioUrl && audioUrl !== lastAudioUrlRef.current
      
      // More aggressive detection: if audio URL changed OR phonemes are completely different, it's a new response
      // Also check if the first phoneme start time is different (new audio starts from 0)
      const firstPhonemeStartChanged = hadPhonemes && phonemes.length > 0 && oldPhonemes.length > 0 &&
        Math.abs(phonemes[0].start - oldPhonemes[0]?.start) > 0.1 // More than 0.1s difference = new response
      
      const isNewResponse = audioUrlChanged || firstPhonemeStartChanged || 
        (hadPhonemes && phonemes.length > 0 && oldPhonemes.length > 0 &&
         (phonemes[0].value !== oldPhonemes[0]?.value || phonemes.length !== oldPhonemes.length))
      
      // ALWAYS reset for new phonemes if audio URL changed or if it's clearly a new response
      // This ensures each new line/response gets fresh timing
      const shouldReset = wasEmpty || isNewResponse || !audioElementRef.current || 
        (audioElementRef.current && (audioElementRef.current.paused || audioElementRef.current.ended))
      
      if (shouldReset) {
        startTimeRef.current = null
        // Clear audio element reference to force detection of new one
        if (isNewResponse || audioUrlChanged) {
          audioElementRef.current = null
          console.log('🔄 NEW RESPONSE DETECTED - resetting timer and audio element')
          console.log(`   Audio URL changed: ${audioUrlChanged ? 'YES' : 'NO'}`)
          console.log(`   First phoneme start changed: ${firstPhonemeStartChanged ? 'YES' : 'NO'}`)
          console.log(`   Old phonemes: ${oldPhonemes.length} (first: ${oldPhonemes[0]?.start?.toFixed(2)}s, last: ${oldPhonemes[oldPhonemes.length - 1]?.end?.toFixed(2)}s)`)
          console.log(`   New phonemes: ${phonemes.length} (first: ${phonemes[0]?.start?.toFixed(2)}s, last: ${phonemes[phonemes.length - 1]?.end?.toFixed(2)}s)`)
        } else {
          console.log('⏱️ Resetting timer (first set or audio not playing)')
        }
      } else {
        // Audio is already playing and phonemes appear to be the same/updated - don't reset timer
        console.log('⏱️ Phonemes updated (same response), keeping existing timer for continuity')
        console.log(`   Phoneme count: ${phonemes.length}, first: ${phonemes[0]?.start?.toFixed(2)}s, last: ${phonemes[phonemes.length - 1]?.end?.toFixed(2)}s`)
      }
      
      // Update last audioUrl for next comparison
      if (audioUrl) {
        lastAudioUrlRef.current = audioUrl
      }
      
      // Set speaking state immediately when phonemes arrive
      // Animation switching will be triggered by phonemes dependency in useEffect
      isActuallySpeakingRef.current = true
      console.log('📝 Updated phonemes, total count:', phonemes.length)
      
      // Find audio element for sync - wait a bit for AvatarChatPage to add it to DOM
      let audioEl: HTMLAudioElement | null = null
      
      // Try multiple times to find the audio element (it might be added asynchronously)
      const findAudioElement = () => {
        const audioElements = document.querySelectorAll('audio')
        if (audioElements.length > 0) {
          // For new responses, prioritize finding the newest/most recent audio element
          // Check from the end of the list (newest elements are usually added last)
          for (let i = audioElements.length - 1; i >= 0; i--) {
            const el = audioElements[i] as HTMLAudioElement
            // Prioritize: playing > has src matching URL > has src > any element
            if (el.src && !el.paused && !el.ended) {
              return el // Best match: currently playing
            }
            if (audioUrl && el.src && el.src.includes(audioUrl)) {
              return el // Good match: matches our audio URL
            }
            if (el.src && el.readyState > 0) {
              return el // OK match: has loaded data
            }
          }
          // Fallback to last element (most likely to be the new one)
          return audioElements[audioElements.length - 1] as HTMLAudioElement
        }
        return null
      }
      
      // Helper function to set up audio listeners
      const setupAudioListeners = (audio: HTMLAudioElement) => {
        // Sync timer with audio playback
        const syncWithAudio = () => {
          if (audio.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            startTimeRef.current = performance.now() - (audio.currentTime * 1000)
            console.log('✅ Synced timer with audio playback at', audio.currentTime, 's')
          } else {
            // Wait for audio to be ready
            audio.addEventListener('canplay', syncWithAudio, { once: true })
          }
        }
        
        // Set up event listeners - use arrow functions to capture current refs
        const handlePlay = () => {
          // Sync timer immediately with audio's current time
          const currentTime = audio.currentTime
          startTimeRef.current = performance.now() - (currentTime * 1000)
          isActuallySpeakingRef.current = true
          console.log('✅ Audio started playing, synced timer at', currentTime, 's')
        }
        
        const handleTimeUpdate = () => {
          // Continuously sync timer with audio for perfect accuracy
          if (!audio.paused && !audio.ended) {
            const currentTime = audio.currentTime
            startTimeRef.current = performance.now() - (currentTime * 1000)
          }
        }
        
        const handleEnded = () => {
          isActuallySpeakingRef.current = false
          console.log('🔇 Audio ended, switching to idle')
        }
        
        const handlePause = () => {
          isActuallySpeakingRef.current = false
        }
        
        // Remove old listeners and add new ones
        audio.removeEventListener('play', handlePlay)
        audio.removeEventListener('timeupdate', handleTimeUpdate)
        audio.removeEventListener('ended', handleEnded)
        audio.removeEventListener('pause', handlePause)
        
        audio.addEventListener('play', handlePlay, { once: true })
        audio.addEventListener('timeupdate', handleTimeUpdate) // Continuous sync
        audio.addEventListener('ended', handleEnded, { once: true })
        audio.addEventListener('pause', handlePause)
        
        // If audio is already playing, sync immediately
        if (!audio.paused && !audio.ended) {
          syncWithAudio()
          isActuallySpeakingRef.current = true
        }
      }
      
      // Try immediately
      audioEl = findAudioElement()
      
      // For new responses, always update the audio element reference
      if (isNewResponse || audioUrlChanged) {
        if (audioEl) {
          audioElementRef.current = audioEl
          setupAudioListeners(audioEl)
          console.log('✅ Found and set up audio element for NEW response')
          
          // If audio is already playing, sync immediately
          if (!audioEl.paused && !audioEl.ended) {
            startTimeRef.current = performance.now() - (audioEl.currentTime * 1000)
            console.log('✅ Synced timer with already-playing audio at', audioEl.currentTime.toFixed(2), 's')
          }
        } else {
          // Retry multiple times with increasing delays for new responses
          const retryDelays = [50, 100, 200, 500]
          retryDelays.forEach((delay, index) => {
            setTimeout(() => {
              audioEl = findAudioElement()
              if (audioEl) {
                audioElementRef.current = audioEl
                setupAudioListeners(audioEl)
                console.log(`✅ Found audio element for NEW response (retry ${index + 1})`)
                
                // If audio is already playing, sync immediately
                if (!audioEl.paused && !audioEl.ended) {
                  startTimeRef.current = performance.now() - (audioEl.currentTime * 1000)
                  console.log('✅ Synced timer with already-playing audio at', audioEl.currentTime.toFixed(2), 's')
                }
              } else if (index === retryDelays.length - 1) {
                console.warn('⚠️ Could not find audio element for new response after all retries')
              }
            }, delay)
          })
        }
      } else {
        // Existing response - only update if needed
        if (audioElementRef.current && !audioElementRef.current.ended && !audioElementRef.current.paused) {
          console.log('✅ Audio already playing, keeping existing audio element reference')
          // Just ensure it's still the right element
          const currentAudio = findAudioElement()
          if (currentAudio && currentAudio !== audioElementRef.current) {
            audioElementRef.current = currentAudio
            setupAudioListeners(currentAudio)
            console.log('🔄 Updated audio element reference')
          }
        } else if (audioEl) {
          audioElementRef.current = audioEl
          setupAudioListeners(audioEl)
          console.log('✅ Found existing audio element')
        } else {
          // If not found, try again after a short delay (audio might be added asynchronously)
          setTimeout(() => {
            audioEl = findAudioElement()
            if (audioEl) {
              audioElementRef.current = audioEl
              setupAudioListeners(audioEl)
              console.log('✅ Found audio element (retry)')
            } else {
              // Fallback: start timer immediately (may have slight delay)
              if (!startTimeRef.current) {
                startTimeRef.current = performance.now()
                console.log('⏱️ Starting lip sync timer (no audio element found)')
              }
            }
          }, 200)
        }
      }
    } else if (!phonemes || phonemes.length === 0) {
      // No phonemes - definitely not speaking
      isActuallySpeakingRef.current = false
    }
    
    // INITIALIZE MIXAMO ANIMATION SYSTEM
    // Reset mixer when URL changes (new persona)
    if (!mixerRef.current || (mixerRef.current && !animationsLoaded)) {
      // Clean up old mixer if it exists
      if (mixerRef.current) {
        mixerRef.current.stopAllAction()
        mixerRef.current = null
      }
      
      // Clear old actions
      actionsRef.current = {}
      currentActionRef.current = null
      setAnimationsLoaded(false)
      
      console.log('🎬 Initializing Mixamo AnimationMixer...')
      mixerRef.current = new THREE.AnimationMixer(scene)
      
      // Load FBX animations from Mixamo
      loadFBXAnimations(scene)
    }
    
    console.log('🎬 Avatar loaded, starting lip sync')
    console.log(`📊 Total phonemes: ${phonemes.length}`)
    if (phonemes.length > 0) {
      console.log(`📝 First phoneme:`, phonemes[0])
      console.log(`📝 Last phoneme:`, phonemes[phonemes.length - 1])
      
      // Log all unique phoneme values
      const uniquePhonemes = [...new Set(phonemes.map(p => p.value))]
      console.log('🔤 Unique phoneme values in data:', uniquePhonemes.join(', '))
      console.log('🔤 Available mappings:', Object.keys(corresponding).filter(k => k !== '').join(', '))
      
      // Check for missing mappings
      const missingMappings = uniquePhonemes.filter(p => !(p in corresponding))
      if (missingMappings.length > 0) {
        console.warn('⚠️ MISSING PHONEME MAPPINGS:', missingMappings.join(', '))
      }
    }
  }, [scene, phonemes])
  
  // LOAD FBX ANIMATIONS from Mixamo files
  const loadFBXAnimations = async (avatarScene: THREE.Group) => {
    console.log('📦 Loading FBX animations from Mixamo...')
    
    // Define FBX animation files (copied from animations_down)
    const animationFiles: Record<string, string> = {
      'idle': '/animations/Idle.fbx',
      'breathing': '/animations/Breathing Idle.fbx',
      'talking': '/animations/Talking.fbx',
      'talking2': '/animations/Talking 2.fbx',
      'salute': '/animations/Salute.fbx'
    }
    
    try {
      // Load all FBX animations
      const clips = await fbxAnimationLoader.loadAnimations(animationFiles)
      
      console.log(`✅ Loaded ${clips.size} FBX animations`)
      
      // Retarget and create actions for each clip
      clips.forEach((clip, name) => {
        try {
          // For talking animations, exclude jaw bone tracks so blendshape-based lip sync can control the jaw
          const isTalkingAnimation = name === 'talking' || name === 'talking2'
          const excludeBones = isTalkingAnimation ? ['Jaw', 'jaw', 'mixamorigJaw'] : []
          
          if (isTalkingAnimation) {
            console.log(`   🚫 Excluding jaw bone tracks from "${name}" animation for blendshape-based lip sync`)
          }
          
          // Retarget animation to match Ready Player Me skeleton
          const retargetedClip = fbxAnimationLoader.retargetAnimation(clip, avatarScene, excludeBones)
          
          if (retargetedClip.tracks.length === 0) {
            console.warn(`⚠️ Animation "${name}" has no tracks after retargeting - skipping`)
            return
          }
          
          // Apply retargeted animation to avatar
          const action = mixerRef.current!.clipAction(retargetedClip, avatarScene)
          if (!action) {
            console.error(`❌ Failed to create action for ${name}`)
            return
          }
          
          action.setLoop(THREE.LoopRepeat, Infinity)
          actionsRef.current[name] = action
          console.log(`  ✅ Animation: "${name}" (${retargetedClip.duration.toFixed(2)}s, ${retargetedClip.tracks.length} tracks)`)
        } catch (error) {
          console.error(`❌ Failed to create action for ${name}:`, error)
        }
      })
      
      // Start with idle animation if available (will be called after playAnimation is defined)
      setTimeout(() => {
        if (actionsRef.current['idle']) {
          const action = actionsRef.current['idle']
          action.reset().fadeIn(0.5).play()
          currentActionRef.current = action
          console.log('🎬 Started with idle animation')
        } else if (actionsRef.current['breathing']) {
          const action = actionsRef.current['breathing']
          action.reset().fadeIn(0.5).play()
          currentActionRef.current = action
          console.log('🎬 Started with breathing animation')
        }
      }, 100)
      
      setAnimationsLoaded(true)
      console.log('✅ All Mixamo animations ready!')
      
    } catch (error) {
      console.error('❌ Failed to load FBX animations:', error)
      console.log('⚠️ Falling back to procedural animations')
      setAnimationsLoaded(true)
    }
  }
  
  // GET NEXT ANIMATION in rotation (alternating system)
  const getNextAnimation = (animationList: string[], lastPlayedRef: React.MutableRefObject<string | null>): string | null => {
    if (!animationList || animationList.length === 0) {
      return null
    }
    
    // If only one animation, return it
    if (animationList.length === 1) {
      return animationList[0]
    }
    
    // Get last played animation
    const lastPlayed = lastPlayedRef.current
    
    // If no last played, start with first
    if (!lastPlayed) {
      lastPlayedRef.current = animationList[0]
      return animationList[0]
    }
    
    // Find current index and get next one
    const currentIndex = animationList.indexOf(lastPlayed)
    const nextIndex = (currentIndex + 1) % animationList.length
    const nextAnim = animationList[nextIndex]
    
    // Update last played
    lastPlayedRef.current = nextAnim
    
    console.log(`🔄 Rotating animation: ${lastPlayed} → ${nextAnim}`)
    return nextAnim
  }
  
  // PLAY MIXAMO ANIMATION with smooth blending
  const playAnimation = (animationName: string, fadeTime: number = 0.5) => {
    const newAction = actionsRef.current[animationName]
    
    if (!newAction) {
      return  // Animation not found, skip
    }
    
    // Don't restart if already playing
    if (currentActionRef.current === newAction && newAction.isRunning()) {
      return
    }
    
    // Fade out current animation
    if (currentActionRef.current && currentActionRef.current !== newAction) {
      currentActionRef.current.fadeOut(fadeTime)
    }
    
    // Set loop mode based on animation type (matching avatar try - Copy pattern)
    if (animationName === 'talking' || animationName === 'talking2') {
      // Talking animations loop continuously while speaking
      newAction.setLoop(THREE.LoopRepeat, Infinity)
      newAction.clampWhenFinished = false
    } else {
      // Idle animations play once, then auto-rotate
      newAction.setLoop(THREE.LoopOnce, 1)
      newAction.clampWhenFinished = true
    }
    
    // Fade in and play new animation
    newAction
      .reset()
      .setEffectiveTimeScale(1)
      .setEffectiveWeight(1)
      .fadeIn(fadeTime)
      .play()
    
    currentActionRef.current = newAction
    console.log(`🎬 Playing animation: ${animationName}`)
  }
  
  // ANIMATION STATE MANAGEMENT - Switch animations based on speaking/emotion
  // Check both phonemes AND audio state to determine if speaking
  useEffect(() => {
    if (!animationsLoaded || Object.keys(actionsRef.current).length === 0) {
      return  // No animations loaded yet
    }
    
    // Determine speaking state: has phonemes AND audio is playing (not ended)
    const hasPhonemes = phonemes && phonemes.length > 0
    const audioPlaying = audioElementRef.current ? (!audioElementRef.current.ended && !audioElementRef.current.paused) : false
    const audioEnded = audioElementRef.current?.ended === true
    const isSpeaking = hasPhonemes && audioPlaying && !audioEnded
    
    const speakingStateChanged = isSpeaking !== lastSpeakingStateRef.current
    
    // Only switch animations when state changes (not on every phoneme update)
    if (!speakingStateChanged) {
      return
    }
    
    console.log(`🔄 Animation state changed: ${lastSpeakingStateRef.current ? 'speaking' : 'idle'} → ${isSpeaking ? 'speaking' : 'idle'} (phonemes: ${hasPhonemes}, audio playing: ${audioPlaying}, audio ended: ${audioEnded})`)
    lastSpeakingStateRef.current = isSpeaking
    
    if (isSpeaking) {
      // SPEAKING: Alternate between "talking" and "talking2"
      const talkingAnims = ['talking', 'talking2'].filter(name => actionsRef.current[name])
      
      if (talkingAnims.length > 0) {
        const nextTalkingAnim = getNextAnimation(talkingAnims, lastTalkingAnimRef)
        if (nextTalkingAnim) {
          console.log(`🗣️ Speaking - switching to ${nextTalkingAnim} animation`)
          playAnimation(nextTalkingAnim)
        }
      } else {
        console.warn('⚠️ No talking animations available')
      }
    } else {
      // IDLE: Rotate between "idle" and "breathing" only
      const idleAnims = ['idle', 'breathing'].filter(name => actionsRef.current[name])
      
      if (idleAnims.length > 0) {
        const nextAnim = getNextAnimation(idleAnims, lastIdleAnimRef)
        if (nextAnim) {
          console.log(`😴 Idle - switching to ${nextAnim} animation`)
          playAnimation(nextAnim)
        }
      } else {
        console.warn('⚠️ No idle animations available')
      }
    }
  }, [animationsLoaded, phonemes]) // Depend on phonemes - audio state is checked inside
  
  // Separate effect to watch for audio ended/play events and trigger animation switch
  // This ensures animations switch immediately when audio state changes
  useEffect(() => {
    if (!animationsLoaded || Object.keys(actionsRef.current).length === 0) {
      return
    }
    
    // Find audio element if we don't have one yet
    if (!audioElementRef.current) {
      const audioElements = document.querySelectorAll('audio')
      if (audioElements.length > 0) {
        audioElementRef.current = audioElements[0] as HTMLAudioElement
      }
    }
    
    const audio = audioElementRef.current
    if (!audio) {
      return
    }
    
    const handleEnded = () => {
      // Force animation switch to idle when audio ends
      console.log('🔇 Audio ended event - switching to idle animation')
      if (lastSpeakingStateRef.current) {
        lastSpeakingStateRef.current = false
        isActuallySpeakingRef.current = false
        const idleAnims = ['idle', 'breathing'].filter(name => actionsRef.current[name])
        if (idleAnims.length > 0) {
          const nextAnim = getNextAnimation(idleAnims, lastIdleAnimRef)
          if (nextAnim) {
            console.log(`🔇 Switching to ${nextAnim} animation`)
            playAnimation(nextAnim)
          }
        }
      }
    }
    
    const handlePlay = () => {
      // Force animation switch to talking when audio starts
      const hasPhonemes = phonemes && phonemes.length > 0
      if (hasPhonemes && !lastSpeakingStateRef.current) {
        console.log('🗣️ Audio play event - switching to talking animation')
        lastSpeakingStateRef.current = true
        isActuallySpeakingRef.current = true
        const talkingAnims = ['talking', 'talking2'].filter(name => actionsRef.current[name])
        if (talkingAnims.length > 0) {
          const nextTalkingAnim = getNextAnimation(talkingAnims, lastTalkingAnimRef)
          if (nextTalkingAnim) {
            console.log(`🗣️ Switching to ${nextTalkingAnim} animation`)
            playAnimation(nextTalkingAnim)
          }
        }
      }
    }
    
    // Add event listeners
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    
    // Also check current state immediately
    if (audio.ended && lastSpeakingStateRef.current) {
      handleEnded()
    } else if (!audio.paused && !audio.ended && phonemes && phonemes.length > 0 && !lastSpeakingStateRef.current) {
      handlePlay()
    }
    
    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
    }
  }, [animationsLoaded, phonemes]) // Re-run when phonemes change or animations load

  // Helper function to lerp (smoothly animate) morph targets - wass08 approach
  const lerpMorphTarget = (target: string, value: number, speed: number = 0.18) => {
    if (meshesWithMorphsRef.current.length === 0) {
      return // No meshes with morphs found
    }
    
    let applied = false
    let currentValue = 0
    let newValue = 0
    
    meshesWithMorphsRef.current.forEach((mesh) => {
      if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        const index = mesh.morphTargetDictionary[target]
        if (index !== undefined && index >= 0) {
          // THREE.MathUtils.lerp equivalent: current + (target - current) * speed
          const current = mesh.morphTargetInfluences[index] || 0
          const nextValue = current + (value - current) * speed
          mesh.morphTargetInfluences[index] = clamp01(nextValue)
          applied = true
          currentValue = current
          newValue = nextValue
        }
      }
    })
    
    // Debug: Log jaw application for troubleshooting
    if (target.includes('jaw') && Math.random() < 0.1) {
      if (applied) {
        console.log(`🦷 Jaw '${target}': ${currentValue.toFixed(3)} → ${newValue.toFixed(3)} (target: ${value.toFixed(3)}, speed: ${speed})`)
      } else {
        console.warn(`⚠️ Jaw '${target}' NOT FOUND in blendshapes!`)
      }
    }
    
    // Debug: warn if target not found (first few times)
    if (!applied && Math.random() < 0.01) {
      const availableTargets = new Set<string>()
      meshesWithMorphsRef.current.forEach(mesh => {
        if (mesh.morphTargetDictionary) {
          Object.keys(mesh.morphTargetDictionary).forEach(key => availableTargets.add(key))
        }
      })
      const jawTargets = Array.from(availableTargets).filter(t => t.toLowerCase().includes('jaw'))
      console.warn(`⚠️ Morph target '${target}' not found. Jaw targets available:`, jawTargets.join(', ') || 'NONE')
      console.warn(`   All available targets (first 30):`, Array.from(availableTargets).slice(0, 30).join(', '))
    }
  }

  // Animate morph targets based on phonemes - wass08's approach + enhanced
  useFrame((_state, delta) => {
    // MANUALLY DISABLE JAW BONE ROTATION during speech to prevent conflicts with blendshapes
    // This ensures blendshape-based jaw movement is visible
    if (avatarGroupRef.current && isActuallySpeakingRef.current) {
      avatarGroupRef.current.traverse((child) => {
        if (child.name && (child.name.toLowerCase().includes('jaw') || child.name === 'Jaw')) {
          const bone = child as THREE.Bone
          // Reset jaw bone rotation to default (identity) so blendshapes can control it
          if (bone.rotation) {
            bone.rotation.set(0, 0, 0)
          }
        }
      })
    }
    
    // UPDATE MIXAMO ANIMATIONS
    if (mixerRef.current) {
      mixerRef.current.update(delta)
      
      // Continuously check for audio element - it might be replaced when new responses arrive
      // Check every frame to catch audio element replacement immediately
      const audioElements = document.querySelectorAll('audio')
      if (audioElements.length > 0) {
        // Find the audio element that's playing or has a src (prioritize playing ones)
        let newAudio: HTMLAudioElement | null = null
        
        // First, try to find one that's currently playing
        for (let i = 0; i < audioElements.length; i++) {
          const el = audioElements[i] as HTMLAudioElement
          if (el.src && !el.paused && !el.ended) {
            newAudio = el
            break
          }
        }
        
        // If no playing audio, find any with src
        if (!newAudio) {
          for (let i = 0; i < audioElements.length; i++) {
            const el = audioElements[i] as HTMLAudioElement
            if (el.src && !el.ended) {
              newAudio = el
              break
            }
          }
        }
        
        // Fallback to first element if none found
        if (!newAudio && audioElements.length > 0) {
          newAudio = audioElements[0] as HTMLAudioElement
        }
        
        // Update audio element reference if it changed (new response = new audio element)
        if (newAudio && newAudio !== audioElementRef.current) {
          console.log('🔄 Audio element changed - new response detected, updating reference')
          audioElementRef.current = newAudio
          
          // Re-attach listeners for the new audio element
          const handlePlay = () => {
            isActuallySpeakingRef.current = true
            console.log('✅ Audio started (detected in useFrame)')
          }
          const handleEnded = () => {
            isActuallySpeakingRef.current = false
            console.log('🔇 Audio ended (detected in useFrame), switching to idle')
          }
          newAudio.addEventListener('play', handlePlay, { once: true })
          newAudio.addEventListener('ended', handleEnded, { once: true })
          
          // If already playing, update state immediately
          if (!newAudio.paused && !newAudio.ended) {
            isActuallySpeakingRef.current = true
            // Reset timer to sync with new audio (new response = new audio starting from 0)
            startTimeRef.current = performance.now() - (newAudio.currentTime * 1000)
            console.log('⏱️ Synced timer with new audio element at', newAudio.currentTime.toFixed(2), 's')
          } else if (newAudio.readyState >= 2) {
            // Audio is loaded but not playing yet - prepare timer
            startTimeRef.current = null // Will be set when audio starts
            console.log('⏱️ New audio element ready, timer will sync on play')
          }
        }
      } else if (audioElementRef.current && audioElementRef.current.ended) {
        // Audio ended and no new audio element - clear reference
        audioElementRef.current = null
      }
      
      
      // AUTO-ROTATE IDLE ANIMATIONS when current animation finishes
      // Check both phonemes AND audio state
      if (currentActionRef.current && !currentActionRef.current.isRunning()) {
        const hasPhonemes = phonemes && phonemes.length > 0
        const audioPlaying = audioElementRef.current && !audioElementRef.current.ended && !audioElementRef.current.paused
        const isSpeaking = hasPhonemes && audioPlaying
        
        if (!isSpeaking) {
          // Idle state - rotate between "idle" and "breathing" only
          const idleAnims = ['idle', 'breathing'].filter(name => actionsRef.current[name])
          if (idleAnims.length > 0) {
            const nextAnim = getNextAnimation(idleAnims, lastIdleAnimRef)
            if (nextAnim) {
              console.log(`⏭️ Animation finished, rotating to: ${nextAnim}`)
              playAnimation(nextAnim)
            }
          }
        }
      }
    }
    
    // LIP SYNC - Apply phonemes to morph targets
    if (!isReady || !phonemes || phonemes.length === 0) {
      // Reset all mouth morphs to neutral when idle
      const mouthMorphTargets = getAllBlendshapeTargets()
      mouthMorphTargets.forEach(target => {
        lerpMorphTarget(target, 0, 0.1)
      })
      return
    }

    // Calculate elapsed time - ALWAYS use audio element's currentTime when available for perfect sync
    let elapsed = 0
    let audioDuration = 0
    let isAudioPlaying = false
    let isAudioEnded = false
    
    if (audioElementRef.current) {
      // ALWAYS use audio.currentTime for perfect sync (even if paused, to catch up)
      elapsed = audioElementRef.current.currentTime
      audioDuration = audioElementRef.current.duration || 0
      isAudioPlaying = !audioElementRef.current.paused && !audioElementRef.current.ended
      isAudioEnded = audioElementRef.current.ended
      
      // Update startTimeRef to match for fallback
      if (!startTimeRef.current) {
        startTimeRef.current = performance.now() - (elapsed * 1000)
      }
    } else if (startTimeRef.current) {
      // Fallback to timer-based if no audio element
      elapsed = (performance.now() - startTimeRef.current) / 1000
    } else {
      // No timing available yet - start timer now
      startTimeRef.current = performance.now()
      elapsed = 0
    }
    
    // Only stop lip sync when audio actually ends, not when phonemes end
    if (isAudioEnded || (audioDuration > 0 && elapsed >= audioDuration - 0.1)) {
      // Audio finished - reset mouth to neutral
      const mouthMorphTargets = getAllBlendshapeTargets()
      mouthMorphTargets.forEach(target => {
        lerpMorphTarget(target, 0, 0.1)
      })
      return
    }

    // Find current phoneme - continue lip sync even if past phonemes (use last phoneme or default)
    let currentPhoneme = phonemes.find(
      p => p.start <= elapsed && elapsed < p.end
    )
    
    // Debug: Log if we can't find a phoneme but should have one
    if (!currentPhoneme && isAudioPlaying && elapsed > 0 && phonemes.length > 0) {
      const firstPhoneme = phonemes[0]
      const lastPhoneme = phonemes[phonemes.length - 1]
      
      // Log timing info to help debug (only occasionally to avoid spam)
      if (elapsed < 10.0 && Math.random() < 0.01) {
        console.log(`🔍 Phoneme search: elapsed=${elapsed.toFixed(2)}s, phoneme range: ${firstPhoneme.start.toFixed(2)}s - ${lastPhoneme.end.toFixed(2)}s, total phonemes: ${phonemes.length}, audio duration: ${audioDuration.toFixed(2)}s`)
      }
      
      // If we're before the first phoneme, use the first one
      if (elapsed < firstPhoneme.start) {
        currentPhoneme = firstPhoneme
      }
      // If we're past all phonemes but audio is still playing, keep mouth animated
      // Use the last phoneme for smooth transition, then gradually fade to subtle animation
      else if (elapsed < audioDuration - 0.1) {
        // Keep using last phoneme for smooth transition (up to 0.5 seconds)
        if (lastPhoneme && elapsed < lastPhoneme.end + 0.5) {
          currentPhoneme = lastPhoneme
        }
        // After that, we'll handle it in the silence case below to keep mouth animated
      }
    }

    // LIPSYNC - Apply phoneme to morph targets
    // CRITICAL: Always keep lip sync active while audio is playing
    const appliedMorphTargets: string[] = []
    const phonemeKey = currentPhoneme?.value || ''
    const phonemeMapping = corresponding[phonemeKey]
    
    // Track if we applied any phoneme-based animation
    let appliedPhonemeAnimation = false

    // Debug logging (first few frames and periodically)
    if ((elapsed < 2.0 && Math.random() < 0.05) || (elapsed > 0 && Math.floor(elapsed) % 2 === 0 && Math.random() < 0.01)) {
      const audioInfo = audioElementRef.current 
        ? `audio: ${audioElementRef.current.currentTime.toFixed(2)}s/${audioDuration.toFixed(2)}s, playing: ${isAudioPlaying}, ended: ${isAudioEnded}`
        : 'no audio element'
      console.log(`👄 Lip sync: elapsed=${elapsed.toFixed(2)}s, phoneme='${phonemeKey}', ${audioInfo}`)
    }

    // Apply phoneme-based animation if available
    if (phonemeMapping && Object.keys(phonemeMapping).length > 0) {
      appliedPhonemeAnimation = true
      // Apply active phoneme blendshapes with SMOOTH lerping for natural transitions
      // Use moderate lerp speed for all targets to prevent jarring "popping" movements
      Object.entries(phonemeMapping).forEach(([target, value]) => {
        const isJawTarget = target.includes('jaw')
        
        // Use smooth lerp for ALL targets - different speeds for jaw vs mouth
        if (isJawTarget) {
          // For jaw, use natural values without boosting
          const jawValue = Math.min(1.0, value) // No boosting - use original value
          lerpMorphTarget(target, clamp01(jawValue), 0.50) // Smooth lerp for natural movement
        } else {
          // Moderate lerp for mouth/lip shapes - smooth but responsive
          lerpMorphTarget(target, value, 0.35)
        }
        appliedMorphTargets.push(target)
      })
    } else if (phonemeKey && phonemeKey !== 'silence' && phonemeKey !== 'SILENCE') {
      // Warn if phoneme has no mapping
      if (elapsed < 1.0 && Math.random() < 0.1) {
        console.warn(`⚠️ No mapping for phoneme: '${phonemeKey}'`)
      }
    }
    
    // If audio is playing but we're past phonemes or have silence, keep mouth naturally animated
    // This ensures lip sync continues for the ENTIRE audio duration, not just phoneme duration
    const lastPhoneme = phonemes.length > 0 ? phonemes[phonemes.length - 1] : null
    const isPastPhonemes = lastPhoneme ? elapsed > lastPhoneme.end : false
    
    // Debug: Log when we're past phonemes but audio is still playing
    if (isPastPhonemes && isAudioPlaying && elapsed < audioDuration - 0.1) {
      if (Math.random() < 0.05) { // Log occasionally to avoid spam
        console.log(`🔄 Past phonemes (${lastPhoneme?.end.toFixed(2)}s) but audio still playing (${elapsed.toFixed(2)}s/${audioDuration.toFixed(2)}s) - continuing lip sync`)
      }
    }
    
    // ALWAYS KEEP LIP SYNC ACTIVE while audio is playing
    // This ensures the mouth never stops moving during speech, regardless of phoneme availability
    if (isAudioPlaying && elapsed < audioDuration - 0.1) {
      // If we didn't apply phoneme animation, or we're past phonemes, use animated mouth movement
      if (!appliedPhonemeAnimation || isPastPhonemes || !phonemeKey || phonemeKey === 'silence' || phonemeKey === 'SILENCE') {
        // Calculate animation parameters based on elapsed time
        const timePastPhonemes = lastPhoneme ? Math.max(0, elapsed - lastPhoneme.end) : elapsed
        
        // If we're past phonemes, gradually fade; otherwise use consistent animation
        const fadeFactor = isPastPhonemes ? Math.min(1.0, timePastPhonemes / 4.0) : 0
        
        // Base values - reduced to prevent excessive mouth opening
        const baseJawOpen = isPastPhonemes 
          ? 0.15 * (1 - fadeFactor * 0.5) // Fade from 0.15 to 0.075 when past phonemes
          : 0.12 // Reduced from 0.25 to 0.12 for more natural appearance
        const baseMouthFunnel = isPastPhonemes
          ? 0.20 * (1 - fadeFactor * 0.5) // Fade from 0.20 to 0.10 when past phonemes
          : 0.18 // Reduced from 0.30 to 0.18
        
        // Reduced variation to prevent excessive mouth opening
        // Use multiple sine waves for complex, natural-looking movement
        const fastVariation = Math.sin(elapsed * 2.5) * 0.06 * (1 - fadeFactor * 0.3) // Reduced from 0.15
        const slowVariation = Math.sin(elapsed * 1.2) * 0.04 * (1 - fadeFactor * 0.3) // Reduced from 0.10
        const mediumVariation = Math.sin(elapsed * 3.0) * 0.03 * (1 - fadeFactor * 0.3) // Reduced from 0.08
        const timeVariation = fastVariation + slowVariation + mediumVariation
        
        const jawOpen = baseJawOpen + timeVariation
        const mouthFunnel = baseMouthFunnel + timeVariation * 0.6 // Reduced multiplier from 0.8
        
        // Add more mouth movement for natural appearance
        const mouthSmile = Math.abs(Math.sin(elapsed * 1.8)) * 0.25 * (1 - fadeFactor * 0.4)
        const mouthStretch = Math.abs(Math.sin(elapsed * 2.2)) * 0.18 * (1 - fadeFactor * 0.4)
        const mouthPucker = Math.abs(Math.sin(elapsed * 1.5)) * 0.15 * (1 - fadeFactor * 0.4)
        
        // Apply with fast lerp for responsive, always-active movement
        lerpMorphTarget('jawOpen', clamp01(jawOpen), 0.50)
        lerpMorphTarget('mouthFunnel', clamp01(mouthFunnel), 0.45)
        lerpMorphTarget('mouthSmileLeft', clamp01(mouthSmile), 0.40)
        lerpMorphTarget('mouthSmileRight', clamp01(mouthSmile), 0.40)
        lerpMorphTarget('mouthStretchLeft', clamp01(mouthStretch), 0.40)
        lerpMorphTarget('mouthStretchRight', clamp01(mouthStretch), 0.40)
        lerpMorphTarget('mouthPucker', clamp01(mouthPucker), 0.35)
        appliedMorphTargets.push('jawOpen', 'mouthFunnel', 'mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight', 'mouthPucker')
        
        // Debug: log when keeping lip sync active
        if (Math.random() < 0.01) {
          const reason = isPastPhonemes ? 'past phonemes' : (!phonemeKey ? 'no phoneme' : 'silence')
          console.log(`🔄 KEEPING lip sync active (${reason}): elapsed=${elapsed.toFixed(2)}s/${audioDuration.toFixed(2)}s, jaw=${jawOpen.toFixed(2)}`)
        }
      }
    }

    // Reset all other blendshapes with smooth fade out
    getAllBlendshapeTargets().forEach((target) => {
      if (!appliedMorphTargets.includes(target)) {
        const isJawTarget = target.includes('jaw')
        // Use moderate reset speed for jaw to allow it to move naturally
        const resetSpeed = isJawTarget ? 0.30 : 0.30
        lerpMorphTarget(target, 0, resetSpeed)
      }
    })

    // Apply RICH EMOTIONS (blend with lip sync, don't override mouth)
    const emotionWeights = EMOTION_BLENDSHAPES[emotion] || {}
    Object.entries(emotionWeights).forEach(([target, value]) => {
      // Skip mouth targets if we're actively speaking (lip sync takes priority)
      const isMouthTarget = target.includes('mouth') || target.includes('jaw')
      if (phonemeKey && phonemeKey !== 'silence' && phonemeKey !== 'SILENCE' && isMouthTarget) {
        // Reduce emotion intensity for mouth during speech
        lerpMorphTarget(target, value * 0.3, 0.15)
      } else {
        // Full emotion for non-mouth targets (eyes, brows, etc.)
        lerpMorphTarget(target, value, 0.2)
      }
    })

    // FIXED POSITION - Let Mixamo animations handle all movement
    // NO procedural hovering or movement - animations handle everything
    if (avatarGroupRef.current) {
      // Keep avatar in fixed position - Mixamo animations will handle movement
      avatarGroupRef.current.rotation.x = 0
      avatarGroupRef.current.rotation.z = 0
      avatarGroupRef.current.position.y = -0.85  // Fixed position, no breathing offset
      avatarGroupRef.current.position.x = 0
      avatarGroupRef.current.position.z = 0
    }
    
    // Let Mixamo animations handle all body/arm/finger movement
    // Don't override bone rotations - let the animation system handle it

    // AUTO-BLINK every 2-4 seconds
    const blinkInterval = 3000 + Math.sin(elapsed) * 1000
    if (Math.floor(elapsed * 1000) % blinkInterval < 200) {
      lerpMorphTarget('eyeBlinkLeft', 1.0, 0.4)
      lerpMorphTarget('eyeBlinkRight', 1.0, 0.4)
    } else {
      lerpMorphTarget('eyeBlinkLeft', 0.0, 0.3)
      lerpMorphTarget('eyeBlinkRight', 0.0, 0.3)
    }

    // DEBUG logging (first 2 seconds)
    if (elapsed < 2.0 && Math.random() < 0.1) {
      if (phonemeKey && phonemeMapping) {
        console.log(`👄 Phoneme '${phonemeKey}' at ${elapsed.toFixed(2)}s`)
      }
    }
  })

  return (
    <group ref={avatarGroupRef} position={[0, -0.85, 0]} rotation={[0, 0, 0]}>
      <primitive object={scene} />
    </group>
  )
}
