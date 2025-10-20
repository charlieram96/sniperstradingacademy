"use client"

import { useState } from "react"
import { ChevronDown, Search, Crown, Sparkles, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface TeamMember {
  id: string
  name: string
  email: string
  level: number
  created_at: string
  subscription_status?: string
  referrals_count?: number
  active_network_count?: number
  is_direct_referral?: boolean
  spillover_from?: string | null
  position?: number
  parent_id?: string | null
}

interface StructureDropdownProps {
  structureNum: number
  isActive: boolean
  isComplete: boolean
  members: TeamMember[]
  totalMembers: number
  maxMembers: number
  commissionRate: number
}

export function StructureDropdown({
  structureNum,
  isActive,
  isComplete,
  members,
  totalMembers,
  maxMembers,
  commissionRate
}: StructureDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [showMemberModal, setShowMemberModal] = useState(false)

  // Filter members based on search and filters
  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === "all" ||
                         (filterStatus === "active" && member.subscription_status === "active") ||
                         (filterStatus === "inactive" && member.subscription_status !== "active")
    return matchesSearch && matchesStatus
  })

  const handleMemberClick = (member: TeamMember) => {
    setSelectedMember(member)
    setShowMemberModal(true)
  }

  return (
    <>
      <Button 
        variant="outline" 
        className="w-full justify-between"
        disabled={!isActive}
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">Structure {structureNum}</span>
          <Badge variant={isComplete ? "default" : isActive ? "secondary" : "outline"}>
            {isComplete ? "Complete" : isActive ? "Active" : "Locked"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {totalMembers}/{maxMembers} members
          </span>
          <ChevronDown className="h-4 w-4" />
        </div>
      </Button>

      {/* Main Structure Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="!max-w-[calc(100vw-2rem)] !w-[calc(100vw-2rem)] h-[90vh] p-0 overflow-hidden bg-background/95 backdrop-blur-xl">
          <div className="flex flex-col h-full">
            <DialogHeader className="px-6 py-4 border-b">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <DialogTitle className="text-xl font-semibold">Structure {structureNum} Details</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {commissionRate}% commission rate • {totalMembers} total members
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 p-6 overflow-hidden">
              {/* Search and Filters */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Members List */}
              <ScrollArea className="h-[calc(100%-60px)]">
                {filteredMembers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No members found matching your filters
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredMembers.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent-hover cursor-pointer transition-colors"
                        onClick={() => handleMemberClick(member)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{member.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.is_direct_referral && (
                            <Badge variant="secondary" className="text-xs">Direct</Badge>
                          )}
                          {member.spillover_from && (
                            <Badge variant="outline" className="text-xs">Spillover</Badge>
                          )}
                          <Badge
                            variant={member.subscription_status === 'active' ? 'default' : 'outline'}
                            className="text-xs"
                          >
                            {member.subscription_status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Detail Modal */}
      <Dialog open={showMemberModal} onOpenChange={setShowMemberModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Member Profile</DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-6">
              {/* Member Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                    {selectedMember.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{selectedMember.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      {selectedMember.is_direct_referral && (
                        <Badge className="bg-primary/10 text-primary">
                          <Crown className="h-3 w-3 mr-1" />
                          Direct Referral
                        </Badge>
                      )}
                      {selectedMember.spillover_from && (
                        <Badge variant="outline">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Spillover
                        </Badge>
                      )}
                      <Badge variant={selectedMember.subscription_status === 'active' ? 'default' : 'outline'}>
                        {selectedMember.subscription_status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Rank</p>
                  <p className="text-2xl font-bold text-primary">Level {selectedMember.level}</p>
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4">
                  <CardHeader className="p-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Direct Referrals
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-2xl font-bold">{selectedMember.referrals_count || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">People referred</p>
                  </CardContent>
                </Card>
                
                <Card className="p-4">
                  <CardHeader className="p-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Active Network Size
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-2xl font-bold">
                      {selectedMember.active_network_count || 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Active members in network</p>
                  </CardContent>
                </Card>

                <Card className="p-4">
                  <CardHeader className="p-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Monthly Contribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-2xl font-bold text-primary">
                      ${selectedMember.subscription_status === 'active' ? '19.90' : '0'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">To your residual</p>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Performance Metrics
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">Join Date</span>
                    <span className="text-sm font-medium">
                      {new Date(selectedMember.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">Days in Network</span>
                    <span className="text-sm font-medium">
                      {Math.floor((Date.now() - new Date(selectedMember.created_at).getTime()) / (1000 * 60 * 60 * 24))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">Qualification Status</span>
                    <span className="text-sm font-medium">
                      {(selectedMember.referrals_count || 0) >= 3 ? (
                        <Badge className="bg-green-500/10 text-green-500">Qualified</Badge>
                      ) : (
                        <Badge variant="outline">
                          {3 - (selectedMember.referrals_count || 0)} more needed
                        </Badge>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Network Impact */}
              {selectedMember.subscription_status === 'active' && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-primary">Active Network Contributor</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        This member&apos;s subscription generates $19.90/month in residual income and helps grow your network through their referrals.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}