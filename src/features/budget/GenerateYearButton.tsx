import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGenerateYear } from '@/hooks/useGenerateYear'
import { useBudgetItems } from '@/hooks/useBudgetItems'
import { toast } from 'sonner'

export function GenerateYearButton() {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const generateYear = useGenerateYear()
  const { data: items } = useBudgetItems()

  function handleGenerate() {
    if (!items || items.length === 0) {
      toast.error('Add budget items first')
      return
    }

    generateYear.mutate(
      { year, items },
      {
        onSuccess: (count) => {
          toast.success(`Generated and synced ${count} cash flow entries for ${year}`)
          setOpen(false)
        },
        onError: () => toast.error('Failed to generate entries'),
      }
    )
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Generate / Sync Year
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Cash Flow</DialogTitle>
            <DialogDescription>
              Create missing monthly entries and sync existing generated rows with current budget item names, categories, and budgeted amounts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="gen-year">Year</Label>
            <Input
              id="gen-year"
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
              min={2020}
              max={2050}
            />
            {items && (
              <p className="text-xs text-muted-foreground">
                {items.filter((i) => i.active).length} active items &middot;{' '}
                up to {items.filter((i) => i.active).reduce((s, i) => s + i.months_active.length, 0)} entries
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handleGenerate}
              disabled={generateYear.isPending}
            >
              {generateYear.isPending ? 'Generating...' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
