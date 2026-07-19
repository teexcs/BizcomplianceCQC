import { requireOrgSession } from '@/lib/data/session';
import { getActionPlan } from '@/lib/data/action-plan';
import { ActionPlanView } from '@/components/dashboard/action-plan';

export const dynamic = 'force-dynamic';

export default async function ActionPlanPage() {
  const ctx = await requireOrgSession();
  const plan = await getActionPlan(ctx.org.id);

  return (
    <div className="space-y-6">
      <div className="space-y-1 border-b border-border/70 pb-6">
        <h1 className="font-display text-3xl tracking-tight">Action Plan</h1>
        <p className="text-sm text-muted-foreground">
          This week — the prioritised things to keep you inspection-ready, in plain English. Tick
          them off as you go.
        </p>
      </div>

      <ActionPlanView plan={plan} />
    </div>
  );
}
