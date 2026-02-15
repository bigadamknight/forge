import { Plus, X } from 'lucide-react'

interface EditableListProps<T> {
  items: T[]
  onChange: (items: T[]) => void
  editMode?: boolean
  renderItem: (item: T, index: number) => React.ReactNode
  createItem: () => T
  itemLabel?: string
}

export default function EditableList<T>({
  items,
  onChange,
  editMode = false,
  renderItem,
  createItem,
  itemLabel = 'item',
}: EditableListProps<T>) {
  const handleDelete = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const handleAdd = () => {
    onChange([...items, createItem()])
  }

  return (
    <>
      {items.map((item, idx) => (
        <div key={idx} className={editMode ? 'group relative' : ''}>
          {renderItem(item, idx)}
          {editMode && (
            <button
              onClick={() => handleDelete(idx)}
              className="absolute -right-2 -top-2 w-5 h-5 bg-red-500/80 hover:bg-red-500  flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          )}
        </div>
      ))}
      {editMode && (
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-dashed border-blue-500/30 transition-colors mt-2"
        >
          <Plus className="w-3.5 h-3.5" />
          Add {itemLabel}
        </button>
      )}
    </>
  )
}
