import { useCallback } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

const XP_VALUES = {
  DAILY_LOGIN: 2,
  SESSION_COMPLETE: 5,
  QUIZ_PASS: 10,
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
    const { data } = await supabase
      .from("user_xp")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    if (!data) {
      const { data: inserted } = await supabase
        .from("user_xp")
        .insert({ user_id: userId })
        .select()
        .maybeSingle()
      return inserted ?? { user_id: userId, total_xp: 0, level: 1 }
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
    const xpData = await getUserXP(userId)
    const newTotal = (xpData?.total_xp ?? 0) + amount
    const newLevel = calculateLevel(newTotal)

    const { error: xpError } = await supabase
      .from("user_xp")
      .upsert({
        user_id: userId,
        total_xp: newTotal,
        level: newLevel,
      }, { onConflict: "user_id" })

    if (xpError) {
      console.error("Failed to award XP:", xpError)
      return
    }

    await supabase
      .from("xp_transactions")
      .insert({
        user_id: userId,
        amount,
        reason,
        reference_type: referenceType ?? null,
        reference_id: referenceId ?? null,
      })

    toast({
      title: `+${amount} XP`,
      description: reason,
    })

    return { total_xp: newTotal, level: newLevel }
  }, [getUserXP, toast])

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
    awardQuizXP,
    awardSessionXP,
    awardTestXP,
    awardDailyLoginXP,
    XP_VALUES,
  }
}
