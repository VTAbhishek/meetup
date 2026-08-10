import { useEffect, useRef } from 'react'
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, RemoveFormatting, Baseline, Highlighter,
} from 'lucide-react'

const FONTS = ['Inter', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS']
const SIZES = [
  { v: '2', label: 'Small' },
  { v: '3', label: 'Normal' },
  { v: '4', label: 'Large' },
  { v: '5', label: 'X-Large' },
  { v: '6', label: 'Huge' },
]

/**
 * Lightweight Word-style rich text editor (contentEditable + execCommand).
 * Toolbar: font family, size, bold/italic/underline/strike, text colour,
 * highlight, lists, alignment, clear formatting.
 *
 * Uncontrolled: `initialHtml` seeds the content; every input calls
 * onChange(html) with the current markup.
 */
export default function RichTextEditor({ initialHtml = '', onChange, placeholder = 'Write about your company…' }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml || ''
    // Style with inline CSS so colours/fonts survive as style="" attributes.
    try { document.execCommand('styleWithCSS', false, true) } catch { /* older engines */ }
    // Seed once per mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emit = () => onChange?.(ref.current?.innerHTML ?? '')

  const exec = (cmd, val = null) => {
    ref.current?.focus()
    document.execCommand(cmd, false, val)
    emit()
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2">
        <select
          onChange={(e) => { if (e.target.value) exec('fontName', e.target.value); e.target.value = '' }}
          defaultValue=""
          className="rounded-lg border border-slate-300 bg-white py-1.5 pl-2 pr-6 text-xs font-medium text-slate-700 focus:outline-none"
          title="Font"
        >
          <option value="" disabled>Font</option>
          {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>

        <select
          onChange={(e) => { if (e.target.value) exec('fontSize', e.target.value); e.target.value = '' }}
          defaultValue=""
          className="rounded-lg border border-slate-300 bg-white py-1.5 pl-2 pr-6 text-xs font-medium text-slate-700 focus:outline-none"
          title="Text size"
        >
          <option value="" disabled>Size</option>
          {SIZES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>

        <Divider />
        <Btn title="Bold" onClick={() => exec('bold')}><Bold size={15} /></Btn>
        <Btn title="Italic" onClick={() => exec('italic')}><Italic size={15} /></Btn>
        <Btn title="Underline" onClick={() => exec('underline')}><Underline size={15} /></Btn>
        <Btn title="Strikethrough" onClick={() => exec('strikeThrough')}><Strikethrough size={15} /></Btn>

        <Divider />
        {/* Text colour */}
        <label className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200" title="Text colour">
          <Baseline size={15} />
          <input
            type="color"
            defaultValue="#7C3AED"
            onChange={(e) => exec('foreColor', e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        {/* Highlight colour */}
        <label className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200" title="Highlight colour">
          <Highlighter size={15} />
          <input
            type="color"
            defaultValue="#fde68a"
            onChange={(e) => exec('hiliteColor', e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>

        <Divider />
        <Btn title="Bulleted list" onClick={() => exec('insertUnorderedList')}><List size={15} /></Btn>
        <Btn title="Numbered list" onClick={() => exec('insertOrderedList')}><ListOrdered size={15} /></Btn>

        <Divider />
        <Btn title="Align left" onClick={() => exec('justifyLeft')}><AlignLeft size={15} /></Btn>
        <Btn title="Align centre" onClick={() => exec('justifyCenter')}><AlignCenter size={15} /></Btn>
        <Btn title="Align right" onClick={() => exec('justifyRight')}><AlignRight size={15} /></Btn>

        <Divider />
        <Btn title="Clear formatting" onClick={() => exec('removeFormat')}><RemoveFormatting size={15} /></Btn>
      </div>

      {/* Editing surface */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder}
        className="rte-surface min-h-[180px] max-h-96 overflow-y-auto px-4 py-3 text-slate-800 outline-none"
      />
    </div>
  )
}

function Btn({ title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault() /* keep the text selection */}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200"
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" />
}
