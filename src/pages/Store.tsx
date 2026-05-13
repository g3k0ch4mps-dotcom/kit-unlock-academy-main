import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useStore, useRedemptions } from "@/hooks/use-store"
import { useToast } from "@/hooks/use-toast"

export default function Store() {
  const { user } = useAuth()
  const { items, loading } = useStore()
  const { redemptions, redeemItem, reload: reloadRedemptions } = useRedemptions(user?.id)
  const { toast } = useToast()
  const [redeeming, setRedeeming] = useState<string | null>(null)

  const handleRedeem = async (item: { id: string; name: string; xp_cost: number; stock: number | null; description: string | null; image_url: string | null; is_active: boolean | null }) => {
    if (!user) return
    setRedeeming(item.id)
    const result = await redeemItem(item, user.id)
    setRedeeming(null)

    if (result.error) {
      toast({ title: "Redemption failed", description: result.error, variant: "destructive" })
    } else {
      toast({ title: "Item redeemed!", description: `You redeemed ${item.name}` })
      await reloadRedemptions()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">XP Store</h1>
          <p className="text-muted-foreground">Redeem your XP for rewards</p>
        </div>

        {redemptions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Your Redemptions</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {redemptions.map((r) => (
                <Card key={r.id} className="border-l-4 border-l-primary">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">{r.item_id}</CardTitle>
                    <CardDescription className="text-xs">
                      Spent {r.xp_spent} XP &middot; {new Date(r.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Badge variant={r.status === "fulfilled" ? "default" : r.status === "pending" ? "secondary" : "destructive"}>
                      {r.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-xl font-semibold mb-4">Available Rewards</h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No rewards available yet. Check back later!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="flex flex-col">
                <CardHeader>
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="w-full h-32 object-cover rounded-lg mb-2" />
                  )}
                  <CardTitle>{item.name}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  {item.stock !== null && item.stock !== -1 && (
                    <p className="text-xs text-muted-foreground">Stock: {item.stock}</p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleRedeem(item)}
                    disabled={redeeming === item.id}
                  >
                    {redeeming === item.id ? "Redeeming..." : `Redeem (${item.xp_cost} XP)`}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
