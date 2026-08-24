import { ExternalLink, FileText, HardDrive, Table2 } from 'lucide-react'
import Modal from '../shared/Modal'
import type { FileManagerState } from './useFileManager'

export function GoogleLinkModal(S: FileManagerState) {
  const { showLinkModal, closeLinkModal, createLink, linkTitle, setLinkTitle, linkUrl, setLinkUrl, linkDescription, setLinkDescription } = S
  return (
    <Modal isOpen={showLinkModal} onClose={closeLinkModal} title="Add Google link" footer={
      <div className="flex justify-end gap-2">
        <button type="button" onClick={closeLinkModal} className="px-4 py-2 rounded-lg border border-edge text-content-secondary">Cancel</button>
        <button form="google-link-form" type="submit" className="px-4 py-2 rounded-lg bg-accent text-accent-text font-medium">Add link</button>
      </div>
    }>
      <form id="google-link-form" onSubmit={createLink} className="space-y-4">
        <label className="block text-sm font-medium text-content">Title
          <input required maxLength={200} value={linkTitle} onChange={e => setLinkTitle(e.target.value)} placeholder="Trip itinerary" className="mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-content" />
        </label>
        <label className="block text-sm font-medium text-content">Google URL
          <input required type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://docs.google.com/..." className="mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-content" />
        </label>
        <label className="block text-sm font-medium text-content">Description
          <textarea value={linkDescription} onChange={e => setLinkDescription(e.target.value)} placeholder="Optional context" rows={3} className="mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-content" />
        </label>
        <p className="text-xs text-content-faint">Only secure Google Drive, Docs, and Sheets links are accepted.</p>
      </form>
    </Modal>
  )
}

export function GoogleLinkIcon({ provider }: { provider: FileManagerState['links'][number]['provider'] }) {
  if (provider === 'google-sheets') return <Table2 size={22} />
  if (provider === 'google-docs') return <FileText size={22} />
  return <HardDrive size={22} />
}

export function GoogleLinkExternalIcon() { return <ExternalLink size={14} /> }
