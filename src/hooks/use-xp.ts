import { useCallback } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

// Balanced economy: completing a module pays SESSION_COMPLETE, which must be
// >= a paid session's unlock cost so learners are never stuck. QUIZ_PASS and
// login are the surplus that builds toward the store. Recommended unlock
// cost per paid session: 15 (<= SESSION_COMPLETE).
const XP_VALUES = {
  DAILY_LOGIN: 2,
  SESSION_COMPLETE: 20,
  QUIZ_PASS: 15,
  TEST_PASS: 50,
  PROGRAM_COMPLETE: 100,
} as const

const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 50 },
  { level: 3, xp: 150 },
  { level: 4, xp: 300 },
  { level: 5, xp: 500 },
  { level: 6, xp: 800 },
  { level: 7, xp: 1200 },
  { level: 8, xp: 1700 },
  { level: 9, xp: 2300 },
  { level: 10, xp: 3000 },
]

function calculateLevel(totalXp: number): number {
  let level = 1
  for (const t of LEVEL_THRESHOLDS) {
    if (totalXp >= t.xp) level = t.level
  }
  return level
}

export function useXP() {
  const { toast } = useToast()

  const getUserXP = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("user_xp")
      .select("user_id, total_xp, spendable_xp, level")
      .eq("user_id", userId)
      .maybeSingle()

    if (error) {
      console.error("getUserXP select error:", error)
    }

    if (!data) {
      const { data: inserted, error: insertError } = await supabase
        .from("user_xp")
        .insert({ user_id: userId })
        .select("user_id, total_xp, spendable_xp, level")
        .maybeSingle()

      if (insertError) {
        console.error("getUserXP insert error:", insertError)
      }

      return inserted ?? { user_id: userId, total_xp: 0, spendable_xp: 0, level: 1 }
    }
    return data
  }, [])

  const awardXP = useCallback(async (
    userId: string,
    amount: number,
    reason: string,
    referenceType?: string,
    referenceId?: string,
  ) => {
    const { data, error } = await supabase.rpc("award_xp", {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
      p_reference_type: referenceType ?? null,
      p_reference_id: referenceId ?? null,
    })

    if (error) {
      console.error("award_xp RPC error:", error)
      toast({
        title: "XP Error",
        description: error.message || "unknown error",
        variant: "destructive",
      })
      return
    }

    toast({
      title: `+${amount} XP`,
      description: reason,
    })

    return data as { total_xp: number; spendable_xp: number; level: number }
  }, [getUserXP, toast])

  // Spend from the SPENDABLE wallet (unlock sessions, store, etc.).
  // Atomic + balance-checked server-side; lifetime XP & level are untouched.
  const spendXP = useCallback(async (
    userId: string,
    amount: number,
    reason: string,
    referenceType?: string,
    referenceId?: string,
  ) => {
    const { data, error } = await supabase.rpc("spend_xp", {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
      p_reference_type: referenceType ?? null,
      p_reference_id: referenceId ?? null,
    })

    if (error) {
      return { error: error.message || "Could not spend XP" }
    }

    return { data: data as { total_xp: number; spendable_xp: number; level: number } }
  }, [])

  const awardQuizXP = useCallback(async (
    userId: string,
    sessionId: string,
    score: number,
    totalQuestions: number,
  ) => {
    const passed = score >= Math.ceil(totalQuestions * 0.6)
    if (passed) {
      return awardXP(userId, XP_VALUES.QUIZ_PASS, "Passed session quiz", "session_quiz", sessionId)
    }
    return null
  }, [awardXP])

  const awardSessionXP = useCallback(async (userId: string, sessionId: string) => {
    return awardXP(userId, XP_VALUES.SESSION_COMPLETE, "Completed session", "session", sessionId)
  }, [awardXP])

  const awardTestXP = useCallback(async (userId: string, testId: string, passed: boolean) => {
    if (passed) {
      return awardXP(userId, XP_VALUES.TEST_PASS, "Passed program test", "test", testId)
    }
    return null
  }, [awardXP])

  const awardDailyLoginXP = useCallback(async (userId: string) => {
    const today = new Date().toISOString().split("T")[0]
    const { data: existing } = await supabase
      .from("daily_logins")
      .select("id")
      .eq("user_id", userId)
      .eq("login_date", today)
      .maybeSingle()

    if (existing) return null

    const xpResult = await awardXP(userId, XP_VALUES.DAILY_LOGIN, "Daily login bonus", "daily_login", undefined)

    await supabase
      .from("daily_logins")
      .insert({
        user_id: userId,
        login_date: today,
        xp_awarded: XP_VALUES.DAILY_LOGIN,
      })

    return xpResult
  }, [awardXP])

  return {
    getUserXP,
    awardXP,
    spendXP,
    awardQuizXP,
    awardSessionXP,
    awardTestXP,
    awardDailyLoginXP,
    XP_VALUES,
  }
}
