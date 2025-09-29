"use client"

import { useCallback, useEffect } from "react"
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  NodeTypes,
  Handle,
  Position,
  ReactFlowProvider
} from "reactflow"
import "reactflow/dist/style.css"
import { Badge } from "@/components/ui/badge"
import { Crown, Sparkles, User } from "lucide-react"

interface TeamMember {
  id: string
  name: string
  email: string
  level: number
  created_at: string
  subscription_status?: string
  referrals_count?: number
  is_direct_referral?: boolean
  spillover_from?: string | null
  position?: number
  parent_id?: string | null
}

interface TeamTreeVisualizationProps {
  members: TeamMember[]
  onMemberClick: (member: TeamMember) => void
  showOnlyMembers?: boolean
  structureNum?: number
}

interface NodeData {
  member: TeamMember
  onMemberClick: (member: TeamMember) => void
}

// Custom node component for actual members
function TeamMemberNode({ data }: { data: NodeData }) {
  const member = data.member as TeamMember
  const level = member.level
  
  // Progressive sizing - each level is roughly half the size of the previous
  const getSizeClasses = () => {
    switch(level) {
      case 1:
        return {
          container: 'p-4 min-w-[320px] max-w-[320px]',
          avatar: 'h-12 w-12',
          icon: 'h-6 w-6',
          badge: 'text-sm px-2 h-6',
          name: 'text-lg',
          email: 'text-sm',
          meta: 'text-sm'
        }
      case 2:
        return {
          container: 'p-3 min-w-[240px] max-w-[240px]',
          avatar: 'h-10 w-10',
          icon: 'h-5 w-5',
          badge: 'text-xs px-2 h-5',
          name: 'text-base',
          email: 'text-xs',
          meta: 'text-xs'
        }
      case 3:
        return {
          container: 'p-2.5 min-w-[180px] max-w-[180px]',
          avatar: 'h-8 w-8',
          icon: 'h-4 w-4',
          badge: 'text-xs px-1.5 h-5',
          name: 'text-sm',
          email: 'text-xs',
          meta: 'text-xs'
        }
      case 4:
        return {
          container: 'p-2 min-w-[140px] max-w-[140px]',
          avatar: 'h-6 w-6',
          icon: 'h-3.5 w-3.5',
          badge: 'text-[11px] px-1 h-4',
          name: 'text-xs',
          email: 'text-[10px]',
          meta: 'text-[10px]'
        }
      case 5:
        return {
          container: 'p-1.5 min-w-[100px] max-w-[100px]',
          avatar: 'h-5 w-5',
          icon: 'h-3 w-3',
          badge: 'text-[10px] px-1 h-4',
          name: 'text-[11px]',
          email: 'hidden',
          meta: 'text-[9px]'
        }
      default: // Level 6
        return {
          container: 'p-1 min-w-[80px] max-w-[80px]',
          avatar: 'h-4 w-4',
          icon: 'h-2.5 w-2.5',
          badge: 'text-[9px] px-0.5 h-3',
          name: 'text-[10px]',
          email: 'hidden',
          meta: 'text-[8px]'
        }
    }
  }
  
  const sizes = getSizeClasses()
  
  return (
    <div 
      className={`group bg-card border-2 border-border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 active:scale-95 transition-all hover:shadow-lg ${sizes.container}`}
      onClick={() => data.onMemberClick(member)}
      role="button"
      tabIndex={0}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 opacity-0" />
      
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1">
          <div className={`rounded-full bg-primary/10 flex items-center justify-center ${sizes.avatar}`}>
            {member.is_direct_referral && <Crown className={`text-primary ${sizes.icon}`} />}
            {member.spillover_from && <Sparkles className={`text-blue-500 ${sizes.icon}`} />}
            {!member.is_direct_referral && !member.spillover_from && <User className={`text-muted-foreground ${sizes.icon}`} />}
          </div>
          {level <= 4 && (
            <Badge 
              variant={member.subscription_status === 'active' ? 'default' : 'outline'}
              className={sizes.badge}
            >
              {member.subscription_status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
          )}
        </div>
      </div>
      
      <div className="space-y-0.5">
        <p className={`font-semibold truncate group-hover:text-primary transition-colors ${sizes.name}`}>
          {member.name}
        </p>
        {level <= 3 && (
          <p className={`text-muted-foreground truncate ${sizes.email}`}>
            {member.email}
          </p>
        )}
        <div className="flex items-center justify-between">
          <p className={`text-muted-foreground ${sizes.meta}`}>
            L{member.level}
          </p>
          {member.referrals_count && member.referrals_count > 0 && level <= 4 && (
            <p className={`text-primary font-medium ${sizes.meta}`}>
              {member.referrals_count} refs
            </p>
          )}
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 opacity-0" />
    </div>
  )
}

interface EmptyNodeData {
  level: number
}

// Custom node component for empty positions
function EmptyPositionNode({ data }: { data: EmptyNodeData }) {
  const level = data.level
  
  // Match the sizing of TeamMemberNode
  const getSizeClasses = () => {
    switch(level) {
      case 1:
        return {
          container: 'p-4 min-w-[320px] max-w-[320px] h-[140px]',
          icon: 'h-10 w-10',
          text: 'text-sm'
        }
      case 2:
        return {
          container: 'p-3 min-w-[240px] max-w-[240px] h-[110px]',
          icon: 'h-8 w-8',
          text: 'text-xs'
        }
      case 3:
        return {
          container: 'p-2.5 min-w-[180px] max-w-[180px] h-[90px]',
          icon: 'h-6 w-6',
          text: 'text-xs'
        }
      case 4:
        return {
          container: 'p-2 min-w-[140px] max-w-[140px] h-[70px]',
          icon: 'h-5 w-5',
          text: 'text-[10px]'
        }
      case 5:
        return {
          container: 'p-1.5 min-w-[100px] max-w-[100px] h-[50px]',
          icon: 'h-4 w-4',
          text: 'text-[9px]'
        }
      default: // Level 6
        return {
          container: 'p-1 min-w-[80px] max-w-[80px] h-[40px]',
          icon: 'h-3 w-3',
          text: 'text-[8px]'
        }
    }
  }
  
  const sizes = getSizeClasses()
  
  return (
    <div className={`bg-muted/10 border-2 border-dashed border-muted-foreground/20 rounded-lg ${sizes.container} flex items-center justify-center`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 opacity-0" />
      
      <div className="text-center">
        <User className={`text-muted-foreground/30 mx-auto ${sizes.icon}`} />
        {level <= 3 && <p className={`text-muted-foreground/50 mt-1 ${sizes.text}`}>Empty</p>}
        <p className={`text-muted-foreground/50 ${sizes.text}`}>
          Level {level}
        </p>
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 opacity-0" />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  teamMember: TeamMemberNode,
  emptyPosition: EmptyPositionNode,
}

function TeamTreeVisualizationInner({ members, onMemberClick, showOnlyMembers = false }: TeamTreeVisualizationProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Build tree structure from flat member list or full structure
  const buildTree = useCallback(() => {
    const newNodes: Node[] = []
    const newEdges: Edge[] = []
    
    // Calculate positions for each level
    const levelSpacing = 250
    // Progressive node spacing - more space between boxes for better visibility
    const getNodeSpacing = (level: number) => {
      if (level === 1) return 400
      if (level === 2) return 280
      if (level === 3) return 200  // Increased from 150
      if (level === 4) return 150  // Increased from 90
      if (level === 5) return 110  // Increased from 50
      return 90 // Level 6 - Increased from 25
    }
    
    if (showOnlyMembers && members.length === 0) {
      // Show message when no members
      return { nodes: [], edges: [] }
    }

    if (!showOnlyMembers) {
      // Show full 3-wide, 6-deep structure
      const maxPerLevel = [3, 9, 27, 81, 243, 729]
      
      // Create nodes for each position in the structure
      const positionToNodeId: Record<string, string> = {}
      
      for (let level = 1; level <= 6; level++) {
        const maxAtLevel = maxPerLevel[level - 1]
        const levelY = (level - 1) * levelSpacing
        const nodeSpacing = getNodeSpacing(level)
        
        // Horizontal layout for all levels
        const totalWidth = (maxAtLevel - 1) * nodeSpacing
        const startX = -totalWidth / 2
        
        for (let position = 0; position < maxAtLevel; position++) {
          const nodeId = `pos-${level}-${position}`
          positionToNodeId[nodeId] = nodeId
          
          const memberAtPosition = members.find(m => m.level === level && m.position === position + 1)
          
          if (memberAtPosition) {
            newNodes.push({
              id: nodeId,
              type: 'teamMember',
              position: { 
                x: startX + (position * nodeSpacing), 
                y: levelY 
              },
              data: { 
                member: memberAtPosition,
                onMemberClick
              }
            })
          } else {
            newNodes.push({
              id: nodeId,
              type: 'emptyPosition',
              position: { 
                x: startX + (position * nodeSpacing), 
                y: levelY 
              },
              data: { 
                level
              }
            })
          }
          
          // Create edges to connect to parent level
          if (level > 1) {
            const parentPosition = Math.floor(position / 3)
            const parentNodeId = `pos-${level - 1}-${parentPosition}`
            
            if (positionToNodeId[parentNodeId]) {
              newEdges.push({
                id: `${parentNodeId}-${nodeId}`,
                source: parentNodeId,
                target: nodeId,
                type: 'smoothstep',
                animated: memberAtPosition?.subscription_status === 'active',
                style: {
                  stroke: memberAtPosition?.is_direct_referral ? '#10b981' : 
                         memberAtPosition?.spillover_from ? '#3b82f6' : '#d1d5db',
                  strokeWidth: memberAtPosition ? 2 : 1,
                  opacity: memberAtPosition ? 1 : 0.3
                }
              })
            }
          }
        }
      }
    } else {
      // Show only members
      const membersByLevel = members.reduce((acc, member) => {
        if (!acc[member.level]) {
          acc[member.level] = []
        }
        acc[member.level].push(member)
        return acc
      }, {} as Record<number, TeamMember[]>)
      
      for (let level = 1; level <= 6; level++) {
        const levelMembers = membersByLevel[level] || []
        const levelY = (level - 1) * levelSpacing
        const nodeSpacing = getNodeSpacing(level)
        
        const totalWidth = (levelMembers.length - 1) * nodeSpacing
        const startX = -totalWidth / 2
        
        levelMembers.forEach((member, index) => {
          const nodeId = member.id
          
          newNodes.push({
            id: nodeId,
            type: 'teamMember',
            position: { 
              x: startX + (index * nodeSpacing), 
              y: levelY 
            },
            data: { 
              member,
              onMemberClick
            }
          })
          
          if (level > 1) {
            const parentLevel = membersByLevel[level - 1] || []
            if (parentLevel.length > 0) {
              const parentIndex = Math.floor(index / 3)
              if (parentIndex < parentLevel.length) {
                const parent = parentLevel[parentIndex]
                newEdges.push({
                  id: `${parent.id}-${nodeId}`,
                  source: parent.id,
                  target: nodeId,
                  type: 'smoothstep',
                  animated: member.subscription_status === 'active',
                  style: {
                    stroke: member.is_direct_referral ? '#10b981' : 
                           member.spillover_from ? '#3b82f6' : '#6b7280',
                    strokeWidth: 2
                  }
                })
              }
            }
          }
        })
      }
    }
    
    return { nodes: newNodes, edges: newEdges }
  }, [members, onMemberClick, showOnlyMembers])

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildTree()
    setNodes(newNodes)
    setEdges(newEdges)
  }, [members, buildTree, setNodes, setEdges])

  return (
    <div className="w-full h-full relative">
      {nodes.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <User className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No members in this structure yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Toggle &ldquo;Show full structure&rdquo; to see all available positions
            </p>
          </div>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          panOnScroll={true}
          zoomOnScroll={true}
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          <Controls showInteractive={false} />
          <MiniMap 
            nodeColor={(node) => {
              const member = node.data?.member
              if (member?.subscription_status === 'active') return '#10b981'
              return '#6b7280'
            }}
            pannable
            zoomable
          />
        </ReactFlow>
      )}
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur border rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Legend</p>
        <div className="flex items-center gap-2">
          <Crown className="h-3 w-3 text-primary" />
          <span className="text-xs">Direct Referral</span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-blue-500" />
          <span className="text-xs">Spillover</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-12 h-0.5 bg-green-500" />
          <span className="text-xs">Direct connection</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-12 h-0.5 bg-blue-500" />
          <span className="text-xs">Spillover connection</span>
        </div>
      </div>
    </div>
  )
}

export default function TeamTreeVisualization(props: TeamTreeVisualizationProps) {
  return (
    <ReactFlowProvider>
      <TeamTreeVisualizationInner {...props} />
    </ReactFlowProvider>
  )
}