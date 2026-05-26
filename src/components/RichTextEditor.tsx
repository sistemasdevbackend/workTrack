import { useRef, useEffect, useCallback, useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, Code, Table,
  AlignLeft, AlignCenter, AlignRight,
  ImagePlus, X, Paperclip, FileText, FileSpreadsheet, File,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minRows?: number;
  pendingImages?: File[];
  onImagesChange?: (files: File[]) => void;
  onPasteImage?: (files: File[]) => void;
  pendingDocs?: File[];
  onDocsChange?: (files: File[]) => void;
}

const DOC_ICON_MAP: Record<string, React.ReactNode> = {};

function DocIcon({ file }: { file: File }) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={14} className="text-green-400 shrink-0" />;
  if (['pdf'].includes(ext)) return <FileText size={14} className="text-red-400 shrink-0" />;
  return <File size={14} className="text-blue-400 shrink-0" />;
}

const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'code', 'pre',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'p', 'br', 'div', 'span', 'h1', 'h2', 'h3',
]);

const ALLOWED_ATTRS = new Set(['class', 'style', 'colspan', 'rowspan']);

export function sanitizeHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  const clean = (node: Element) => {
    Array.from(node.children).forEach(child => {
      const tag = child.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        child.replaceWith(...Array.from(child.childNodes));
        return;
      }
      Array.from(child.attributes).forEach(attr => {
        if (!ALLOWED_ATTRS.has(attr.name)) child.removeAttribute(attr.name);
      });
      clean(child);
    });
  };

  clean(tmp);
  return tmp.innerHTML;
}

