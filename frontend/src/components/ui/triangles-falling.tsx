// Placeholder file - component removed
// This file exists to prevent Tailwind CSS errors during build
import React from 'react'

interface TrianglesProps {
  total?: number
  className?: string
}

export default function Triangles({ total = 200, className = '' }: TrianglesProps) {
  return (
    <div className={`absolute inset-0 ${className}`}>
      <div className="absolute inset-0 bg-black/20" />
    </div>
  )
}

