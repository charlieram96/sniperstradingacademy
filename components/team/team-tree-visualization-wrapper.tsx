"use client"

import dynamic from 'next/dynamic'

const TeamTreeVisualization = dynamic(
  () => import('./team-tree-visualization'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">Loading visualization...</p>
        </div>
      </div>
    )
  }
)

export default TeamTreeVisualization