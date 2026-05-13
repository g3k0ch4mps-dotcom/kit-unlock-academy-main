import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"

export function useStreak(userId: string | undefined) {
  const [streak, setStreak] = useState<{
    current: number
    longest: number
    lastDate: string | null
  }>({ current: 0, longest: 0, lastDate: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    loadStreak()
  }, [userId])

  const loadStreak = async () => {
    if (!userId) return
    const { data } = await supabase
      .from("user_streaks")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    if (data) {
      setStreak({
        current: data.current_streak,
        longest: data.longest_streak,
        lastDate: data.last_activity_date,
      })
    }
    setLoading(false)
  }

  const updateStreak = useCallback(async () => {
    if (!userId) return
    const today = new Date().toISOString().split("T")[0]

    const { data: existing } = await supabase
      .from("user_streaks")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    if (!existing) {
      await supabase
        .from("user_streaks")
        .insert({
          user_id: userId,
          current_streak: 1,
          longest_streak: 1,
          last_activity_date: today,
        })
      setStreak({ current: 1, longest: 1, lastDate: today })
      return
    }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split("T")[0]

    let newCurrent = existing.current_streak
    if (existing.last_activity_date === yesterdayStr) {
      newCurrent += 1
    } else if (existing.last_activity_date !== today) {
      newCurrent = 1
    }

    const newLongest = Math.max(newCurrent, existing.longest_streak)

    await supabase
      .from("user_streaks")
      .update({
        current_streak: newCurrent,
        longest_streak: newLongest,
        last_activity_date: today,
      })
      .eq("user_id", userId)

    setStreak({ current: newCurrent, longest: newLongest, lastDate: today })
  }, [userId])

  return { streak, loading, updateStreak, reload: loadStreak }
}
