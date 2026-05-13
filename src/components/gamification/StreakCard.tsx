import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface StreakCardProps {
  current: number
  longest: number
  loading?: boolean
}

export function StreakCard({ current, longest, loading }: StreakCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="text-3xl">{current > 0 ? "🔥" : "💤"}</div>
        <div>
          <p className="text-lg font-bold">{current} day{current !== 1 ? "s" : ""}</p>
          <p className="text-xs text-muted-foreground">
            Current streak &middot; Longest: {longest} day{longest !== 1 ? "s" : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
