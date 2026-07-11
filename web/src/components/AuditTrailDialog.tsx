import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useTransactionAudit } from "@/hooks/queries";
import { formatDate } from "@/lib/format";

export function AuditTrailDialog({ transactionId, onClose }: { transactionId: string | null; onClose: () => void }) {
  const { data: logs, isLoading } = useTransactionAudit(transactionId);

  return (
    <Dialog open={!!transactionId} onClose={onClose} title="Audit trail" description="Every change to this transaction is recorded.">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : !logs || logs.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No audit entries.</p>
      ) : (
        <ul className="max-h-[50vh] space-y-3 overflow-y-auto">
          {logs.map((log) => (
            <li key={log.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <Badge
                  variant={
                    log.action === "create" ? "success" : log.action === "delete" ? "destructive" : "default"
                  }
                >
                  {log.action}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatDate(log.changedAt.slice(0, 10))}</span>
              </div>
              {log.fieldChanged && (
                <div className="mt-2 text-muted-foreground">
                  <span className="font-medium text-foreground">{log.fieldChanged}</span>:{" "}
                  <span className="line-through">{log.oldValue ?? "∅"}</span> → <span>{log.newValue ?? "∅"}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
