import { Dialog } from 'radix-ui'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { useReview } from '@/lib/appStore'
import type { AlertStatus } from '@/lib/data'

export const REJECT_REASONS = [
  'Not a road (field edge, canal, embankment)',
  'Seasonal track or mud',
  'Existing road (misregistration)',
  'Cloud or shadow artefact',
  'Other',
]

const DONE: Record<AlertStatus, string> = { accepted: 'Accepted', rejected: 'Rejected', flagged: 'Flagged for field check', pending: 'Reopened' }

/** Applies a review decision with an Undo toast. Labels match the button verbs. */
export function useReviewAction() {
  const setStatus = useReview((s) => s.setStatus)
  const overrides = useReview((s) => s.overrides)
  return (ids: string[], status: AlertStatus, original: Record<string, AlertStatus>, reason?: string) => {
    const before = Object.fromEntries(ids.map((id) => [id, overrides[id]?.status ?? original[id] ?? 'pending'])) as Record<string, AlertStatus>
    setStatus(ids, status, reason)
    toast(`${DONE[status]} ${ids.length === 1 ? ids[0] : `${ids.length} alerts`}`, {
      description: reason,
      action: {
        label: 'Undo',
        onClick: () => {
          const groups = new Map<AlertStatus, string[]>()
          for (const id of ids) groups.set(before[id], [...(groups.get(before[id]) ?? []), id])
          groups.forEach((g, st) => setStatus(g, st, 'Undo'))
        },
      },
    })
  }
}

export function RejectDialog({ open, onOpenChange, count, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; count: number; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState(REJECT_REASONS[0])
  const [note, setNote] = useState('')
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line-strong bg-surface2 p-5 shadow-[var(--shadow-panel)]">
          <Dialog.Title className="text-[16px] font-medium text-fg">Reject {count === 1 ? 'this alert' : `${count} alerts`}</Dialog.Title>
          <Dialog.Description className="mt-1 text-[13px] text-muted">The reason becomes a training label, so the model learns from the mistake.</Dialog.Description>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              onConfirm(reason === 'Other' && note ? note : reason)
              onOpenChange(false)
              setNote('')
            }}
          >
            <fieldset className="space-y-1.5">
              <legend className="sr-only">Reason</legend>
              {REJECT_REASONS.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2.5 rounded-[8px] border border-line px-3 py-2 text-[14px] text-fg has-[:checked]:border-sentinel/60 has-[:checked]:bg-sentinel/5">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--sentinel)]" />
                  {r}
                </label>
              ))}
            </fieldset>
            {reason === 'Other' && (
              <input
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Describe what it is"
                className="h-10 w-full rounded-[8px] border border-line-strong bg-bg0 px-3 text-[14px] text-fg outline-none placeholder:text-muted focus:border-sentinel"
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <Button variant="ghost">Cancel</Button>
              </Dialog.Close>
              <Button type="submit" variant="danger">
                Reject
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
