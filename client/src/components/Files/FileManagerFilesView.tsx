import { Fragment } from 'react'
import { Upload, FileText, Star, Link2, Trash2 } from 'lucide-react'
import type { FileManagerState } from './useFileManager'
import { FileRow } from './FileManagerRow'
import { usePluginViewContributions, PluginCardFooter } from '../Plugins/PluginContributions'
import { GoogleLinkExternalIcon, GoogleLinkIcon } from './GoogleLinkModal'

export function FilesView(S: FileManagerState) {
  const {
    can, trip, getRootProps, getInputProps, isDragActive, uploading, t, allowedFileTypes,
    files, filterType, setFilterType, filteredFiles, links, setShowLinkModal, can: canDo, deleteLink,
  } = S
  const contribFor = usePluginViewContributions('files', S.tripId)
  return (
    <>
      {/* Upload zone */}
      {can('file_upload', trip) && <div
        {...getRootProps()}
        style={{
          margin: '16px 28px 0', border: '2px dashed', borderRadius: 14, padding: '20px 16px',
          textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
          borderColor: isDragActive ? 'var(--text-secondary)' : 'var(--border-primary)',
          background: isDragActive ? 'var(--bg-secondary)' : 'var(--bg-card)',
        }}
      >
        <input {...getInputProps()} />
        <Upload size={24} style={{ margin: '0 auto 8px', color: isDragActive ? 'var(--text-secondary)' : 'var(--text-faint)', display: 'block' }} />
        {uploading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 'calc(13px * var(--fs-scale-body, 1))', color: 'var(--text-secondary)' }}>
            <div style={{ width: 14, height: 14, border: '2px solid var(--text-secondary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            {t('files.uploading')}
          </div>
        ) : (
          <>
            <p style={{ fontSize: 'calc(13px * var(--fs-scale-body, 1))', color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>{t('files.dropzone')}</p>
            <p style={{ fontSize: 'calc(11.5px * var(--fs-scale-caption, 1))', color: 'var(--text-faint)', marginTop: 3 }}>{t('files.dropzoneHint')}</p>
            <p style={{ fontSize: 'calc(10px * var(--fs-scale-caption, 1))', color: 'var(--text-faint)', marginTop: 6, opacity: 0.7 }}>
              {(allowedFileTypes || 'jpg,jpeg,png,gif,webp,heic,pdf,doc,docx,xls,xlsx,txt,csv').toUpperCase().split(',').join(', ')} · Max 50 MB
            </p>
          </>
        )}
      </div>}

      {/* Filter tabs */}
      <div className="md:!hidden" style={{ display: 'flex', gap: 4, padding: '12px 16px 0', flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: t('files.filterAll') },
          ...(files.some(f => f.starred) ? [{ id: 'starred', icon: Star }] : []),
          { id: 'pdf', label: t('files.filterPdf') },
          { id: 'image', label: t('files.filterImages') },
          { id: 'doc', label: t('files.filterDocs') },
          ...(files.some(f => f.note_id) ? [{ id: 'collab', label: t('files.filterCollab') || 'Collab' }] : []),
        ].map(tab => (
          <button key={tab.id} onClick={() => setFilterType(tab.id)} style={{
            padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 'calc(12px * var(--fs-scale-body, 1))',
            fontFamily: 'inherit', transition: 'all 0.12s',
            background: filterType === tab.id ? 'var(--accent)' : 'transparent',
            color: filterType === tab.id ? 'var(--accent-text)' : 'var(--text-muted)',
            fontWeight: filterType === tab.id ? 600 : 400,
          }}>{tab.icon ? <tab.icon size={13} fill={filterType === tab.id ? '#facc15' : 'none'} color={filterType === tab.id ? '#facc15' : 'currentColor'} /> : tab.label}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 'calc(11.5px * var(--fs-scale-caption, 1))', color: 'var(--text-faint)', alignSelf: 'center' }}>
          {filteredFiles.length === 1 ? t('files.countSingular') : t('files.count', { count: filteredFiles.length })}
        </span>
      </div>

      <section style={{ padding: '16px 28px 0' }} className="max-md:!px-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-content">Google links</h3>
          {canDo('file_upload', trip) && <button onClick={() => setShowLinkModal(true)} className="inline-flex items-center gap-1 text-xs text-content-muted"><Link2 size={13} /> Add link</button>}
        </div>
        {links.length > 0 && <div className="flex flex-col gap-2">
          {links.map(link => <div key={link.id} className="flex items-center gap-3 rounded-xl border border-edge bg-surface-card px-3 py-2">
              <span className="text-content-muted"><GoogleLinkIcon provider={link.provider} /></span>
              <div className="min-w-0 flex-1">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-content hover:underline truncate">{link.title} <GoogleLinkExternalIcon /></a>
                {link.description && <p className="text-xs text-content-faint truncate">{link.description}</p>}
              </div>
              {canDo('file_delete', trip) && <button onClick={() => deleteLink(link.id)} aria-label={`Remove ${link.title}`} className="p-1 text-content-faint hover:text-red-500"><Trash2 size={15} /></button>}
            </div>)}
        </div>}
      </section>

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 28px 16px' }} className="max-md:!px-4">
        {filteredFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-faint)' }}>
            <FileText size={40} style={{ color: 'var(--text-faint)', display: 'block', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 'calc(14px * var(--fs-scale-body, 1))', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 4px' }}>{t('files.empty')}</p>
            <p style={{ fontSize: 'calc(13px * var(--fs-scale-body, 1))', color: 'var(--text-faint)', margin: 0 }}>{t('files.emptyHint')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredFiles.map(file => {
              const contributions = contribFor(file.id)
              return (
                <Fragment key={file.id}>
                  <FileRow {...S} file={file} />
                  {contributions.length > 0 && <div style={{ padding: '0 4px' }}><PluginCardFooter items={contributions} tripId={S.tripId} /></div>}
                </Fragment>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
