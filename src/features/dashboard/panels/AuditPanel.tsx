import { Panel } from '@/components/ui/Panel'

type AuditEvent = {
  action: string
  actorWorkosUserId: string
  createdAt: number
  id: string
  targetId: string
  targetType: string
}

type AuditPanelProps = {
  canReadAudit: boolean
  events: AuditEvent[] | undefined
}

export function AuditPanel({ canReadAudit, events }: AuditPanelProps) {
  return (
    <Panel
      description="Immutable audit trail for privileged and lifecycle mutations."
      title="Audit Events"
    >
      {!canReadAudit ? (
        <p className="text-sm text-amber-200">Permission denied. audit.read is required.</p>
      ) : (
        <>
          {events === undefined ? <p className="text-sm text-slate-300">Loading audit events...</p> : null}
          {events?.length === 0 ? <p className="text-sm text-slate-300">No audit events yet.</p> : null}

          {events && events.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.14em] text-slate-400">
                    <th className="pb-3">Timestamp</th>
                    <th className="pb-3">Action</th>
                    <th className="pb-3">Actor</th>
                    <th className="pb-3">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-200">
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td className="py-3">{new Date(event.createdAt).toISOString()}</td>
                      <td className="py-3">{event.action}</td>
                      <td className="py-3">
                        <code className="app-code">{event.actorWorkosUserId}</code>
                      </td>
                      <td className="py-3">
                        <code className="app-code">
                          {event.targetType}:{event.targetId}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  )
}
