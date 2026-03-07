"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react"

interface VideoPlayerProps {
  src: string
  title: string
  lessonId: string
  moduleId: string
  isCompleted: boolean
  onMarkComplete: () => void
  onEnded?: () => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function VideoPlayer({
  src,
  lessonId,
  isCompleted,
  onMarkComplete,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasMarkedRef = useRef(isCompleted)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)

  // Reset hasMarkedRef when lessonId changes
  useEffect(() => {
    hasMarkedRef.current = isCompleted
  }, [lessonId, isCompleted])

  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000)
    }
  }, [isPlaying])

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    } else {
      resetHideTimer()
    }
  }, [isPlaying, resetHideTimer])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }, [])

  const handlePlay = useCallback(() => {
    setIsPlaying(true)
    if (!hasMarkedRef.current) {
      hasMarkedRef.current = true
      onMarkComplete()
    }
  }, [onMarkComplete])

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video) return
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    video.currentTime = fraction * video.duration
  }, [])

  const handleSeekStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsSeeking(true)
    seek(e)
  }, [seek])

  const handleSeekMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isSeeking) seek(e)
  }, [isSeeking, seek])

  const handleSeekEnd = useCallback(() => {
    setIsSeeking(false)
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(!video.muted ? false : true)
  }, [])

  const changeVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    const val = parseFloat(e.target.value)
    video.volume = val
    setVolume(val)
    if (val === 0) {
      video.muted = true
      setIsMuted(true)
    } else if (video.muted) {
      video.muted = false
      setIsMuted(false)
    }
  }, [])

  const cyclePlaybackRate = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const idx = PLAYBACK_RATES.indexOf(playbackRate)
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length]
    video.playbackRate = next
    setPlaybackRate(next)
  }, [playbackRate])

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current
    if (!container) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await container.requestFullscreen()
    }
  }, [])

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only handle if the video container or its children are focused/active
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return
      const video = videoRef.current
      if (!video) return

      switch (e.key) {
        case " ":
          e.preventDefault()
          togglePlay()
          break
        case "ArrowRight":
          e.preventDefault()
          video.currentTime = Math.min(video.duration, video.currentTime + 5)
          break
        case "ArrowLeft":
          e.preventDefault()
          video.currentTime = Math.max(0, video.currentTime - 5)
          break
        case "ArrowUp":
          e.preventDefault()
          video.volume = Math.min(1, video.volume + 0.1)
          setVolume(video.volume)
          break
        case "ArrowDown":
          e.preventDefault()
          video.volume = Math.max(0, video.volume - 0.1)
          setVolume(video.volume)
          break
        case "f":
        case "F":
          e.preventDefault()
          toggleFullscreen()
          break
        case "m":
        case "M":
          e.preventDefault()
          toggleMute()
          break
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [togglePlay, toggleFullscreen, toggleMute])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl bg-[#0a0a0a] aspect-video overflow-hidden group transition-shadow duration-300 hover:shadow-[0_0_40px_rgba(212,168,83,0.08)] w-full"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        preload="metadata"
        onClick={togglePlay}
        onPlay={handlePlay}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => {
          setIsPlaying(false)
          onEnded?.()
        }}
      />

      {/* Large centered play overlay when paused */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10"
        >
          <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center transition-transform duration-300 hover:scale-110 animate-[gentle-pulse_2s_ease-in-out_infinite]">
            <Play className="h-8 w-8 text-white ml-1" />
          </div>
        </button>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-3 px-4 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress bar */}
        <div
          className="w-full h-1 bg-white/20 rounded-full mb-3 cursor-pointer group/progress hover:h-2 transition-all duration-200 relative"
          onMouseDown={handleSeekStart}
          onMouseMove={handleSeekMove}
          onMouseUp={handleSeekEnd}
          onMouseLeave={handleSeekEnd}
        >
          <div
            className="h-full bg-gold-400 rounded-full relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-gold-400 rounded-full shadow-[0_0_8px_rgba(212,168,83,0.5)] opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="text-white hover:text-gold-400 transition-colors"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>

          {/* Time */}
          <span className="text-white/80 text-xs font-mono min-w-[90px]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Volume */}
          <div
            className="relative flex items-center gap-1"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={toggleMute}
              className="text-white hover:text-gold-400 transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                showVolumeSlider ? "w-20 opacity-100" : "w-0 opacity-0"
              }`}
            >
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={changeVolume}
                className="w-20 h-1 accent-gold-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Playback speed */}
          <button
            onClick={cyclePlaybackRate}
            className="text-white hover:text-gold-400 transition-colors text-xs font-mono px-1.5 py-0.5 rounded border border-white/20 hover:border-gold-400/40 min-w-[40px] text-center"
          >
            {playbackRate}x
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-gold-400 transition-colors"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
