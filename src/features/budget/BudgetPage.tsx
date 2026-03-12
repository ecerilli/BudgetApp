export function BudgetPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
        <p className="text-sm text-muted-foreground">
          Manage recurring expenses and income projections.
        </p>
      </div>

      {/* Budget items CRUD will be added in Phase D */}
      <p className="text-sm text-muted-foreground">
        No budget items yet. Add your first item to start planning.
      </p>
    </div>
  )
}
