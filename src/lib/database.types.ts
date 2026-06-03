export type ItemStatus = 'want_to' | 'done'
export type ItemReaction = 'loved_it' | 'liked_it' | 'eh' | 'not_for_me'
export type ItemSource = 'share_sheet' | 'quick_add' | 'photo' | 'email' | 'manual'

export interface Item {
  id: string
  user_id: string
  title: string
  creator: string | null
  type: string
  year: number | null
  status: ItemStatus
  reaction: ItemReaction | null
  note: string | null
  source: ItemSource
  source_detail: string | null
  recommended_by: string | null
  metadata: Record<string, unknown>
  tags: string[]
  moods: string[]
  date_added: string
  date_done: string | null
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      items: {
        Row: Item
        Insert: Omit<Item, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
          date_added?: string
        }
        Update: Partial<Item>
      }
    }
  }
}
