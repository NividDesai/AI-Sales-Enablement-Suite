import { useState, useRef, useEffect } from 'react'

type ElementData = {
  id: string
  type: 'text' | 'image' | 'video' | 'heading' | 'button'
  content: string
  x: number
  y: number
  width: number
  height: number
  fontSize?: number
  fontWeight?: string
  color?: string
  backgroundColor?: string
  borderRadius?: number
  zIndex: number
}

type VisualEditorProps = {
  initialHtml: string
  onChange: (html: string) => void
}

export default function VisualEditor({ initialHtml, onChange }: VisualEditorProps) {
  const [elements, setElements] = useState<ElementData[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [mode, setMode] = useState<'select' | 'text' | 'image' | 'video'>('select')
  const canvasRef = useRef<HTMLDivElement>(null)

  // Parse initial HTML into editable elements - only once on mount
  useEffect(() => {
    if (!initialHtml || elements.length > 0) return
    
    const parser = new DOMParser()
    const doc = parser.parseFromString(initialHtml, 'text/html')
    const parsed: ElementData[] = []
    let yOffset = 50
    
    // Extract text elements with better spacing
    doc.querySelectorAll('h1, h2, h3, p, div').forEach((el, idx) => {
      const text = el.textContent?.trim()
      if (text && text.length > 0 && text.length < 1000) {
        const tagName = el.tagName.toLowerCase()
        const isHeading = tagName.startsWith('h')
        const height = isHeading ? 50 : Math.min(100, Math.ceil(text.length / 80) * 30)
        
        parsed.push({
          id: `el-${idx}-${Date.now()}`,
          type: isHeading ? 'heading' : 'text',
          content: text,
          x: 50,
          y: yOffset,
          width: 700,
          height: height,
          fontSize: tagName === 'h1' ? 32 : tagName === 'h2' ? 24 : tagName === 'h3' ? 20 : 16,
          fontWeight: isHeading ? 'bold' : 'normal',
          color: '#111',
          zIndex: idx,
        })
        
        yOffset += height + 20
      }
    })

    // Extract images with better positioning
    doc.querySelectorAll('img').forEach((img, idx) => {
      const src = img.getAttribute('src')
      if (src) {
        parsed.push({
          id: `img-${idx}-${Date.now()}`,
          type: 'image',
          content: src,
          x: 50,
          y: yOffset,
          width: 500,
          height: 300,
          zIndex: parsed.length + idx,
        })
        yOffset += 320
      }
    })

    setElements(parsed)
  }, [initialHtml, elements.length])

  // Generate HTML from elements
  const generateHtml = () => {
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex)
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; }
      .canvas { position: relative; width: 900px; min-height: 1200px; margin: 0 auto; background: white; }
      .element { position: absolute; }
      .text-element { white-space: pre-wrap; word-wrap: break-word; }
      .image-element { object-fit: cover; }
    </style></head><body><div class="canvas">`
    
    sorted.forEach(el => {
      const style = `left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex};${el.fontSize ? `font-size:${el.fontSize}px;` : ''}${el.fontWeight ? `font-weight:${el.fontWeight};` : ''}${el.color ? `color:${el.color};` : ''}${el.backgroundColor ? `background-color:${el.backgroundColor};` : ''}${el.borderRadius ? `border-radius:${el.borderRadius}px;` : ''}`
      
      if (el.type === 'image') {
        html += `<img class="element image-element" src="${el.content}" style="${style}" alt=""/>`
      } else if (el.type === 'video') {
        html += `<video class="element" src="${el.content}" controls style="${style}"></video>`
      } else if (el.type === 'button') {
        html += `<button class="element" style="${style};cursor:pointer;border:none;padding:12px 24px;">${el.content}</button>`
      } else {
        const tag = el.type === 'heading' ? 'h2' : 'div'
        html += `<${tag} class="element text-element" style="${style}">${el.content}</${tag}>`
      }
    })
    
    html += `</div></body></html>`
    return html
  }

  useEffect(() => {
    if (elements.length > 0) {
      // Debounce onChange to prevent excessive updates
      const timer = setTimeout(() => {
        onChange(generateHtml())
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [elements])

  const handleMouseDown = (e: React.MouseEvent, id: string, isResize = false) => {
    e.stopPropagation()
    setSelectedId(id)
    if (isResize) {
      setIsResizing(true)
    } else {
      setIsDragging(true)
    }
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectedId) return
    
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    
    if (isDragging) {
      setElements(prev => prev.map(el => 
        el.id === selectedId 
          ? { ...el, x: Math.max(0, el.x + dx), y: Math.max(0, el.y + dy) }
          : el
      ))
      setDragStart({ x: e.clientX, y: e.clientY })
    } else if (isResizing) {
      setElements(prev => prev.map(el => 
        el.id === selectedId 
          ? { ...el, width: Math.max(50, el.width + dx), height: Math.max(20, el.height + dy) }
          : el
      ))
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (mode === 'select') {
      setSelectedId(null)
      return
    }

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const newElement: ElementData = {
      id: `el-${Date.now()}`,
      type: mode === 'text' ? 'text' : mode === 'image' ? 'image' : 'video',
      content: mode === 'text' ? 'Double-click to edit' : mode === 'image' ? 'https://via.placeholder.com/400x200' : 'https://www.w3schools.com/html/mov_bbb.mp4',
      x,
      y,
      width: mode === 'text' ? 300 : 400,
      height: mode === 'text' ? 40 : 200,
      fontSize: 16,
      color: '#111',
      zIndex: elements.length,
    }

    setElements(prev => [...prev, newElement])
    setSelectedId(newElement.id)
    setMode('select')
  }

  const updateElement = (id: string, updates: Partial<ElementData>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el))
  }

  const deleteElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id))
    setSelectedId(null)
  }

  const bringToFront = (id: string) => {
    const maxZ = Math.max(...elements.map(el => el.zIndex))
    setElements(prev => prev.map(el => el.id === id ? { ...el, zIndex: maxZ + 1 } : el))
  }

  const sendToBack = (id: string) => {
    const minZ = Math.min(...elements.map(el => el.zIndex))
    setElements(prev => prev.map(el => el.id === id ? { ...el, zIndex: minZ - 1 } : el))
  }

  const selectedElement = elements.find(el => el.id === selectedId)

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      {/* Toolbar */}
      <div style={{ width: 200, padding: 12, background: '#f8f9fa', borderRadius: 8, border: '1px solid #dee2e6' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Tools</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button 
            onClick={() => setMode('select')} 
            style={{ padding: '8px 12px', background: mode === 'select' ? '#0d6efd' : 'white', color: mode === 'select' ? 'white' : '#111', border: '1px solid #dee2e6', borderRadius: 6, cursor: 'pointer' }}
          >
            ✋ Select
          </button>
          <button 
            onClick={() => setMode('text')} 
            style={{ padding: '8px 12px', background: mode === 'text' ? '#0d6efd' : 'white', color: mode === 'text' ? 'white' : '#111', border: '1px solid #dee2e6', borderRadius: 6, cursor: 'pointer' }}
          >
            📝 Add Text
          </button>
          <button 
            onClick={() => setMode('image')} 
            style={{ padding: '8px 12px', background: mode === 'image' ? '#0d6efd' : 'white', color: mode === 'image' ? 'white' : '#111', border: '1px solid #dee2e6', borderRadius: 6, cursor: 'pointer' }}
          >
            🖼️ Add Image
          </button>
          <button 
            onClick={() => setMode('video')} 
            style={{ padding: '8px 12px', background: mode === 'video' ? '#0d6efd' : 'white', color: mode === 'video' ? 'white' : '#111', border: '1px solid #dee2e6', borderRadius: 6, cursor: 'pointer' }}
          >
            🎥 Add Video
          </button>
        </div>

        {selectedElement && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #dee2e6' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Properties</h3>
            
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Content</label>
            {selectedElement.type === 'image' || selectedElement.type === 'video' ? (
              <input 
                type="text" 
                value={selectedElement.content} 
                onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                placeholder="URL"
                style={{ width: '100%', padding: 6, marginBottom: 8, border: '1px solid #dee2e6', borderRadius: 4 }}
              />
            ) : (
              <textarea 
                value={selectedElement.content} 
                onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                rows={3}
                style={{ width: '100%', padding: 6, marginBottom: 8, border: '1px solid #dee2e6', borderRadius: 4 }}
              />
            )}

            {(selectedElement.type === 'text' || selectedElement.type === 'heading') && (
              <>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Font Size</label>
                <input 
                  type="number" 
                  value={selectedElement.fontSize || 16} 
                  onChange={(e) => updateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                  style={{ width: '100%', padding: 6, marginBottom: 8, border: '1px solid #dee2e6', borderRadius: 4 }}
                />

                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Color</label>
                <input 
                  type="color" 
                  value={selectedElement.color || '#111111'} 
                  onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                  style={{ width: '100%', padding: 6, marginBottom: 8, border: '1px solid #dee2e6', borderRadius: 4 }}
                />

                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Weight</label>
                <select 
                  value={selectedElement.fontWeight || 'normal'} 
                  onChange={(e) => updateElement(selectedElement.id, { fontWeight: e.target.value })}
                  style={{ width: '100%', padding: 6, marginBottom: 8, border: '1px solid #dee2e6', borderRadius: 4 }}
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="600">Semi-bold</option>
                </select>
              </>
            )}

            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Background</label>
            <input 
              type="color" 
              value={selectedElement.backgroundColor || '#ffffff'} 
              onChange={(e) => updateElement(selectedElement.id, { backgroundColor: e.target.value })}
              style={{ width: '100%', padding: 6, marginBottom: 8, border: '1px solid #dee2e6', borderRadius: 4 }}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => bringToFront(selectedElement.id)} style={{ flex: 1, padding: 6, fontSize: 11, border: '1px solid #dee2e6', borderRadius: 4, cursor: 'pointer' }}>⬆️ Front</button>
              <button onClick={() => sendToBack(selectedElement.id)} style={{ flex: 1, padding: 6, fontSize: 11, border: '1px solid #dee2e6', borderRadius: 4, cursor: 'pointer' }}>⬇️ Back</button>
            </div>

            <button 
              onClick={() => deleteElement(selectedElement.id)} 
              style={{ width: '100%', marginTop: 8, padding: 8, background: '#dc3545', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              🗑️ Delete
            </button>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div 
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ 
          flex: 1, 
          position: 'relative', 
          background: 'white', 
          border: '2px solid #dee2e6', 
          borderRadius: 8,
          minHeight: 1000,
          maxHeight: 1200,
          cursor: mode === 'select' ? 'default' : 'crosshair',
          overflow: 'auto'
        }}
      >
        {elements.map(el => (
          <div
            key={el.id}
            onMouseDown={(e) => mode === 'select' && handleMouseDown(e, el.id)}
            onDoubleClick={() => setSelectedId(el.id)}
            style={{
              position: 'absolute',
              left: el.x,
              top: el.y,
              width: el.width,
              height: el.height,
              zIndex: el.zIndex,
              border: selectedId === el.id ? '2px solid #0d6efd' : '1px solid transparent',
              cursor: mode === 'select' ? 'move' : 'default',
              fontSize: el.fontSize,
              fontWeight: el.fontWeight,
              color: el.color,
              backgroundColor: el.backgroundColor,
              borderRadius: el.borderRadius,
              padding: (el.type === 'text' || el.type === 'heading') ? 8 : 0,
              overflow: 'hidden',
              whiteSpace: (el.type === 'text' || el.type === 'heading') ? 'pre-wrap' : 'normal',
              wordWrap: 'break-word',
            }}
          >
            {el.type === 'image' ? (
              <img src={el.content} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : el.type === 'video' ? (
              <video src={el.content} controls style={{ width: '100%', height: '100%' }} />
            ) : (
              el.content
            )}

            {selectedId === el.id && mode === 'select' && (
              <div
                onMouseDown={(e) => handleMouseDown(e, el.id, true)}
                style={{
                  position: 'absolute',
                  right: -4,
                  bottom: -4,
                  width: 12,
                  height: 12,
                  background: '#0d6efd',
                  border: '2px solid white',
                  borderRadius: '50%',
                  cursor: 'nwse-resize',
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
