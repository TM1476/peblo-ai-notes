import React, { useState, useEffect } from 'react';

export default function MarkdownEditor({ note, onSave }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isPreview, setIsPreview] = useState(false);

  // Sync state if the selected note changes in the sidebar
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
  }, [note]);

  // Simple debounced auto-save effect
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (content !== note.content || title !== note.title) {
        onSave({ ...note, title, content });
      }
    }, 8000); // Autosaves note changes seamlessly

    return () => clearTimeout(delayDebounce);
  }, [title, content]);

  return (
    <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Tab Controller Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Canvas Editor</span>
        <div className="flex bg-slate-200/70 p-0.5 rounded-lg text-xs">
          <button 
            onClick={() => setIsPreview(false)} 
            className={`px-3 py-1 rounded-md font-semibold transition-all ${!isPreview ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Edit Raw
          </button>
          <button 
            onClick={() => setIsPreview(true)} 
            className={`px-3 py-1 rounded-md font-semibold transition-all ${isPreview ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Markdown Preview
          </button>
        </div>
      </div>

      {/* Workspace Body */}
      <div className="flex-1 p-4 min-h-[350px] flex flex-col">
        {isPreview ? (
          <div className="flex-1 prose prose-slate max-w-none p-3 bg-slate-50/30 rounded-lg overflow-y-auto font-sans text-sm border border-dashed border-slate-200">
            {/* Simple fallback parser for basic structural viewing */}
            {content ? content.split('\n').map((para, i) => <p key={i}>{para}</p>) : <span className="text-slate-400 italic">Nothing to preview...</span>}
          </div>
        ) : (
          <textarea
            className="flex-1 w-full p-3 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-indigo-500 resize-none bg-slate-50/10"
            placeholder="Compose your markdown note content canvas here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}
