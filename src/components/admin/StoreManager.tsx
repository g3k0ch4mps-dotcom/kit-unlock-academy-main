import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface StoreItem {
  id: string
  name: string
  description: string | null
  xp_cost: number
  image_url: string | null
  stock: number | null
  is_active: boolean | null
}

export function StoreManager() {
  const [items, setItems] = useState<StoreItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: "", description: "", xp_cost: 100, stock: -1, image_url: "" })
  const { toast } = useToast()

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    const { data } = await supabase
      .from("store_items")
      .select("*")
      .order("xp_cost", { ascending: true })

    setItems(data ?? [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name) return
    const { error } = await supabase
      .from("store_items")
      .insert({
        name: form.name,
        description: form.description || null,
        xp_cost: form.xp_cost,
        stock: form.stock,
        image_url: form.image_url || null,
      })

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
      return
    }

    toast({ title: "Item created" })
    setOpen(false)
    setForm({ name: "", description: "", xp_cost: 100, stock: -1, image_url: "" })
    await loadItems()
  }

  const toggleActive = async (item: StoreItem) => {
    await supabase
      .from("store_items")
      .update({ is_active: !item.is_active })
      .eq("id", item.id)
    await loadItems()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Store Items</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add Item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Store Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label>XP Cost</Label>
                <Input type="number" value={form.xp_cost} onChange={(e) => setForm({ ...form, xp_cost: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Stock (-1 for unlimited)</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Image URL</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
              </div>
              <Button onClick={handleSave} className="w-full">Create Item</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>XP Cost</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.xp_cost}</TableCell>
                  <TableCell>{item.stock === -1 ? "∞" : item.stock}</TableCell>
                  <TableCell>
                    <span className={item.is_active ? "text-green-600" : "text-red-600"}>
                      {item.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => toggleActive(item)}>
                      {item.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