function ToolbarButton({
  title, active, onClick, children,
}: {
  title: string; active?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`p-1.5 rounded transition ${
        active
          ? 'bg-blue-500/30 text-blue-300'
          : 'text-slate-400 hover:text-white hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function insertTable(rows = 3, cols = 3) {
  const head = `<thead><tr>${Array(cols).fill('<th class="rt-th">Col</th>').join('')}</tr></thead>`;
  const body = Array(rows).fill(
    `<tr>${Array(cols).fill('<td class="rt-td">&nbsp;</td>').join('')}</tr>`
  ).join('');
  return `<table class="rt-table"><${head}<tbody>${body}</tbody></table><p><br></p>`;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escribe un comentario...',
  minRows = 4,
  pendingImages = [],
  onImagesChange,
  onPasteImage,
  pendingDocs = [],
  onDocsChange,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastHtml = useRef<string>(value);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  // Sync external value on mount only
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
      lastHtml.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncFormats = useCallback(() => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold'))          formats.add('bold');
    if (document.queryCommandState('italic'))        formats.add('italic');
    if (document.queryCommandState('underline'))     formats.add('underline');
    if (document.queryCommandState('strikeThrough')) formats.add('strikeThrough');
    setActiveFormats(formats);
  }, []);

  const handleInput = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? '';
    if (html !== lastHtml.current) {
      lastHtml.current = html;
      onChange(html === '<br>' ? '' : html);
    }
    syncFormats();
  }, [onChange, syncFormats]);

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    handleInput();
  };

  const insertCode = () => {
    const sel = window.getSelection();
    const text = sel?.toString() ?? '';
    const node = document.createElement('code');
    node.className = 'rt-code';
    node.textContent = text || 'code';
    sel?.getRangeAt(0)?.deleteContents();
    sel?.getRangeAt(0)?.insertNode(node);
    handleInput();
  };

  const handleTableInsert = () => {
    exec('insertHTML', insertTable(3, 3));
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData.items);
    const images = items.filter(item => item.type.startsWith('image/'));
    if (images.length > 0) {
      e.preventDefault();
      const files = images.map(i => i.getAsFile()).filter((f): f is File => f !== null);
      onPasteImage?.(files);
      return;
    }
    // Allow plain text paste, strip HTML from clipboard to avoid unwanted styles
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, [onPasteImage]);

  const removePending = (idx: number) => {
    onImagesChange?.(pendingImages.filter((_, i) => i !== idx));
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    onImagesChange?.([...pendingImages, ...valid].slice(0, 5));
  };

  const addDocs = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => !f.type.startsWith('image/'));
    onDocsChange?.([...pendingDocs, ...valid].slice(0, 5));
  };

  const removeDoc = (idx: number) => {
    onDocsChange?.(pendingDocs.filter((_, i) => i !== idx));
  };

  const minHeight = `${minRows * 1.625}rem`;

  return (
    <div className="rounded-xl border border-slate-600/70 bg-slate-800/60 focus-within:border-blue-500/60 transition overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-700/60 flex-wrap">
        <ToolbarButton title="Negrita (Ctrl+B)" active={activeFormats.has('bold')} onClick={() => exec('bold')}>
          <Bold size={13} />
        </ToolbarButton>
        <ToolbarButton title="Cursiva (Ctrl+I)" active={activeFormats.has('italic')} onClick={() => exec('italic')}>
          <Italic size={13} />
        </ToolbarButton>
        <ToolbarButton title="Subrayado (Ctrl+U)" active={activeFormats.has('underline')} onClick={() => exec('underline')}>
          <Underline size={13} />
        </ToolbarButton>
        <ToolbarButton title="Tachado" active={activeFormats.has('strikeThrough')} onClick={() => exec('strikeThrough')}>
          <Strikethrough size={13} />
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-700 mx-1" />

        <ToolbarButton title="Lista sin orden" onClick={() => exec('insertUnorderedList')}>
          <List size={13} />
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" onClick={() => exec('insertOrderedList')}>
          <ListOrdered size={13} />
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-700 mx-1" />

        <ToolbarButton title="Código" onClick={insertCode}>
          <Code size={13} />
        </ToolbarButton>
        <ToolbarButton title="Insertar tabla 3×3" onClick={handleTableInsert}>
          <Table size={13} />
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-700 mx-1" />

        <ToolbarButton title="Alinear izquierda" onClick={() => exec('justifyLeft')}>
          <AlignLeft size={13} />
        </ToolbarButton>
        <ToolbarButton title="Centrar" onClick={() => exec('justifyCenter')}>
          <AlignCenter size={13} />
        </ToolbarButton>
        <ToolbarButton title="Alinear derecha" onClick={() => exec('justifyRight')}>
          <AlignRight size={13} />
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-700 mx-1" />

        <label
          title="Adjuntar imagen"
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer transition"
        >
          <ImagePlus size={13} />
          <input type="file" accept="image/*" multiple className="sr-only" onChange={e => addFiles(e.target.files)} />
        </label>

        {onDocsChange && (
          <label
            title="Adjuntar documento (PDF, Word, Excel...)"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer transition"
          >
            <Paperclip size={13} />
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.zip,.rar"
              multiple
              className="sr-only"
              onChange={e => addDocs(e.target.files)}
            />
          </label>
        )}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={syncFormats}
        onMouseUp={syncFormats}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className="rt-editor px-3 py-2.5 text-sm text-slate-200 outline-none leading-relaxed"
      />

      {/* Pending images */}
      {pendingImages.length > 0 && (
        <div className="flex gap-2 flex-wrap px-3 pb-3 border-t border-slate-700/50 pt-2.5">
          {pendingImages.map((file, i) => (
            <div key={i} className="relative group/img w-12 h-12 rounded-lg overflow-hidden border border-slate-600 bg-slate-900 shrink-0">
              <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePending(i)}
                className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition"
              >
                <X size={9} />
              </button>
            </div>
          ))}
          {pendingImages.length < 5 && (
            <label className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-600 hover:border-blue-500 flex items-center justify-center cursor-pointer transition shrink-0 bg-slate-800/60">
              <ImagePlus size={12} className="text-slate-500" />
              <input type="file" accept="image/*" multiple className="sr-only" onChange={e => addFiles(e.target.files)} />
            </label>
          )}
        </div>
      )}

      {/* Pending documents */}
      {pendingDocs.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-slate-700/50 pt-2.5">
          {pendingDocs.map((file, i) => (
            <div key={i} className="flex items-center gap-2 bg-slate-700/40 border border-slate-600/40 rounded-lg px-2.5 py-1.5 group/doc">
              <DocIcon file={file} />
              <span className="text-xs text-slate-300 flex-1 truncate">{file.name}</span>
              <span className="text-[10px] text-slate-500 shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
              <button
                type="button"
                onClick={() => removeDoc(i)}
                className="text-slate-600 hover:text-red-400 transition opacity-0 group-hover/doc:opacity-100 shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Renders stored HTML comment content safely */
export function CommentContent({ html, className = '' }: { html: string; className?: string }) {
  return (
    <div
      className={`rt-content text-sm leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
