import { useRef, useLayoutEffect } from 'react'

type EditableTag = 'span' | 'p' | 'div' | 'h3' | 'h4' | 'label'

interface EditableTextProps {
  value: string
  onChange: (value: string) => void
  editMode?: boolean
  as?: EditableTag
  className?: string
  multiline?: boolean
}

export default function EditableText({
  value,
  onChange,
  editMode = false,
  as: Tag = 'span',
  className = '',
  multiline = false,
}: EditableTextProps) {
  const ref = useRef<HTMLElement>(null)
  const lastValueRef = useRef(value)

  // Set/sync content when editMode activates or value changes externally
  // useLayoutEffect prevents flash of empty content before paint
  useLayoutEffect(() => {
    if (!ref.current) return
    if (value !== lastValueRef.current || !ref.current.textContent) {
      ref.current.textContent = value
      lastValueRef.current = value
    }
  }, [value, editMode])

  if (!editMode) {
    return <Tag className={className}>{value}</Tag>
  }

  const handleBlur = () => {
    const text = ref.current?.textContent ?? ''
    if (text !== lastValueRef.current) {
      lastValueRef.current = text
      onChange(text)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault()
      ref.current?.blur()
    }
  }

  return (
    <Tag
      ref={ref as React.RefObject<never>}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`${className} outline-none border border-dashed border-blue-500/40 px-1 -mx-1 hover:border-blue-500/70 focus:border-blue-500 focus:bg-blue-500/5 transition-colors cursor-text`}
    />
  )
}
