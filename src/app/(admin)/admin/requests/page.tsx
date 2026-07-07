import { Card, CardContent } from '@/components/ui/card';
import { getAllRequests, getContactMessages } from '@/lib/data/admin';
import { RequestStatusSelect } from '@/components/admin/request-actions';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminRequestsPage() {
  const [requests, contacts] = await Promise.all([getAllRequests(), getContactMessages()]);
  const active = requests.filter((r) => ['open', 'in_review'].includes(r.status));
  const closed = requests.filter((r) => !['open', 'in_review'].includes(r.status));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Client requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Document requests, reviews and queries from clients. Status changes email the client.
        </p>
      </div>

      <section>
        <h2 className="font-display text-lg tracking-tight mb-3">
          Needs action <span className="text-sm text-muted-foreground font-sans">({active.length})</span>
        </h2>
        {active.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No open requests.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {active.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-medium flex-1 min-w-0">{r.type}</p>
                    <span
                      className={`text-xs font-semibold ${
                        r.priority === 'high'
                          ? 'text-red-400'
                          : r.priority === 'medium'
                            ? 'text-amber-300'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {r.priority} priority
                    </span>
                    <RequestStatusSelect requestId={r.id} status={r.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {r.description}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {r.organisation?.name ?? 'Unknown client'} · {formatDate(r.created_at)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Completed requests ({closed.length})
          </summary>
          <div className="grid gap-2 mt-3">
            {closed.slice(0, 20).map((r) => (
              <Card key={r.id}>
                <CardContent className="py-3 flex flex-wrap items-center gap-3">
                  <p className="text-sm flex-1 min-w-0 truncate">{r.type}</p>
                  <span className="text-xs text-muted-foreground">
                    {r.organisation?.name ?? ''} · {formatDate(r.created_at)}
                  </span>
                  <RequestStatusSelect requestId={r.id} status={r.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        </details>
      ) : null}

      <section>
        <h2 className="font-display text-lg tracking-tight mb-3">
          Website contact messages{' '}
          <span className="text-sm text-muted-foreground font-sans">({contacts.length})</span>
        </h2>
        {contacts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No contact form messages yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {contacts.slice(0, 20).map((m) => (
              <Card key={m.id}>
                <CardContent className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-medium flex-1 min-w-0">{m.subject}</p>
                    <span className="text-xs text-muted-foreground">{formatDate(m.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{m.message}</p>
                  <p className="mt-1.5 text-xs">
                    <a
                      href={`mailto:${m.email}`}
                      className="text-[hsl(220,60%,72%)] hover:underline"
                    >
                      {m.name} &lt;{m.email}&gt;
                    </a>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
