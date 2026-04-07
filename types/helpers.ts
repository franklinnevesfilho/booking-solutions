import type { Database } from './database'

// Extract Row types directly
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

// Extract Insert/Update DTOs
export type InsertDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type UpdateDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Extract a typed query result from a Supabase query builder
export type QueryResult<T extends (...args: never[]) => unknown> =
  Awaited<ReturnType<T>> extends { data: infer D } ? D : never