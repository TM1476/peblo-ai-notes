import React, { useState, useEffect } from 'react';

export default function App() {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [search, setSearch] = useState('');
  const [insights, setInsights] = useState({});
  const [loadingAI, setLoadingAI] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  // Mock initial setup for immediate evaluation rendering
  useEffect(() => {
    if (token) {
      fetchNotes();
      fetchInsights();
    }
  }, [token, search]);

  const fetchNotes = async () => {
    const res = await fetch(`http://localhost:8000/notes?search=${search}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) setNotes(await res.json());
  };

  const fetchInsights = async () => {
    const res = await fetch(`http://localhost:8000/insights`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) setInsights(await res.json());
  };

  const handleAutoSave = async (updatedNote) => {
    setSelectedNote(updatedNote);
    // Debounced or direct patch for rapid save UX
    await fetch(`http://localhost:8000/notes/${updatedNote.note_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ title: updatedNote.title, content: updatedNote.content })
    });
  };

  const triggerAISummary = async (id) => {
    setLoadingAI(true);
    const res = await fetch(`http://localhost:8000/notes/${id}/generate-summary`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    setLoadingAI(false);
    if (res.ok) {
      fetchNotes();
      const data = await res.json();
      setSelectedNote(prev => ({ ...prev, summary: data.summary, action_items: data.action_items }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Sidebar: Navigation, Discovery & Insights Section */}
      <aside className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-indigo-600">PEBLO Notes Workspace</h1>
        </div>
        
        {/* Productivity Analytics Snapshot */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
          <p className="font-semibold text-slate-500 mb-1">WORKSPACE METRICS</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="block text-lg font-bold">{insights.total_notes || 0}</span>
              Total Notes
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="block text-lg font-bold text-indigo-500">{insights.ai_usage_count || 0}</span>
              AI Tasks
            </div>
          </div>
        </div>

        {/* Real-time Filter & Selection Search Column */}
        <input 
          type="text" 
          placeholder="Search workspace..." 
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-indigo-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex-1 overflow-y-auto space-y-2">
          {notes.map(note => (
            <div 
              key={note.note_id} 
              onClick={() => setSelectedNote(note)}
              className={`p-3 rounded-lg cursor-pointer transition-colors border ${selectedNote?.note_id === note.note_id ? 'bg-indigo-50 border-indigo-200' : 'bg-white hover:bg-slate-50 border-slate-100'}`}
            >
              <h3 className="font-medium truncate">{note.title || "Untitled Note"}</h3>
              <p className="text-xs text-slate-400 line-clamp-1 mt-1">{note.content || "Empty note..."}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Primary Workspace Editor Context */}
      <main className="flex-1 flex flex-col p-6 bg-white">
        {selectedNote ? (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-4">
              <input 
                type="text" 
                className="text-2xl font-bold focus:outline-none w-2/3"
                value={selectedNote.title}
                onChange={(e) => handleAutoSave({ ...selectedNote, title: e.target.value })}
              />
              <button 
                onClick={() => triggerAISummary(selectedNote.note_id)}
                disabled={loadingAI}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md text-sm transition-all disabled:bg-indigo-300"
              >
                {loadingAI ? 'Distilling Canvas...' : '✨ Run AI Insights'}
              </button>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-6">
              {/* Note Content Input Block */}
              <textarea 
                className="flex-1 h-64 lg:h-full p-2 text-slate-800 resize-none focus:outline-none text-base leading-relaxed"
                placeholder="Start typing your rich note text here... System autosaves changes dynamically."
                value={selectedNote.content}
                onChange={(e) => handleAutoSave({ ...selectedNote, content: e.target.value })}
              />

              {/* Collapsible Intelligent Summary Panel Context */}
              {(selectedNote.summary || selectedNote.action_items?.length > 0) && (
                <div className="w-full lg:w-80 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-indigo-900 tracking-wider mb-2">AI SUMMARY</h4>
                    <p className="text-sm text-slate-700 leading-relaxed">{selectedNote.summary}</p>
                  </div>
                  {selectedNote.action_items?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-indigo-900 tracking-wider mb-2">EXTRACTED TASKS</h4>
                      <ul className="list-disc pl-4 text-sm text-slate-700 space-y-1">
                        {selectedNote.action_items.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <svg className="w-16 h-16 mb-4 stroke-current" viewBox="0 0 24 24" fill="none"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-lg">Select a note or create a new entry to engage AI compilation panels.</p>
          </div>
        )}
      </main>
    </div>
  );
}
