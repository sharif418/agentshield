'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppStore } from '@/lib/store'
import { useQueryClient } from '@tanstack/react-query'

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null)
  const setWsConnected = useAppStore((s) => s.setWsConnected)
  const queryClient = useQueryClient()

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return

    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
    })

    socket.on('connect', () => {
      setWsConnected(true)
      socket.emit('subscribe:approvals', {})
    })

    socket.on('disconnect', () => {
      setWsConnected(false)
    })

    socket.on('approval:new', () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    })

    socket.on('approval:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    })

    socket.on('approval:reminder', () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    })

    socketRef.current = socket
  }, [setWsConnected, queryClient])

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe:approvals', {})
      socketRef.current.disconnect()
      socketRef.current = null
      setWsConnected(false)
    }
  }, [setWsConnected])

  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { connect, disconnect }
}
