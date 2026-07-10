'use client';

import { useId, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveSocialProfiles } from '@/lib/actions/client';
import type { SocialProfile, SocialProfileCategory } from '@/types/database';

type SocialDraft = {
  id: string;
  category: SocialProfileCategory;
  platform: string;
  label: string;
  handle: string;
  url: string;
  notes: string;
};

const CATEGORY_META: Record<
  SocialProfileCategory,
  { title: string; help: string; placeholder: string }
> = {
  social: {
    title: 'Social platforms',
    help: 'Facebook, Instagram, TikTok, LinkedIn, X and similar public profiles.',
    placeholder: 'Facebook, Instagram, TikTok, LinkedIn...',
  },
  messaging: {
    title: 'Messaging channels',
    help: 'WhatsApp, Messenger, SMS, live chat and other contact channels.',
    placeholder: 'WhatsApp, Messenger, live chat...',
  },
  reviews: {
    title: 'Reviews and listings',
    help: 'Google Business Profile, Trustpilot, Yell, care directories and review sites.',
    placeholder: 'Google Business Profile, Trustpilot, Yell...',
  },
  directory: {
    title: 'Directories and listings',
    help: 'Professional or care directories, inspection profiles and listings.',
    placeholder: 'Care directory, local listing...',
  },
  other: {
    title: 'Other online accounts',
    help: 'Anything else an admin should know about.',
    placeholder: 'Podcast, newsletter, portal, other account...',
  },
};

const CATEGORY_ORDER: SocialProfileCategory[] = ['social', 'messaging', 'reviews', 'directory', 'other'];

function toDraft(profile: SocialProfile): SocialDraft {
  return {
    id: profile.id,
    category: profile.category,
    platform: profile.platform,
    label: profile.label ?? '',
    handle: profile.handle ?? '',
    url: profile.url ?? '',
    notes: profile.notes ?? '',
  };
}

export function SocialProfilesForm({ initialProfiles }: { initialProfiles: SocialProfile[] }) {
  const reactId = useId();
  const nextId = useRef(0);
  const [profiles, setProfiles] = useState<SocialDraft[]>(
    initialProfiles.length ? initialProfiles.map(toDraft) : [makeDraft('social')],
  );
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function makeDraft(category: SocialProfileCategory): SocialDraft {
    return {
      id: `${reactId}-${nextId.current++}`,
      category,
      platform: '',
      label: '',
      handle: '',
      url: '',
      notes: '',
    };
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: profiles.filter((profile) => profile.category === category),
  }));

  const addRow = (category: SocialProfileCategory) => {
    setProfiles((current) => [...current, makeDraft(category)]);
  };

  const updateRow = (id: string, key: keyof SocialDraft, value: string) => {
    setProfiles((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const removeRow = (id: string) => {
    setProfiles((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const payload = CATEGORY_ORDER.flatMap((category) =>
      profiles
        .filter((row) => row.category === category)
        .map((row) => ({
          category: row.category,
          platform: row.platform.trim(),
          label: row.label.trim(),
          handle: row.handle.trim(),
          url: row.url.trim(),
          notes: row.notes.trim(),
        }))
        .filter((row) => row.platform || row.handle || row.url || row.notes || row.label),
    );

    const result = await saveSocialProfiles({ profiles: payload });
    setStatus(
      result.ok
        ? { tone: 'ok', text: 'Social profiles saved.' }
        : { tone: 'error', text: result.error ?? 'Could not save social profiles.' },
    );
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="rounded-none border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Add every handle you use. Keep platforms grouped so admin can see the full picture quickly.
      </div>

      <div className="space-y-5">
        {grouped.map(({ category, items }) => {
          const meta = CATEGORY_META[category];
          return (
            <section key={category} className="rounded-none border border-border bg-background">
              <div className="border-b border-border/70 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg tracking-tight">{meta.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{meta.help}</p>
                </div>
                <button
                  type="button"
                  onClick={() => addRow(category)}
                  className="inline-flex items-center gap-2 rounded-none border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <Plus size={14} aria-hidden="true" /> Add entry
                </button>
              </div>

              <div className="space-y-4 p-4">
                {items.length ? (
                  items.map((row) => (
                    <div key={row.id} className="rounded-none border border-border bg-muted/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid flex-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`${row.id}-platform`}>Platform / channel</Label>
                            <Input
                              id={`${row.id}-platform`}
                              value={row.platform}
                              onChange={(e) => updateRow(row.id, 'platform', e.target.value)}
                              placeholder={meta.placeholder}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${row.id}-label`}>Label</Label>
                            <Input
                              id={`${row.id}-label`}
                              value={row.label}
                              onChange={(e) => updateRow(row.id, 'label', e.target.value)}
                              placeholder="Main page, branch page, bookings, etc."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${row.id}-handle`}>Handle / page name</Label>
                            <Input
                              id={`${row.id}-handle`}
                              value={row.handle}
                              onChange={(e) => updateRow(row.id, 'handle', e.target.value)}
                              placeholder="@name or page name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${row.id}-url`}>URL</Label>
                            <Input
                              id={`${row.id}-url`}
                              value={row.url}
                              onChange={(e) => updateRow(row.id, 'url', e.target.value)}
                              placeholder="https://..."
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor={`${row.id}-notes`}>Notes</Label>
                            <Textarea
                              id={`${row.id}-notes`}
                              value={row.notes}
                              onChange={(e) => updateRow(row.id, 'notes', e.target.value)}
                              placeholder="Notes for admin, login owner, posting frequency, password changes, etc."
                              className="min-h-20 rounded-none"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-none border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="Remove social profile"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-none border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                    No entries yet. Add one for this category if you use it.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {status ? (
        <p role={status.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${status.tone === 'ok' ? 'text-green-700' : 'text-destructive'}`}>
          {status.text}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-none bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Saving social profiles…' : 'Save social profiles'}
      </button>
    </form>
  );
}
