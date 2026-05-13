import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface UserBadge {
  id: string
  badge: {
    name: string
    description: string | null
    icon: string | null
  }
}

interface BadgeDisplayProps {
  userId: string
}

export function BadgeDisplay({ userId }: BadgeDisplayProps) {
  const [badges, setBadges] = useState<UserBadge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBadges()
  }, [userId])

  const loadBadges = async () => {
    const { data } = await supabase
      .from("user_badges")
      .select("id, badge:badges(name, description, icon)")
      .eq("user_id", userId)

    setBadges((data ?? []) as unknown as UserBadge[])
    setLoading(false)
  }

  if (loading || badges.length === 0) return null

  return (
    <TooltipProvider>
      <div className="flex gap-1">
        {badges.map((b) => (
          <Tooltip key={b.id}>
            <TooltipTrigger asChild>
              <span className="text-lg cursor-default">{b.badge.icon ?? "🏅"}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{b.badge.name}</p>
              {b.badge.description && (
                <p className="text-xs text-muted-foreground">{b.badge.description}</p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
