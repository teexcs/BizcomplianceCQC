'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/data/session';
import { createClient } from '@/lib/supabase/server';
import {
  runAutopilotApply,
  type AutopilotStats,
  type ApplyStats,
} from '@/lib/engine/autopilot';
import { runReaderSuggest } from '@/lib/engine/reader/adapter';

export interface EngineActionResult {
  ok: boolean;
  error?: string;
  suggest?: AutopilotStats;
  apply?: ApplyStats;
}

/** Scan the vault and write suggestions onto every undecided checklist item. */
export async function engineSuggest(auditId: string): Promise<EngineActionResult> {
  await requireAdminSession();
  try {
    const suggest = await runReaderSuggest(auditId);
    revalidatePath(`/admin/audits/${auditId}`);
    return { ok: true, suggest };
  } catch (e) {
    console.error('[engine] suggest failed', e);
    return { ok: false, error: 'Engine run failed — try again.' };
  }
}

/** Apply all suggestions, RAG areas, draft findings and rescore. */
export async function engineApply(auditId: string): Promise<EngineActionResult> {
  await requireAdminSession();
  try {
    const apply = await runAutopilotApply(auditId);
    revalidatePath(`/admin/audits/${auditId}`);
    revalidatePath('/admin/audits');
    return { ok: true, apply };
  } catch (e) {
    console.error('[engine] apply failed', e);
    return { ok: false, error: 'Applying suggestions failed — try again.' };
  }
}

/** Accept one item's suggestion. */
export async function acceptSuggestion(itemId: string): Promise<EngineActionResult> {
  await requireAdminSession();
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from('audit_items')
    .select('id, audit_id, status, suggested_status, suggested_evidence_id, suggestion_reason, note')
    .eq('id', itemId)
    .single<{
      id: string;
      audit_id: string;
      status: string;
      suggested_status: string;
      suggested_evidence_id: string | null;
      suggestion_reason: string | null;
      note: string | null;
    }>();
  if (error || !item) return { ok: false, error: 'Item not found.' };
  if (item.suggested_status === 'unset') return { ok: false, error: 'Nothing suggested for this item.' };

  const { error: upError } = await supabase
    .from('audit_items')
    .update({
      status: item.suggested_status,
      evidence_id: item.suggested_evidence_id,
      note: item.note ?? item.suggestion_reason,
    })
    .eq('id', itemId);
  if (upError) return { ok: false, error: 'Could not accept the suggestion.' };

  revalidatePath(`/admin/audits/${item.audit_id}`);
  return { ok: true };
}

/** Clear one item's suggestion (human disagrees). */
export async function dismissSuggestion(itemId: string): Promise<EngineActionResult> {
  await requireAdminSession();
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from('audit_items')
    .update({
      suggested_status: 'unset',
      suggested_evidence_id: null,
      suggestion_confidence: null,
      suggestion_reason: null,
    })
    .eq('id', itemId)
    .select('audit_id')
    .single<{ audit_id: string }>();
  if (error || !item) return { ok: false, error: 'Could not dismiss the suggestion.' };

  revalidatePath(`/admin/audits/${item.audit_id}`);
  return { ok: true };
}
