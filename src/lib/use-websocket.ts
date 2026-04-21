'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppStore } from '@/lib/store'
import { useQueryClient } from '@tanstack/react-query'

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null)
  const setWsConnected = useAppStore((s) => s.setWsConnected)
  const setWsReconnecting = useAppStore((s) => s.setWsReconnecting)
  const setWsReconnectAttempt = useAppStore((s) => s.setWsReconnectAttempt)
  const queryClient = useQueryClient()

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return

    const wsPort = process.env.NEXT_PUBLIC_WS_PORT ?? '3003'
    const socket = io(`/?XTransformPort=${wsPort}`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity, // unlimited retries
      reconnectionDelay: 1000, // initial delay: 1s
      reconnectionDelayMax: 30000, // max delay: 30s
      randomizationFactor: 0.5, // add jitter to avoid thundering herd
      timeout: 10000,
    })

    socket.on('connect', () => {
      setWsConnected(true)
      setWsReconnecting(false)
      setWsReconnectAttempt(0)
      socket.emit('subscribe:approvals', {})
    })

    socket.on('disconnect', (reason) => {
      setWsConnected(false)
      // If the server initiated the disconnect, Socket.IO will auto-reconnect
      // If the client initiated it, we don't set reconnecting
      if (reason === 'io server disconnect') {
        // Server forcefully disconnected - Socket.IO will still try to reconnect
        setWsReconnecting(true)
      }
    })

    socket.on('reconnect_attempt', (attempt) => {
      setWsReconnecting(true)
      setWsReconnectAttempt(attempt)
    })

    socket.on('reconnect', () => {
      setWsReconnecting(false)
      setWsReconnectAttempt(0)
      // Re-emit pending events after successful reconnect
      socket.emit('subscribe:approvals', {})
      // Invalidate queries to refresh data that may have changed during disconnection
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    })

    socket.on('reconnect_failed', () => {
      // This won't fire since reconnectionAttempts is Infinity,
      // but handle it just in case
      setWsReconnecting(false)
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
  }, [setWsConnected, setWsReconnecting, setWsReconnectAttempt, queryClient])

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe:approvals', {})
      socketRef.current.disconnect()
      socketRef.current = null
      setWsConnected(false)
      setWsReconnecting(false)
      setWsReconnectAttempt(0)
    }
  }, [setWsConnected, setWsReconnecting, setWsReconnectAttempt])

  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { connect, disconnect }
}
