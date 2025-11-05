/**
 * Tool to adjust the position of the name in the Atlassian PDF
 * This helps you find the perfect coordinates
 */

'use client'

import { useState } from 'react'

export default function AdjustPdfPage() {
  const [name, setName] = useState('Alex')
  const [x, setX] = useState(306) // Center of 612 width page
  const [y, setY] = useState(366) // Estimated position
  const [fontSize, setFontSize] = useState(72)
  const [coverX, setCoverX] = useState(106)
  const [coverY, setCoverY] = useState(346)
  const [coverWidth, setCoverWidth] = useState(400)
  const [coverHeight, setCoverHeight] = useState(100)

  const generatePreview = async () => {
    const response = await fetch('/api/pdf/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateUrl: '/templates/Atlassian_Template.pdf',
        method: 'overlay',
        data: {},
        overlays: [
          // First, draw white rectangle to cover {name}
          {
            text: ' '.repeat(50), // Hack: draw white space
            x: coverX,
            y: coverY,
            fontSize: coverHeight,
            color: { r: 1, g: 1, b: 1 },
          },
          // Then draw the actual name
          {
            text: name,
            x: x,
            y: y,
            fontSize: fontSize,
            color: { r: 0, g: 0, b: 0 },
          },
        ],
      }),
    })

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  const updateCode = () => {
    console.log(`
// Update these values in apps/web/app/api/pdf/atlassian/route.ts:

const fontSize = ${fontSize}
const textY = ${y}

// Cover rectangle:
firstPage.drawRectangle({
  x: ${coverX},
  y: ${coverY},
  width: ${coverWidth},
  height: ${coverHeight},
  color: rgb(1, 1, 1),
})

// Name position (centered):
const nameX = ${x} - (nameWidth / 2)
    `)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">PDF Coordinate Adjuster</h1>
        <p className="text-gray-600 mb-8">
          Adjust these values to position the name correctly in your PDF.
          Click Preview to see the result.
        </p>

        <div className="grid grid-cols-2 gap-8">
          {/* Controls */}
          <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Controls</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Font Size: {fontSize}pt
              </label>
              <input
                type="range"
                min="20"
                max="120"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Name X Position: {x}
              </label>
              <input
                type="range"
                min="0"
                max="612"
                value={x}
                onChange={(e) => setX(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Name Y Position: {y}
              </label>
              <input
                type="range"
                min="0"
                max="792"
                value={y}
                onChange={(e) => setY(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <hr className="my-4" />

            <h3 className="font-semibold">Cover Rectangle (to hide {'{name}'})</h3>

            <div>
              <label className="block text-sm font-medium mb-1">
                Cover X: {coverX}
              </label>
              <input
                type="range"
                min="0"
                max="612"
                value={coverX}
                onChange={(e) => setCoverX(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Cover Y: {coverY}
              </label>
              <input
                type="range"
                min="0"
                max="792"
                value={coverY}
                onChange={(e) => setCoverY(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Cover Width: {coverWidth}
              </label>
              <input
                type="range"
                min="100"
                max="600"
                value={coverWidth}
                onChange={(e) => setCoverWidth(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Cover Height: {coverHeight}
              </label>
              <input
                type="range"
                min="50"
                max="200"
                value={coverHeight}
                onChange={(e) => setCoverHeight(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <button
              onClick={generatePreview}
              className="w-full bg-blue-500 text-white px-4 py-3 rounded-md hover:bg-blue-600 font-semibold"
            >
              Preview PDF
            </button>

            <button
              onClick={updateCode}
              className="w-full bg-green-500 text-white px-4 py-3 rounded-md hover:bg-green-600 font-semibold"
            >
              Copy Code to Console
            </button>
          </div>

          {/* Info */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Current Values</h2>

            <div className="bg-gray-50 p-4 rounded font-mono text-sm space-y-2">
              <div><strong>Name:</strong> {name}</div>
              <div><strong>Font Size:</strong> {fontSize}pt</div>
              <div><strong>Name Position:</strong> ({x}, {y})</div>
              <div><strong>Cover Position:</strong> ({coverX}, {coverY})</div>
              <div><strong>Cover Size:</strong> {coverWidth} × {coverHeight}</div>
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-4">
              <h3 className="font-semibold mb-2">How to use:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Adjust the sliders to position the text</li>
                <li>Click "Preview PDF" to see the result</li>
                <li>Repeat until it looks perfect</li>
                <li>Click "Copy Code to Console"</li>
                <li>Update the values in the API route</li>
              </ol>
            </div>

            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded p-4">
              <h3 className="font-semibold mb-2">PDF Coordinate System:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>(0, 0) is at <strong>bottom-left</strong></li>
                <li>X increases left → right</li>
                <li>Y increases bottom → top</li>
                <li>Standard page: 612 × 792 points</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
