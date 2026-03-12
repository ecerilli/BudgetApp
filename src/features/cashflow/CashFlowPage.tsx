export function CashFlowPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cash Flow</h1>
        <p className="text-sm text-muted-foreground">
          Monthly view of projected and actual expenses.
        </p>
      </div>

      {/* Month navigation and entries will be added in Phase D */}
      <p className="text-sm text-muted-foreground">
        Generate entries from your budget to get started.
      </p>
    </div>
  )
}
