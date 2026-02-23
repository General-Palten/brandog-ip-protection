import { useEffect, useRef, useCallback } from 'react'
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface SubscriptionConfig<T = any> {
  table: string
  schema?: string
  event?: PostgresEvent
  filter?: string
  onInsert?: (payload: T) => void
  onUpdate?: (payload: T) => void
  onDelete?: (payload: T) => void
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void
}

/**
 * Hook for subscribing to Supabase Realtime changes on database tables
 *
 * @example
 * // Subscribe to infringements for a specific brand
 * useRealtimeSubscription([
 *   {
 *     table: 'infringements',
 *     filter: `brand_id=eq.${brandId}`,
 *     onInsert: (data) => console.log('New infringement:', data),
 *     onUpdate: (data) => console.log('Updated:', data),
 *   }
 * ], !!brandId)
 */
export function useRealtimeSubscription<T = any>(
  configs: SubscriptionConfig<T>[],
  enabled: boolean = true
) {
  const channelsRef = useRef<RealtimeChannel[]>([])

  const cleanup = useCallback(() => {
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel)
    })
    channelsRef.current = []
  }, [])

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) {
      cleanup()
      return
    }

    // Create channels for each config
    configs.forEach((config, index) => {
      const channelName = `realtime_${config.table}_${index}_${Date.now()}`

      const channel = supabase.channel(channelName)

      // Build the subscription options
      const subscriptionOptions: any = {
        event: config.event || '*',
        schema: config.schema || 'public',
        table: config.table,
      }

      if (config.filter) {
        subscriptionOptions.filter = config.filter
      }

      channel.on(
        'postgres_changes',
        subscriptionOptions,
        (payload: RealtimePostgresChangesPayload<T>) => {
          // Call the general onChange handler if provided
          config.onChange?.(payload)

          // Call specific event handlers
          switch (payload.eventType) {
            case 'INSERT':
              config.onInsert?.(payload.new as T)
              break
            case 'UPDATE':
              config.onUpdate?.(payload.new as T)
              break
            case 'DELETE':
              config.onDelete?.(payload.old as T)
              break
          }
        }
      )

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to ${config.table} realtime changes`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Failed to subscribe to ${config.table}`)
        }
      })

      channelsRef.current.push(channel)
    })

    return cleanup
  }, [configs, enabled, cleanup])
}

/**
 * Hook for subscribing to a single table's changes
 */
export function useTableSubscription<T = any>(
  table: string,
  handlers: {
    onInsert?: (data: T) => void
    onUpdate?: (data: T) => void
    onDelete?: (data: T) => void
  },
  options?: {
    filter?: string
    enabled?: boolean
  }
) {
  useRealtimeSubscription<T>(
    [
      {
        table,
        filter: options?.filter,
        onInsert: handlers.onInsert,
        onUpdate: handlers.onUpdate,
        onDelete: handlers.onDelete,
      }
    ],
    options?.enabled ?? true
  )
}

/**
 * Hook for subscribing to infringement changes for a specific brand
 */
export function useInfringementSubscription(
  brandId: string | null,
  handlers: {
    onInsert?: (data: any) => void
    onUpdate?: (data: any) => void
    onDelete?: (data: any) => void
  }
) {
  useTableSubscription(
    'infringements',
    handlers,
    {
      filter: brandId ? `brand_id=eq.${brandId}` : undefined,
      enabled: !!brandId,
    }
  )
}

/**
 * Hook for subscribing to case update changes for a specific takedown
 */
export function useCaseUpdateSubscription(
  takedownId: string | null,
  handlers: {
    onInsert?: (data: any) => void
    onUpdate?: (data: any) => void
  }
) {
  useTableSubscription(
    'case_updates',
    handlers,
    {
      filter: takedownId ? `takedown_id=eq.${takedownId}` : undefined,
      enabled: !!takedownId,
    }
  )
}

/**
 * Hook for subscribing to takedown request changes
 */
export function useTakedownSubscription(
  infringementId: string | null,
  handlers: {
    onInsert?: (data: any) => void
    onUpdate?: (data: any) => void
  }
) {
  useTableSubscription(
    'takedown_requests',
    handlers,
    {
      filter: infringementId ? `infringement_id=eq.${infringementId}` : undefined,
      enabled: !!infringementId,
    }
  )
}

/**
 * Hook for subscribing to activity log updates
 */
export function useActivitySubscription(
  userId: string | null,
  handlers: {
    onInsert?: (data: any) => void
  }
) {
  useTableSubscription(
    'activity_logs',
    handlers,
    {
      filter: userId ? `user_id=eq.${userId}` : undefined,
      enabled: !!userId,
    }
  )
}

export default useRealtimeSubscription
