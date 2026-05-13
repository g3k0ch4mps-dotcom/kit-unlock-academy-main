import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

export interface StoreItem {
  id: string
  name: string
  description: string | null
  xp_cost: number
  image_url: string | null
  stock: number | null
  is_active: boolean | null
}

export interface Redemption {
  id: string
  user_id: string
  item_id: string
  xp_spent: number
  status: string
  created_at: string
  fulfilled_at: string | null
}

export function useStore() {
  const [items, setItems] = useState<StoreItem[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    const { data } = await supabase
      .from("store_items")
      .select("*")
      .eq("is_active", true)
      .order("xp_cost", { ascending: true })

    setItems(data ?? [])
    setLoading(false)
  }

  return { items, loading, reload: loadItems }
}

export function useRedemptions(userId: string | undefined) {
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    loadRedemptions()
  }, [userId])

  const loadRedemptions = async () => {
    if (!userId) return
    const { data } = await supabase
      .from("redemptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    setRedemptions(data ?? [])
    setLoading(false)
  }

  const redeemItem = useCallback(async (item: StoreItem, userId: string) => {
    const { data: xp } = await supabase
      .from("user_xp")
      .select("total_xp")
      .eq("user_id", userId)
      .maybeSingle()

    if (!xp || xp.total_xp < item.xp_cost) {
      return { error: "Not enough XP" }
    }

    if (item.stock !== null && item.stock !== -1 && item.stock <= 0) {
      return { error: "Item out of stock" }
    }

    const { error: redemptionError } = await supabase
      .from("redemptions")
      .insert({
        user_id: userId,
        item_id: item.id,
        xp_spent: item.xp_cost,
        status: "pending",
      })

    if (redemptionError) {
      return { error: redemptionError.message }
    }

    const newTotal = xp.total_xp - item.xp_cost
    await supabase
      .from("user_xp")
      .update({ total_xp: newTotal })
      .eq("user_id", userId)

    if (item.stock !== null && item.stock !== -1) {
      await supabase
        .from("store_items")
        .update({ stock: item.stock - 1 })
        .eq("id", item.id)
    }

    await loadRedemptions()
    return { success: true }
  }, [])

  const updateRedemptionStatus = useCallback(async (redemptionId: string, status: string) => {
    const update: Record<string, string> = { status }
    if (status === "fulfilled") {
      update.fulfilled_at = new Date().toISOString()
    }
    await supabase
      .from("redemptions")
      .update(update)
      .eq("id", redemptionId)
    await loadRedemptions()
  }, [])

  return { redemptions, loading, redeemItem, updateRedemptionStatus, reload: loadRedemptions }
}
