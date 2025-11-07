/**
 * PDF Text Area Designer - Canva Style
 * Define a rectangle and auto-fit text with proper PDF coordinates
 */

'use client'

import { useState, useRef, useEffect } from 'react'

export default function AdjustPdfPage() {
  const [name, setName] = useState('John Doe')
  const [maxFontSize, setMaxFontSize] = useState(45)
  const [calculatedFontSize, setCalculatedFontSize] = useState(45)
  const [useCustomFont, setUseCustomFont] = useState(true)
  const [color, setColor] = useState('#000000')
  const [showDebug, setShowDebug] = useState(true)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)

  // Rectangle boundary in PDF points (easier to work with)
  const [rectPdfPoints, setRectPdfPoints] = useState({
    x: 236, // Calibrated position for name placement
    y: 260, // Calibrated bottom position in PDF coordinates
    width: 468, // 50% of 936
    height: 130 // 20% of 648
  })

  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [canvasScale, setCanvasScale] = useState(1)

  const canvasRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const rectRef = useRef<HTMLDivElement>(null)

  // Actual PDF dimensions (checked from Atlassian_Template_v1.pdf)
  const PDF_WIDTH = 936
  const PDF_HEIGHT = 648

  // Convert PDF points to percentage for display
  const getRectPercentage = () => {
    return {
      x: (rectPdfPoints.x / PDF_WIDTH) * 100,
      y: ((PDF_HEIGHT - rectPdfPoints.y - rectPdfPoints.height) / PDF_HEIGHT) * 100, // Convert from bottom to top
      width: (rectPdfPoints.width / PDF_WIDTH) * 100,
      height: (rectPdfPoints.height / PDF_HEIGHT) * 100,
    }
  }

  // Auto-calculate font size to fit text within rectangle
  useEffect(() => {
    if (!textRef.current || !rectRef.current) return

    const rectElement = rectRef.current
    const rectRect = rectElement.getBoundingClientRect()

    let testFontSize = maxFontSize
    const minFontSize = 8

    // Create a temporary element to measure text
    const tempDiv = document.createElement('div')
    tempDiv.style.position = 'absolute'
    tempDiv.style.visibility = 'hidden'
    tempDiv.style.whiteSpace = 'nowrap'
    tempDiv.style.fontFamily = useCustomFont ? 'CharlieDisplay, system-ui' : 'Helvetica, Arial'
    tempDiv.textContent = name || 'Text'
    document.body.appendChild(tempDiv)

    // Find the largest font size that fits
    while (testFontSize > minFontSize) {
      tempDiv.style.fontSize = `${testFontSize * canvasScale}px`
      const textWidth = tempDiv.offsetWidth
      const textHeight = tempDiv.offsetHeight

      // Use 95% of width and 90% of height for safety margin
      if (textWidth <= rectRect.width * 0.95 && textHeight <= rectRect.height * 0.9) {
        break
      }

      testFontSize -= 0.5
    }

    document.body.removeChild(tempDiv)
    setCalculatedFontSize(Math.max(minFontSize, testFontSize))
  }, [name, rectPdfPoints, maxFontSize, canvasScale, useCustomFont])

  // Handle mouse down on rectangle
  const handleRectMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)

    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return

    setDragStart({
      x: e.clientX,
      y: e.clientY,
    })
  }

  // Handle resize
  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>, corner: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(corner)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
    })
  }

  // Calculate canvas scale
  useEffect(() => {
    const updateScale = () => {
      if (canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect()
        const scale = canvasRect.width / PDF_WIDTH
        setCanvasScale(scale)
      }
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  // Handle mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return

      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y
      const deltaPdfX = deltaX / canvasScale
      const deltaPdfY = -deltaY / canvasScale // Invert Y for PDF coordinates

      if (isDragging) {
        setRectPdfPoints((prev) => {
          const newX = Math.max(0, Math.min(PDF_WIDTH - prev.width, prev.x + deltaPdfX))
          const newY = Math.max(0, Math.min(PDF_HEIGHT - prev.height, prev.y + deltaPdfY))
          return { ...prev, x: newX, y: newY }
        })
        setDragStart({ x: e.clientX, y: e.clientY })
      } else if (isResizing) {
        setRectPdfPoints((prev) => {
          let newRect = { ...prev }

          if (isResizing === 'se') {
            newRect.width = Math.max(50, Math.min(PDF_WIDTH - prev.x, prev.width + deltaPdfX))
            newRect.height = Math.max(30, Math.min(PDF_HEIGHT - prev.y, prev.height - deltaPdfY))
          } else if (isResizing === 'sw') {
            const newX = Math.max(0, Math.min(prev.x + prev.width - 50, prev.x + deltaPdfX))
            newRect.x = newX
            newRect.width = prev.x + prev.width - newX
            newRect.height = Math.max(30, Math.min(PDF_HEIGHT - prev.y, prev.height - deltaPdfY))
          } else if (isResizing === 'ne') {
            newRect.width = Math.max(50, Math.min(PDF_WIDTH - prev.x, prev.width + deltaPdfX))
            const newY = Math.max(0, Math.min(prev.y + prev.height - 30, prev.y + deltaPdfY))
            newRect.y = newY
            newRect.height = prev.y + prev.height - newY
          } else if (isResizing === 'nw') {
            const newX = Math.max(0, Math.min(prev.x + prev.width - 50, prev.x + deltaPdfX))
            newRect.x = newX
            newRect.width = prev.x + prev.width - newX
            const newY = Math.max(0, Math.min(prev.y + prev.height - 30, prev.y + deltaPdfY))
            newRect.y = newY
            newRect.height = prev.y + prev.height - newY
          }

          return newRect
        })
        setDragStart({ x: e.clientX, y: e.clientY })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(null)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, dragStart, canvasScale])

  const generatePreview = async () => {
    // Convert hex color to CMYK
    // For now, if it's black (#000000), use CMYK black, otherwise convert RGB to CMYK
    const hex = color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16) / 255
    const g = parseInt(hex.substring(2, 4), 16) / 255
    const b = parseInt(hex.substring(4, 6), 16) / 255

    // Simple RGB to CMYK conversion
    const k = 1 - Math.max(r, g, b)
    const c = k === 1 ? 0 : (1 - r - k) / (1 - k)
    const m = k === 1 ? 0 : (1 - g - k) / (1 - k)
    const y = k === 1 ? 0 : (1 - b - k) / (1 - k)

    // Calculate center of rectangle in PDF coordinates
    const textX = rectPdfPoints.x + rectPdfPoints.width / 2 + offsetX
    const textY = rectPdfPoints.y + rectPdfPoints.height / 2 + offsetY

    console.log('📄 PDF Export Details:')
    console.log('  Rectangle:', rectPdfPoints)
    console.log('  Text Center X:', textX, `(offset: ${offsetX})`)
    console.log('  Text Center Y:', textY, `(offset: ${offsetY})`)
    console.log('  Font Size:', calculatedFontSize)
    console.log('  Text:', name)
    console.log('  Color (CMYK):', { c, m, y, k })

    const response = await fetch('/api/pdf/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateUrl: '/templates/Atlassian_Template_v1.pdf',
        method: 'overlay',
        data: {},
        fontUrl: useCustomFont ? '/fonts/CharlieDisplay-Regular.otf' : undefined,
        overlays: [
          {
            text: name,
            x: textX,
            y: textY,
            fontSize: calculatedFontSize,
            color: { c, m, y, k },
            align: 'center',
          },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      alert('Error generating PDF: ' + error)
      return
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  const rectPercentage = getRectPercentage()

  return (
    <>
      <style jsx global>{`
        @font-face {
          font-family: 'CharlieDisplay';
          src: url('/fonts/CharlieDisplay-Regular.otf') format('opentype');
          font-weight: normal;
          font-style: normal;
        }

        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, #9333ea, #3b82f6);
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, #9333ea, #3b82f6);
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          border: none;
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              PDF Text Area Designer
            </h1>
            <p className="text-gray-600">
              Define a rectangle area - text will auto-scale to fit (Canva-style)
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Toolbar - Left Sidebar */}
            <div className="col-span-3 space-y-4">
              {/* Text Controls */}
              <div className="bg-white rounded-xl shadow-lg p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <span className="text-xl">✏️</span> Text
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Content</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none transition"
                      placeholder="Enter name..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Max Font Size: <span className="text-purple-600">{maxFontSize}px</span>
                    </label>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      value={maxFontSize}
                      onChange={(e) => setMaxFontSize(Number(e.target.value))}
                      className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>20px</span>
                      <span>100px</span>
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="text-xs font-medium text-purple-700 mb-1">
                      Auto-Calculated Size:
                    </div>
                    <div className="text-2xl font-bold text-purple-900">
                      {calculatedFontSize.toFixed(1)}px
                    </div>
                    <div className="text-xs text-purple-600 mt-1">
                      {calculatedFontSize < maxFontSize
                        ? '↓ Reduced to fit'
                        : '✓ Fits perfectly'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Color <span className="text-xs text-gray-500">(converted to CMYK)</span>
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-12 h-12 border-2 border-gray-200 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Black (#000000) = CMYK(0%, 0%, 0%, 100%)
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer p-3 border-2 border-gray-200 rounded-lg hover:bg-purple-50 transition">
                      <input
                        type="checkbox"
                        checked={useCustomFont}
                        onChange={(e) => setUseCustomFont(e.target.checked)}
                        className="w-5 h-5 text-purple-600 rounded"
                      />
                      <span className="text-sm font-medium">CharlieDisplay Font</span>
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer p-3 border-2 border-gray-200 rounded-lg hover:bg-blue-50 transition">
                      <input
                        type="checkbox"
                        checked={showDebug}
                        onChange={(e) => setShowDebug(e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded"
                      />
                      <span className="text-sm font-medium">Show Debug Crosshair</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Fine-Tuning Controls */}
              <div className="bg-white rounded-xl shadow-lg p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <span className="text-xl">🎯</span> Fine-Tune Position
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Offset X: <span className="text-blue-600">{offsetX > 0 ? '+' : ''}{offsetX}px</span>
                    </label>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={offsetX}
                      onChange={(e) => setOffsetX(Number(e.target.value))}
                      className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>-50</span>
                      <span>0</span>
                      <span>+50</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Offset Y: <span className="text-blue-600">{offsetY > 0 ? '+' : ''}{offsetY}px</span>
                    </label>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={offsetY}
                      onChange={(e) => setOffsetY(Number(e.target.value))}
                      className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>-50</span>
                      <span>0</span>
                      <span>+50</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setOffsetX(0)
                      setOffsetY(0)
                    }}
                    className="w-full text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded transition"
                  >
                    Reset Offsets
                  </button>
                </div>
              </div>

              {/* Rectangle Info */}
              <div className="bg-white rounded-xl shadow-lg p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="text-xl">📐</span> PDF Coordinates
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">X:</span>
                    <span className="font-mono font-semibold">{Math.round(rectPdfPoints.x)} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Y:</span>
                    <span className="font-mono font-semibold">{Math.round(rectPdfPoints.y)} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Width:</span>
                    <span className="font-mono font-semibold">{Math.round(rectPdfPoints.width)} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Height:</span>
                    <span className="font-mono font-semibold">{Math.round(rectPdfPoints.height)} pts</span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-gray-200">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Center X:</span>
                      <span className="font-mono text-xs font-semibold">
                        {Math.round(rectPdfPoints.x + rectPdfPoints.width / 2 + offsetX)} pts
                        {offsetX !== 0 && <span className="text-blue-600 ml-1">({offsetX > 0 ? '+' : ''}{offsetX})</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Center Y:</span>
                      <span className="font-mono text-xs font-semibold">
                        {Math.round(rectPdfPoints.y + rectPdfPoints.height / 2 + offsetY)} pts
                        {offsetY !== 0 && <span className="text-blue-600 ml-1">({offsetY > 0 ? '+' : ''}{offsetY})</span>}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={generatePreview}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-3 rounded-lg hover:from-purple-600 hover:to-blue-600 font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <span>🚀</span> Export PDF Preview
                </button>
              </div>
            </div>

            {/* Canvas - Main Area */}
            <div className="col-span-9">
              <div className="bg-white rounded-xl shadow-2xl p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                    Drag rectangle to move • Drag corners to resize
                  </div>
                  <div className="text-sm text-gray-500">{PDF_WIDTH} × {PDF_HEIGHT} pts</div>
                </div>

                {/* Canvas Container */}
                <div
                  ref={canvasRef}
                  className="relative bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-lg overflow-hidden shadow-inner"
                  style={{
                    width: '100%',
                    aspectRatio: `${PDF_WIDTH} / ${PDF_HEIGHT}`,
                    cursor: isDragging || isResizing ? 'grabbing' : 'default',
                  }}
                >
                  {/* PDF Background */}
                  <object
                    data="/templates/Atlassian_Template_v1.pdf#view=FitH"
                    type="application/pdf"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ border: 'none' }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
                      <div className="text-center">
                        <div className="text-6xl mb-2">📄</div>
                        <div>Atlassian Template v1</div>
                      </div>
                    </div>
                  </object>

                  {/* Grid Overlay */}
                  <div className="absolute inset-0 pointer-events-none opacity-30">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-blue-300"></div>
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-blue-300"></div>
                  </div>

                  {/* Rectangle Text Boundary */}
                  <div
                    ref={rectRef}
                    onMouseDown={handleRectMouseDown}
                    className="absolute select-none"
                    style={{
                      left: `${rectPercentage.x}%`,
                      top: `${rectPercentage.y}%`,
                      width: `${rectPercentage.width}%`,
                      height: `${rectPercentage.height}%`,
                      cursor: isDragging ? 'grabbing' : 'grab',
                      pointerEvents: 'auto',
                    }}
                  >
                    {/* Rectangle Border */}
                    <div
                      className={`absolute inset-0 border-2 ${
                        isDragging || isResizing
                          ? 'border-purple-500 bg-purple-100'
                          : 'border-purple-400 bg-purple-50'
                      } rounded-lg bg-opacity-20 transition-all`}
                    >
                      {/* Corner Resize Handles */}
                      <div
                        className="resize-handle absolute -top-2 -left-2 w-4 h-4 bg-purple-500 rounded-full cursor-nw-resize hover:scale-125 transition-transform z-10"
                        onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
                      ></div>
                      <div
                        className="resize-handle absolute -top-2 -right-2 w-4 h-4 bg-purple-500 rounded-full cursor-ne-resize hover:scale-125 transition-transform z-10"
                        onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
                      ></div>
                      <div
                        className="resize-handle absolute -bottom-2 -left-2 w-4 h-4 bg-purple-500 rounded-full cursor-sw-resize hover:scale-125 transition-transform z-10"
                        onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
                      ></div>
                      <div
                        className="resize-handle absolute -bottom-2 -right-2 w-4 h-4 bg-purple-500 rounded-full cursor-se-resize hover:scale-125 transition-transform z-10"
                        onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
                      ></div>
                    </div>

                    {/* The Text (Centered) */}
                    <div
                      ref={textRef}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <div
                        className="whitespace-nowrap"
                        style={{
                          fontSize: `${calculatedFontSize * canvasScale}px`,
                          color: color,
                          fontFamily: useCustomFont
                            ? 'CharlieDisplay, system-ui'
                            : 'Helvetica, Arial',
                          fontWeight: 'normal',
                          textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        }}
                      >
                        {name || 'Enter text...'}
                      </div>
                    </div>

                    {/* Coordinate Labels */}
                    {showDebug && (
                      <div className="absolute -top-6 left-0 text-xs font-mono text-purple-600 bg-white px-1 rounded pointer-events-none">
                        ({Math.round(rectPdfPoints.x)}, {Math.round(rectPdfPoints.y + rectPdfPoints.height)})
                      </div>
                    )}

                    {/* Center point indicator (where text will be placed) */}
                    {showDebug && (
                      <>
                        <div className="absolute left-1/2 top-1/2 w-2 h-2 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-50"></div>
                        <div className="absolute left-1/2 top-1/2 w-px h-8 bg-red-500 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-30"></div>
                        <div className="absolute left-1/2 top-1/2 w-8 h-px bg-red-500 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-30"></div>
                        <div className="absolute left-1/2 top-1/2 text-[10px] font-mono bg-red-500 text-white px-1 rounded pointer-events-none translate-x-2 translate-y-2">
                          Center: ({Math.round(rectPdfPoints.x + rectPdfPoints.width / 2)}, {Math.round(rectPdfPoints.y + rectPdfPoints.height / 2)})
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* PDF Info */}
                <div className="mt-4 text-xs text-gray-500 text-center">
                  PDF Template: 936 × 648 pts (16:9 aspect ratio)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
