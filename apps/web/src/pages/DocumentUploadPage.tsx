import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Flame,
  FileText,
  Link as LinkIcon,
  Plus,
  X,
  Loader2,
  Sparkles,
  Globe,
  ChevronRight,
} from 'lucide-react'
import { getDocuments, addDocument, deleteDocument, getForge, getToolConfig } from '../lib/api'

export default function DocumentUploadPage() {
  const { forgeId } = useParams<{ forgeId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [inputMode, setInputMode] = useState<'text' | 'url'>('text')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const { data: forge } = useQuery({
    queryKey: ['forge', forgeId],
    queryFn: () => getForge(forgeId!),
  })

  const { data: existingTool } = useQuery({
    queryKey: ['tool', forgeId],
    queryFn: () => getToolConfig(forgeId!),
    retry: false,
  })

  const hasExistingTool = !!existingTool

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents', forgeId],
    queryFn: () => getDocuments(forgeId!),
  })

  const addMutation = useMutation({
    mutationFn: () => addDocument(forgeId!, { type: inputMode, title, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', forgeId] })
      setTitle('')
      setContent('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => deleteDocument(forgeId!, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', forgeId] })
    },
  })

  const canAdd = title.trim() && content.trim() && !addMutation.isPending

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/50">
        <div className="px-6 py-3 flex items-center gap-4">
          <Link
            to={hasExistingTool ? `/forge/${forgeId}/tool` : `/forge/${forgeId}/interview`}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="font-medium">{forge?.expertName || 'Expert'}</span>
          </div>
          <span className="text-slate-500 text-sm ml-auto">Supporting Documents</span>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Add Supporting Documents</h1>
          <p className="text-slate-400">
            Optionally add text notes or URLs that contain relevant information.
            These will be included when generating your interactive tool.
          </p>
        </div>

        {/* Input mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setInputMode('text')}
            className={`flex items-center gap-2 px-4 py-2  text-sm transition-colors ${
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
            className={`flex items-center gap-2 px-4 py-2  text-sm transition-colors ${
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
        <div className="bg-slate-800/50 border border-slate-700/50  p-5 mb-6 space-y-4">
          <div>
            <label className="text-sm text-slate-300 font-medium mb-1.5 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={inputMode === 'text' ? 'e.g. Additional notes on food safety' : 'e.g. USDA Food Bank Guidelines'}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50  text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition-colors"
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
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50  text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition-colors resize-none"
              />
            ) : (
              <input
                type="url"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="https://example.com/resource"
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50  text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition-colors"
              />
            )}
          </div>
          <button
            onClick={() => addMutation.mutate()}
            disabled={!canAdd}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed  text-sm transition-colors"
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
        {docs.length > 0 && (
          <div className="space-y-2 mb-8">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Added Documents ({docs.length})
            </h3>
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 bg-slate-800/30 border border-slate-700/30 "
              >
                {doc.type === 'url' ? (
                  <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{doc.title}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {doc.type === 'url' ? doc.content : `${doc.content.length} characters`}
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(doc.id)}
                  disabled={deleteMutation.isPending}
                  className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Continue button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
          <Link
            to={hasExistingTool ? `/forge/${forgeId}/tool` : `/forge/${forgeId}/interview`}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            {hasExistingTool ? 'Back to Tool' : 'Back to Interview'}
          </Link>
          <button
            onClick={() => navigate(`/forge/${forgeId}/tool`)}
            className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700  transition-colors font-medium"
          >
            <Sparkles className="w-5 h-5" />
            {hasExistingTool ? 'Back to Tool' : 'Generate Interactive Tool'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
