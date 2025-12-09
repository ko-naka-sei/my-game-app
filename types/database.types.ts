// types/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // リアルタイム通信実験用
      realtime_test: {
        Row: {
          id: string
          message: string
          updatedAt: string
        }
        Insert: {
          id: string
          message: string
          updatedAt?: string
        }
        Update: {
          id?: string
          message?: string
          updatedAt?: string
        }
      }
      // ゲーム用ユーザーデータ
      profile: {
        Row: {
          id: string
          user_id: string
          name: string | null
          combatPower: number
          deckData: Json | null
          updatedAt: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string | null
          combatPower?: number
          deckData?: Json | null
          updatedAt?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string | null
          combatPower?: number
          deckData?: Json | null
          updatedAt?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}