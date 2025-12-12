'use client'

export function PrintButton() {
  return (
    <button
      className="print-button no-print"
      onClick={() => window.print()}
    >
      Print Pick Slip
    </button>
  )
}
