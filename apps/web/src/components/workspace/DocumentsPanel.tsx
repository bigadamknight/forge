import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Link as LinkIcon, Plus, X, Loader2, Globe, Pencil, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { getDocuments, addDocument, deleteDocument, updateDocument } from '../../lib/api'

interface DocumentsPanelProps {
  forgeId: string
}

export default function DocumentsPanel({ forgeId }: DocumentsPanelProps) {
  const queryClient = useQueryClient()
  const [inputMode, setInputMode] = useState<'text' | 'url'>('text')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [origTitle, setOrigTitle] = useState('')
  const [origContent, setOrigContent] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents', forgeId],
    queryFn: () => getDocuments(forgeId),
  })

  const addMutation = useMutation({
    mutationFn: () => addDocument(forgeId, { type: inputMode, title, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', forgeId] })
      setTitle('')
      setContent('')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ docId, data }: { docId: string; data: { title?: string; content?: string } }) =>
      updateDocument(forgeId, docId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', forgeId] })
      setSavedId(variables.docId)
      setEditingId(null)
      setTimeout(() => setSavedId(null), 2000)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => deleteDocument(forgeId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', forgeId] })
    },
  })

  const canAdd = title.trim() && content.trim() && !addMutation.isPending

  const startEditing = (doc: { id: string; title: string; content: string }) => {
    setEditingId(doc.id)
    setEditTitle(doc.title)
    setEditContent(doc.content)
    setOrigTitle(doc.title)
    setOrigContent(doc.content)
  }

  const editDirty = editTitle !== origTitle || editContent !== origContent

  const saveEdit = () => {
    if (!editingId || !editTitle.trim() || !editDirty) return
    updateMutation.mutate({
      docId: editingId,
      data: { title: editTitle, content: editContent },
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-1">Documents</h2>
        <p className="text-slate-400 text-sm">
          Add text notes or URLs with relevant information to enrich your tool.
        </p>
      </div>

      {/* Input mode toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setInputMode('text')}
          className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
            inputMode === 'text'
              ? 'bg-orange-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-600'
          }`}
        >
          <FileText className="w-4 h-4" />
          Text
        </button>
        <button
          onClick={() => setInputMode('url')}
          className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
            inputMode === 'url'
              ? 'bg-orange-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-600'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          URL
        </button>
      </div>

      {/* Input form */}
      <div className="bg-slate-800/50 border border-slate-700/50 p-5 mb-6 space-y-4">
        <div>
          <label className="text-sm text-slate-300 font-medium mb-1.5 block">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={inputMode === 'text' ? 'e.g. Additional notes on food safety' : 'e.g. USDA Food Bank Guidelines'}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-sm text-slate-300 font-medium mb-1.5 block">
            {inputMode === 'text' ? 'Content' : 'URL'}
          </label>
          {inputMode === 'text' ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your text content here..."
              rows={6}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition-colors resize-none"
            />
          ) : (
            <input
              type="url"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="https://example.com/resource"
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition-colors"
            />
          )}
        </div>
        <button
          onClick={() => addMutation.mutate()}
          disabled={!canAdd}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-colors"
        >
          {addMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Add Document
        </button>
        {addMutation.isError && (
          <p className="text-red-400 text-xs">
            Failed to add document: {addMutation.error.message}
          </p>
        )}
      </div>

      {/* Document list */}
      {isLoading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading documents...
        </div>
      )}
      {docs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Added Documents ({docs.length})
          </h3>
          {docs.map((doc) => (
            <div key={doc.id}>
              {editingId === doc.id ? (
                <div className="bg-slate-800/50 border border-orange-500/30 p-4 space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      {doc.type === 'url' ? 'URL' : 'Content'}
                    </label>
                    {doc.type === 'url' ? (
                      <input
                        type="url"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
                      />
                    ) : (
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors resize-none"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={!editTitle.trim() || !editDirty || updateMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`border transition-colors ${
                  savedId === doc.id
                    ? 'bg-green-500/5 border-green-500/30'
                    : 'bg-slate-800/30 border-slate-700/30'
                }`}>
                  <div className="flex items-center gap-3 px-4 py-3 group">
                    {doc.type === 'url' ? (
                      <button
                        onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                        className="text-blue-400 hover:text-blue-300 shrink-0 transition-colors"
                        title={doc.extractedContent ? 'View captured text' : 'No captured text'}
                      >
                        {expandedId === doc.id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{doc.title}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {doc.type === 'url' ? doc.content : `${doc.content.length} characters`}
                      </div>
                    </div>
                    {savedId === doc.id && (
                      <span className="text-xs text-green-400 shrink-0">Saved</span>
                    )}
                    {doc.type === 'url' && doc.extractedContent && (
                      <span className="text-[10px] text-slate-600 shrink-0">
                        {doc.extractedContent.length.toLocaleString()} chars
                      </span>
                    )}
                    <button
                      onClick={() => startEditing(doc)}
                      className="text-slate-600 hover:text-orange-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(doc.id)}
                      disabled={deleteMutation.isPending}
                      className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {expandedId === doc.id && doc.type === 'url' && (
                    <div className="px-4 pb-4 pt-0">
                      {doc.extractedContent ? (
                        <pre className="text-xs text-slate-400 bg-slate-900/50 border border-slate-700/30 p-3 max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono leading-relaxed">
                          {doc.extractedContent}
                        </pre>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No content was captured from this URL.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!isLoading && docs.length === 0 && (
        <p className="text-slate-500 text-sm">No documents added yet.</p>
      )}
    </div>
  )
}
