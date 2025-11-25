import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass'

gsap.registerPlugin(ScrollTrigger)

interface HorizonHeroSectionProps {
  title?: string
  subtitle?: {
    line1: string
    line2: string
  }
  className?: string
}

export const HorizonHeroSection = ({
  title = "LEADFORGE",
  subtitle = {
    line1: "Where AI meets lead generation,",
    line2: "we transform prospects into customers"
  },
  className
}: HorizonHeroSectionProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLDivElement>(null)
  const scrollProgressRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const smoothCameraPos = useRef({ x: 0, y: 30, z: 100 })
  const cameraVelocity = useRef({ x: 0, y: 0, z: 0 })

  const [scrollProgress, setScrollProgress] = useState(0)
  const [currentSection, setCurrentSection] = useState(1)
  const [isReady, setIsReady] = useState(false)
  const totalSections = 2

  const threeRefs = useRef<{
    scene: THREE.Scene | null
    camera: THREE.PerspectiveCamera | null
    renderer: THREE.WebGLRenderer | null
    composer: EffectComposer | null
    stars: THREE.Points[]
    nebula: THREE.Mesh | null
    mountains: THREE.Mesh[]
    animationId: number | null
    targetCameraX?: number
    targetCameraY?: number
    targetCameraZ?: number
    locations?: number[]
  }>({
    scene: null,
    camera: null,
    renderer: null,
    composer: null,
    stars: [],
    nebula: null,
    mountains: [],
    animationId: null
  })

  // Initialize Three.js
  useEffect(() => {
    const initThree = () => {
      const { current: refs } = threeRefs

      if (!canvasRef.current) {
        setIsReady(true)
        return
      }

      // Scene setup
      refs.scene = new THREE.Scene()
      refs.scene.fog = new THREE.FogExp2(0x000000, 0.00025)

      // Camera
      refs.camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
      )
      refs.camera.position.z = 100
      refs.camera.position.y = 20

      // Renderer
      try {
        refs.renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          antialias: true,
          alpha: true
        })
        refs.renderer.setSize(window.innerWidth, window.innerHeight)
        refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        refs.renderer.toneMapping = THREE.ACESFilmicToneMapping
        refs.renderer.toneMappingExposure = 0.5
      } catch (error) {
        console.error('Error creating renderer:', error)
        setIsReady(true)
        return
      }

      // Post-processing
      try {
        refs.composer = new EffectComposer(refs.renderer)
        const renderPass = new RenderPass(refs.scene, refs.camera)
        refs.composer.addPass(renderPass)
        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          0.8,
          0.4,
          0.85
        )
        refs.composer.addPass(bloomPass)
      } catch (error) {
        console.error('Error setting up post-processing:', error)
      }

      // Create scene elements
      createStarField()
      createNebula()
      createMountains()
      createAtmosphere()
      getLocation()

      // Start animation
      animate()

      // Mark as ready after Three.js is initialized
      setIsReady(true)
    }

    const createStarField = () => {
      const { current: refs } = threeRefs
      if (!refs.scene) return

      const starCount = 5000

      for (let i = 0; i < 3; i++) {
        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array(starCount * 3)
        const colors = new Float32Array(starCount * 3)
        const sizes = new Float32Array(starCount)

        for (let j = 0; j < starCount; j++) {
          const radius = 200 + Math.random() * 800
          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(Math.random() * 2 - 1)
          positions[j * 3] = radius * Math.sin(phi) * Math.cos(theta)
          positions[j * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
          positions[j * 3 + 2] = radius * Math.cos(phi)

          // Color variation
          const color = new THREE.Color()
          const colorChoice = Math.random()
          if (colorChoice < 0.7) {
            color.setHSL(0, 0, 0.8 + Math.random() * 0.2)
          } else if (colorChoice < 0.9) {
            color.setHSL(0.08, 0.5, 0.8)
          } else {
            color.setHSL(0.6, 0.5, 0.8)
          }

          colors[j * 3] = color.r
          colors[j * 3 + 1] = color.g
          colors[j * 3 + 2] = color.b
          sizes[j] = Math.random() * 2 + 0.5
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

        const material = new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0 },
            depth: { value: i }
          },
          vertexShader: `
            precision mediump float;
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            uniform float time;
            uniform float depth;

            void main() {
              vColor = color;
              vec3 pos = position;

              // Slow rotation based on depth
              float angle = time * 0.05 * (1.0 - depth * 0.3);
              mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
              pos.xy = rot * pos.xy;

              vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
              float zDepth = -mvPosition.z;
              if (zDepth < 0.1) {
                zDepth = 0.1;
              }
              float pointSize = size * (300.0 / zDepth);
              if (pointSize > 100.0) {
                pointSize = 100.0;
              }
              if (pointSize < 1.0) {
                pointSize = 1.0;
              }
              gl_PointSize = pointSize;
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
          fragmentShader: `
            precision mediump float;
            varying vec3 vColor;

            void main() {
              float dist = length(gl_PointCoord - vec2(0.5));
              if (dist > 0.5) discard;

              float opacity = 1.0 - smoothstep(0.0, 0.5, dist);
              gl_FragColor = vec4(vColor, opacity);
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })

        const stars = new THREE.Points(geometry, material)
        refs.scene.add(stars)
        refs.stars.push(stars)
      }
    }

    const createNebula = () => {
      const { current: refs } = threeRefs
      if (!refs.scene) return

      const geometry = new THREE.PlaneGeometry(8000, 4000, 100, 100)
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color1: { value: new THREE.Color(0x0033ff) },
          color2: { value: new THREE.Color(0xff0066) },
          opacity: { value: 0.3 }
        },
        vertexShader: `
          precision mediump float;
          varying vec2 vUv;
          varying float vElevation;
          uniform float time;

          void main() {
            vUv = uv;
            vec3 pos = position;

            float elevation = sin(pos.x * 0.01 + time) * cos(pos.y * 0.01 + time) * 20.0;
            pos.z += elevation;
            vElevation = elevation;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          precision mediump float;
          uniform vec3 color1;
          uniform vec3 color2;
          uniform float opacity;
          uniform float time;
          varying vec2 vUv;
          varying float vElevation;

          void main() {
            float mixFactor = sin(vUv.x * 10.0 + time) * cos(vUv.y * 10.0 + time);
            vec3 color = mix(color1, color2, mixFactor * 0.5 + 0.5);

            float alpha = opacity * (1.0 - length(vUv - 0.5) * 2.0);
            alpha *= 1.0 + vElevation * 0.01;

            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      })

      const nebula = new THREE.Mesh(geometry, material)
      nebula.position.z = -1050
      nebula.rotation.x = 0
      refs.scene.add(nebula)
      refs.nebula = nebula
    }

    const createMountains = () => {
      const { current: refs } = threeRefs
      if (!refs.scene) return

      const layers = [
        { distance: -50, height: 60, color: 0x1a1a2e, opacity: 1 },
        { distance: -100, height: 80, color: 0x16213e, opacity: 0.8 },
        { distance: -150, height: 100, color: 0x0f3460, opacity: 0.6 },
        { distance: -200, height: 120, color: 0x0a4668, opacity: 0.4 }
      ]

      layers.forEach((layer) => {
        const points: THREE.Vector2[] = []
        const segments = 50

        for (let i = 0; i <= segments; i++) {
          const x = (i / segments - 0.5) * 1000
          const y = Math.sin(i * 0.1) * layer.height +
                   Math.sin(i * 0.05) * layer.height * 0.5 +
                   Math.random() * layer.height * 0.2 - 100
          points.push(new THREE.Vector2(x, y))
        }

        points.push(new THREE.Vector2(5000, -300))
        points.push(new THREE.Vector2(-5000, -300))
        const shape = new THREE.Shape(points)
        const geometry = new THREE.ShapeGeometry(shape)
        const material = new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          side: THREE.DoubleSide
        })

        const mountain = new THREE.Mesh(geometry, material)
        mountain.position.z = layer.distance
        mountain.position.y = layer.distance
        mountain.userData = { baseZ: layer.distance }
        refs.scene.add(mountain)
        refs.mountains.push(mountain)
      })
    }

    const createAtmosphere = () => {
      const { current: refs } = threeRefs
      if (!refs.scene) return

      const geometry = new THREE.SphereGeometry(600, 32, 32)
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 }
        },
        vertexShader: `
          precision mediump float;
          varying vec3 vNormal;
          varying vec3 vPosition;

          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision mediump float;
          varying vec3 vNormal;
          varying vec3 vPosition;
          uniform float time;

          void main() {
            float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            vec3 atmosphere = vec3(0.3, 0.6, 1.0) * intensity;

            float pulse = sin(time * 2.0) * 0.1 + 0.9;
            atmosphere *= pulse;

            gl_FragColor = vec4(atmosphere, intensity * 0.25);
          }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true
      })

      const atmosphere = new THREE.Mesh(geometry, material)
      refs.scene.add(atmosphere)
    }

    const animate = () => {
      const { current: refs } = threeRefs
      refs.animationId = requestAnimationFrame(animate)

      const time = Date.now() * 0.001

      // Update stars
      refs.stars.forEach((starField) => {
        if (starField.material instanceof THREE.ShaderMaterial && starField.material.uniforms) {
          starField.material.uniforms.time.value = time
        }
      })

      // Update nebula
      if (refs.nebula && refs.nebula.material instanceof THREE.ShaderMaterial && refs.nebula.material.uniforms) {
        refs.nebula.material.uniforms.time.value = time * 0.5
      }

      // Smooth camera movement with easing
      if (refs.camera && refs.targetCameraX !== undefined) {
        const smoothingFactor = 0.05

        // Calculate smooth position with easing
        smoothCameraPos.current.x += (refs.targetCameraX - smoothCameraPos.current.x) * smoothingFactor
        smoothCameraPos.current.y += (refs.targetCameraY! - smoothCameraPos.current.y) * smoothingFactor
        smoothCameraPos.current.z += (refs.targetCameraZ! - smoothCameraPos.current.z) * smoothingFactor

        // Add subtle floating motion
        const floatX = Math.sin(time * 0.1) * 2
        const floatY = Math.cos(time * 0.15) * 1

        // Apply final position
        refs.camera.position.x = smoothCameraPos.current.x + floatX
        refs.camera.position.y = smoothCameraPos.current.y + floatY
        refs.camera.position.z = smoothCameraPos.current.z
        refs.camera.lookAt(0, 10, -600)
      } else {
        // Default camera position if targets not set
        const floatX = Math.sin(time * 0.1) * 2
        const floatY = Math.cos(time * 0.15) * 1
        refs.camera.position.x = floatX
        refs.camera.position.y = 20 + floatY
        refs.camera.position.z = 100
        refs.camera.lookAt(0, 10, -600)
      }

      // Parallax mountains with subtle animation
      refs.mountains.forEach((mountain) => {
        const parallaxFactor = 1
        mountain.position.x = Math.sin(time * 0.1) * 2 * parallaxFactor
        mountain.position.y = 50 + (Math.cos(time * 0.15) * 1 * parallaxFactor)
      })

      if (refs.composer) {
        refs.composer.render()
      } else if (refs.renderer && refs.scene && refs.camera) {
        refs.renderer.render(refs.scene, refs.camera)
      }
    }

    const getLocation = () => {
      const { current: refs } = threeRefs
      const locations: number[] = []
      refs.mountains.forEach((mountain) => {
        locations.push(mountain.position.z)
      })
      refs.locations = locations
    }

    initThree()

    // Handle resize
    const handleResize = () => {
      const { current: refs } = threeRefs
      if (refs.camera && refs.renderer && refs.composer) {
        refs.camera.aspect = window.innerWidth / window.innerHeight
        refs.camera.updateProjectionMatrix()
        refs.renderer.setSize(window.innerWidth, window.innerHeight)
        refs.composer.setSize(window.innerWidth, window.innerHeight)
      }
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      const { current: refs } = threeRefs

      if (refs.animationId) {
        cancelAnimationFrame(refs.animationId)
      }
      window.removeEventListener('resize', handleResize)

      // Dispose Three.js resources
      refs.stars.forEach(starField => {
        starField.geometry.dispose()
        if (starField.material instanceof THREE.Material) {
          starField.material.dispose()
        }
      })

      refs.mountains.forEach(mountain => {
        mountain.geometry.dispose()
        if (mountain.material instanceof THREE.Material) {
          mountain.material.dispose()
        }
      })

      if (refs.nebula) {
        refs.nebula.geometry.dispose()
        if (refs.nebula.material instanceof THREE.Material) {
          refs.nebula.material.dispose()
        }
      }

      if (refs.renderer) {
        refs.renderer.dispose()
      }
    }
  }, [])

  // GSAP Animations - Run after component is ready
  useEffect(() => {
    if (!isReady) return

    // Set initial states to prevent flash
    const elements = [menuRef.current, titleRef.current, subtitleRef.current, scrollProgressRef.current].filter(Boolean) as HTMLElement[]
    gsap.set(elements, {
      visibility: 'visible'
    })

    const tl = gsap.timeline()

    // Animate menu
    if (menuRef.current) {
      tl.from(menuRef.current, {
        x: -100,
        opacity: 0,
        duration: 1,
        ease: "power3.out"
      })
    }

    // Animate title with split text
    if (titleRef.current) {
      const titleChars = titleRef.current.querySelectorAll('.title-char')
      tl.from(titleChars, {
        y: 200,
        opacity: 0,
        duration: 1.5,
        stagger: 0.05,
        ease: "power4.out"
      }, "-=0.5")
    }

    // Animate subtitle lines
    if (subtitleRef.current) {
      const subtitleLines = subtitleRef.current.querySelectorAll('.subtitle-line')
      tl.from(subtitleLines, {
        y: 50,
        opacity: 0,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out"
      }, "-=0.8")
    }

    // Animate scroll indicator
    if (scrollProgressRef.current) {
      tl.from(scrollProgressRef.current, {
        opacity: 0,
        y: 50,
        duration: 1,
        ease: "power2.out"
      }, "-=0.5")
    }

    return () => {
      tl.kill()
    }
  }, [isReady])

  // Scroll handling
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const maxScroll = documentHeight - windowHeight
      const progress = Math.min(scrollY / maxScroll, 1)

      setScrollProgress(progress)
      const newSection = Math.floor(progress * totalSections)
      setCurrentSection(newSection)

      const { current: refs } = threeRefs

      // Calculate smooth progress through all sections
      const totalProgress = progress * totalSections
      const sectionProgress = totalProgress % 1

      // Define camera positions for each section
      const cameraPositions = [
        { x: 0, y: 30, z: 300 },    // Section 0 - HORIZON
        { x: 0, y: 40, z: -50 },     // Section 1 - COSMOS
        { x: 0, y: 50, z: -700 }       // Section 2 - INFINITY
      ]

      // Get current and next positions
      const currentPos = cameraPositions[newSection] || cameraPositions[0]
      const nextPos = cameraPositions[newSection + 1] || currentPos

      // Set target positions (actual smoothing happens in animate loop)
      refs.targetCameraX = currentPos.x + (nextPos.x - currentPos.x) * sectionProgress
      refs.targetCameraY = currentPos.y + (nextPos.y - currentPos.y) * sectionProgress
      refs.targetCameraZ = currentPos.z + (nextPos.z - currentPos.z) * sectionProgress

      // Smooth parallax for mountains
      refs.mountains.forEach((mountain, i) => {
        const speed = 1 + i * 0.9
        const targetZ = (mountain.userData as any).baseZ + scrollY * speed * 0.5

        if (refs.nebula) {
          refs.nebula.position.z = (targetZ + progress * speed * 0.01) - 100
        }

        // Use the same smoothing approach
        ;(mountain.userData as any).targetZ = targetZ
        const location = mountain.position.z

        if (progress > 0.7) {
          mountain.position.z = 600000
        }
        if (progress < 0.7 && refs.locations) {
          mountain.position.z = refs.locations[i]
        }
      })

      if (refs.nebula && refs.mountains.length > 3) {
        refs.nebula.position.z = refs.mountains[3].position.z
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Set initial position

    return () => window.removeEventListener('scroll', handleScroll)
  }, [totalSections])

  const splitTitle = (text: string) => {
    return text.split('').map((char, i) => (
      <span key={i} className="title-char">
        {char === ' ' ? '\u00A0' : char}
      </span>
    ))
  }

  return (
    <div ref={containerRef} className={`hero-container cosmos-style ${className || ''}`}>
      <canvas ref={canvasRef} className="hero-canvas" />

      {/* Side menu */}
      <div ref={menuRef} className="side-menu" style={{ visibility: 'hidden' }}>
        <div className="menu-icon">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="vertical-text">LEADS</div>
      </div>

      {/* Main content */}
      <div className="hero-content cosmos-content">
        <h1 ref={titleRef} className="hero-title">
          {splitTitle(title)}
        </h1>

        <div ref={subtitleRef} className="hero-subtitle cosmos-subtitle">
          <p className="subtitle-line">
            {subtitle.line1}
          </p>
          <p className="subtitle-line">
            {subtitle.line2}
          </p>
        </div>
      </div>

      {/* Scroll progress indicator */}
      <div ref={scrollProgressRef} className="scroll-progress" style={{ visibility: 'hidden' }}>
        <div className="scroll-text">SCROLL</div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${scrollProgress * 100}%` }}
          />
        </div>
        <div className="section-counter">
          {String(currentSection).padStart(2, '0')} / {String(totalSections).padStart(2, '0')}
        </div>
      </div>

      {/* Additional sections for scrolling */}
      <div className="scroll-sections">
        {[...Array(2)].map((_, i) => {
          const titles: Record<number, string> = {
            0: 'LEADFORGE',
            1: 'DISCOVER',
            2: 'CONVERT'
          }

          const subtitles: Record<number, { line1: string; line2: string }> = {
            0: {
              line1: 'Where AI meets lead generation,',
              line2: 'we transform prospects into customers'
            },
            1: {
              line1: 'Beyond traditional prospecting,',
              line2: 'lies the future of sales automation'
            },
            2: {
              line1: 'In the space between discovery and conversion,',
              line2: 'we find the essence of true growth'
            }
          }

          return (
            <section key={i} className="content-section">
              <h1 className="hero-title">
                {titles[i + 1] || 'DEFAULT'}
              </h1>

              <div className="hero-subtitle cosmos-subtitle">
                <p className="subtitle-line">
                  {subtitles[i + 1]?.line1}
                </p>
                <p className="subtitle-line">
                  {subtitles[i + 1]?.line2}
                </p>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

