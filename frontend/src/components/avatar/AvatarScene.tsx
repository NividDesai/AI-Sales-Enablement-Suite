import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Suspense } from 'react'
import Avatar from './Avatar'

interface AvatarSceneProps {
  avatarUrl?: string
  phonemes?: Array<{ start: number; end: number; value: string }>
  audioUrl?: string
  emotion?: string
}

export default function AvatarScene({ avatarUrl, phonemes, audioUrl, emotion }: AvatarSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 2.8], fov: 50 }}
      style={{
        background: 'radial-gradient(circle at center, #4a5568 0%, #1a202c 100%)',
        width: '100%',
        height: '100%',
      }}
    >
      {/* Studio lighting */}
      <ambientLight intensity={1.0} />
      <directionalLight position={[5, 8, 5]} intensity={1.8} />
      <directionalLight position={[-5, 5, -5]} intensity={1.2} />
      <directionalLight position={[0, -3, 5]} intensity={0.8} />
      <pointLight position={[0, 2, 3]} intensity={0.5} />

      {/* Avatar */}
      <Suspense
        fallback={
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="yellow" emissive="yellow" emissiveIntensity={0.5} />
          </mesh>
        }
      >
        {avatarUrl ? (
          <Avatar url={avatarUrl} phonemes={phonemes || []} emotion={emotion || 'neutral'} audioUrl={audioUrl} />
        ) : (
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="blue" emissive="blue" emissiveIntensity={0.3} />
          </mesh>
        )}
      </Suspense>

      {/* Camera controls */}
      <OrbitControls
        target={[0, 0.3, 0]}
        minDistance={2.0}
        maxDistance={4}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.8}
        enablePan={false}
      />
    </Canvas>
  )
}

