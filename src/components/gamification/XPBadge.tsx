import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface XPBadgeProps {
  userId: string
}

export function XPBadge({ userId }: XPBadgeProps) {
  const [xp, setXp] = useState<{ total_xp: number; level: number } | null>(null)

  useEffect(() => {
    loadXP()
  }, [userId])

  const loadXP = async () => {
    const { data } = await supabase
      .from("user_xp")
      .select("total_xp, level")
      .eq("user_id", userId)
      .maybeSingle()

    if (data) setXp(data)
  }

  if (!xp) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="gap-1 px-3 py-1 cursor-default">
            <span className="text-yellow-500">✦</span>
            <span className="font-mono text-xs">{xp.total_xp}</span>
            <span className="text-muted-foreground text-xs">Lv.{xp.level}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Level {xp.level} &mdash; {xp.total_xp} total XP</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
