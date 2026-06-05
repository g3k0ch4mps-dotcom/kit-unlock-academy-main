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
    if (item.stock !== null && item.stock !== -1 && item.stock <= 0) {
      return { error: "Item out of stock" }
    }

    // Atomic, balance-checked spend against the spendable wallet.
    // Lifetime XP / level stay intact, so redeeming never demotes the user.
    const { error: spendError } = await supabase.rpc("spend_xp", {
      p_user_id: userId,
      p_amount: item.xp_cost,
      p_reason: `Redeemed: ${item.name}`,
      p_reference_type: "store_item",
      p_reference_id: item.id,
    })

    if (spendError) {
      return { error: /insufficient/i.test(spendError.message) ? "Not enough XP" : spendError.message }
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
      // Refund the spend if we couldn't record the redemption
      await supabase.rpc("award_xp", {
        p_user_id: userId,
        p_amount: item.xp_cost,
        p_reason: `Refund (redemption failed): ${item.name}`,
        p_reference_type: "store_item",
        p_reference_id: item.id,
      })
      return { error: redemptionError.message }
    }

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
