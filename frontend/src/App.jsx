import React, { useState, useEffect } from 'react';
import MarkdownEditor from './components/MarkdownEditor';

export default function App() {
  // Core application states
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [search, setSearch] = useState('');
  const [insights, setInsights] = useState({ total_notes: 0, ai_usage_count: 0, most_used_tags: {} });
  const [loadingAI, setLoadingAI] = useState(false);
  
  // Authentication states
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [isLogin, setIsLogin] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');

  // Fetch data dynamically whenever token updates or search input changes
  useEffect(() => {
    if (token) {
      fetchNotes();
      fetchInsights();
    }
  }, [token, search]);

  // Handles both Login and Registration workflows
  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? 'login' : 'signup';
    const payload = isLogin 
      ? { email: authEmail, password: authPassword } 
      : { name: authName, email: authEmail, password: authPassword };
    
    try {
      const res = await fetch(`http://localhost:8000/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        // Clear forms on success
        setAuthEmail('');
        setAuthPassword('');
        setAuthName('');
      } else {
        const errData = await res.json();
        alert(`Authentication Failed: ${errData.detail || 'Invalid Credentials'}`);
      }
    } catch (error) {
      alert("Could not connect to the backend gateway. Verify your server is running.");
    }
  };

  // Log user out cleanly and wipe token cache
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setNotes([]);
    setSelectedNote(null);
    setInsights({ total_notes: 0, ai_usage_count: 0, most_used_tags: {} });
  };

  // GET: Active authenticated user workspace records
  const fetchNotes = async () => {
    try {
      const res = await fetch(`http://localhost:8000/notes?search=${search}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotes(await res.json());
      }
    } catch (error) {
      console.error("Error fetching workspace notes:", error);
    }
  };

  // GET: Metric insights calculation summary from backend
  const fetchInsights = async () => {
    try {
      const res = await fetch(`http://localhost:8000/insights`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setInsights(await res.json());
      }
    } catch (error) {
      console.error("Error fetching metrics dashboard:", error);
    }
  };

  // POST: Create a new canvas node record
  const createNote = async () => {
    try {
      const res = await fetch('http://localhost:8000/notes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ title: 'Untitled Note', content: '', tags: ['general'] })
      });
      
      if (res.ok) {
        const newNote = await res.json();
        // Standardize tags format cleanly to avoid frontend mapping exceptions
        const normalizedNote = { ...newNote, tags: typeof newNote.tags === 'string' ? JSON.parse(newNote.tags) : (newNote.tags || []) };
        await fetchNotes();
        setSelectedNote(normalizedNote);
      }
    } catch (error) {
      console.error("Failed to append fresh workspace note:", error);
    }
  };

  // PATCH: Autosave handler triggered seamlessly as user updates fields
  const handleUpdate = async (updatedFields) => {
    setSelectedNote(updatedFields);
    
    // Optimistically update notes list state for high-responsiveness
    setNotes(prevNotes => prevNotes.map(n => n.note_id === updatedFields.note_id ? updatedFields : n));

    try {
      await fetch(`http://localhost:8000/notes/${updatedFields.note_id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          title: updatedFields.title, 
          content: updatedFields.content, 
          tags: updatedFields.tags, 
          is_public: updatedFields.is_public 
        })
      });
    } catch (error) {
      console.error("Autosave pipeline dropped connection target:", error);
    }
  };

  // POST: Triggers Gemini integration to compile text canvas data
  const runAIEngine = async (id) => {
    setLoadingAI(true);
    try {
      const res = await fetch(`http://localhost:8000/notes/${id}/generate-summary`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const output = await res.json();
        setSelectedNote(prev => ({ 
          ...prev, 
          summary: output.summary, 
          action_items: output.action_items, 
          title: output.suggested_title 
        }));
        await fetchNotes();
        await fetchInsights();
      } else {
        const errData = await res.json();
        alert(errData.detail || "AI compilation failed.");
      }
    } catch (error) {
      alert("Network exception connecting to Gemini compiler.");
    } finally {
      setLoadingAI(false);
    }
  };

  // Render Gate: Unauthenticated Entry Gateway Layout
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <form onSubmit={handleAuth} className="bg-white p-8 rounded-xl border border-slate-200 max-w-sm w-full space-y-5 shadow-lg">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-indigo-600">Peblo AI Workspace</h2>
            <p className="text-xs text-slate-400 mt-1">Review team access portal</p>
          </div>
          
          <div className="space-y-3">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
                <input type="text" placeholder="John Doe" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-indigo-500" value={authName} onChange={e => setAuthName(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
              <input type="email" placeholder="hiring@peblo.in" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-indigo-500" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Password</label>
              <input type="password" placeholder="••••••••" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-indigo-500" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required />
            </div>
          </div>

          <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-sm shadow-sm transition-colors">
            {isLogin ? 'Sign In to Workspace' : 'Create Candidate Workspace'}
          </button>
          
          <div className="text-center">
            <p onClick={() => setIsLogin(!isLogin)} className="text-xs text-slate-500 underline cursor-pointer hover:text-indigo-600 inline-block transition-colors">
              {isLogin ? "Need a fresh evaluator profile? Sign up" : "Already registered here? Direct Log In"}
            </p>
          </div>
        </form>
      </div>
    );
  }

  // Render Core UI: Primary Workspace View
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      
      {/* Persistent Sidebar Controller Column */}
      <aside className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-indigo-600 tracking-tight">Peblo Workspace</h1>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Full-Stack Canvas</p>
          </div>
          <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors">Logout</button>
        </div>

        {/* Live Aggregated Insights Section */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs grid grid-cols-2 gap-2 shadow-inner">
          <div className="bg-white p-2 rounded border border-slate-100">
            <span className="block text-xl font-bold text-slate-700">{insights.total_notes}</span> 
            Total Files
          </div>
          <div className="bg-white p-2 rounded border border-slate-100">
            <span className="block text-xl font-bold text-indigo-600">{insights.ai_usage_count}</span> 
            AI Distills
          </div>
        </div>

        {/* Actions & Filters Core Control Elements */}
        <button onClick={createNote} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-sm shadow-sm transition-all transform hover:-translate-y-0.5 active:translate-y-0">
          + New Note Entry
        </button>
        
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search notes, strings, titles..." 
            className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-indigo-500 bg-slate-50/50" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
          <span className="absolute left-2.5 top-2.5 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </span>
        </div>

        {/* Dynamic Nav Row Item Map Stack */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[300px] md:max-h-none">
          {notes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No workspace files found.</p>
          ) : (
            notes.map(n => (
              <div 
                key={n.note_id} 
                onClick={() => setSelectedNote(n)} 
                className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedNote?.note_id === n.note_id ? 'bg-indigo-50/70 border-indigo-200 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
              >
                <h4 className="font-semibold text-sm text-slate-800 truncate">{n.title || "Untitled Note"}</h4>
                <p className="text-xs text-slate-400 truncate mt-0.5">{n.content || "Empty content canvas..."}</p>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Editor & AI Context Canvas Grid Area */}
      <main className="flex-1 p-6 flex flex-col bg-white">
        {selectedNote ? (
          <div className="flex-1 flex flex-col gap-5">
            
            {/* Note Structural Dynamic Header Menu Row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
              <input 
                type="text" 
                className="text-2xl font-bold focus:outline-none bg-transparent w-full sm:w-2/3 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 transition-colors" 
                value={selectedNote.title} 
                onChange={e => handleUpdate({ ...selectedNote, title: e.target.value })} 
              />
              <button 
                onClick={() => runAIEngine(selectedNote.note_id)} 
                disabled={loadingAI} 
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                {loadingAI ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    Distilling Canvas Context...
                  </>
                ) : '✨ Run AI Insights'}
              </button>
            </div>

            {/* Core Workflows Split Body Layout Panel */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6">
              
              {/* Markdown Editor Canvas Block */}
              <div className="flex-1 flex flex-col gap-3">
                <MarkdownEditor note={selectedNote} onSave={handleUpdate} />
                
                {/* Sharing Security & Discovery Parameter Controls */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <label className="flex items-center gap-2 text-slate-600 font-medium cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      checked={selectedNote.is_public || false} 
                      onChange={e => handleUpdate({ ...selectedNote, is_public: e.target.checked })} 
                    />
                    Expose Live Note via Public URL Sharing Pathway
                  </label>
                  {selectedNote.is_public && (
                    <div className="flex items-center gap-1 bg-white border border-indigo-100 rounded px-2 py-1 text-indigo-600 font-mono">
                      <span className="text-slate-400 text-[10px]">SHARE ID:</span>
                      <strong>{selectedNote.share_id}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Collapsible Intelligent Summary Sidebar panel block context */}
              {(selectedNote.summary || (selectedNote.action_items && selectedNote.action_items.length > 0)) && (
                <div className="w-full lg:w-80 bg-slate-50/50 border border-slate-200/80 p-5 rounded-xl flex flex-col gap-5 shadow-sm h-fit">
                  {selectedNote.summary && (
                    <div>
                      <h5 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-1.5">AI Summary Output</h5>
                      <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-200/60 shadow-inner">
                        {selectedNote.summary}
                      </p>
                    </div>
                  )}
                  {selectedNote.action_items && selectedNote.action_items.length > 0 && (
                    <div>
                      <h5 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-1.5">Extracted Checklist Tasks</h5>
                      <ul className="bg-white border border-slate-200/60 rounded-lg divide-y divide-slate-100 overflow-hidden shadow-inner">
                        {selectedNote.action_items.map((item, index) => (
                          <li key={index} className="px-3 py-2 text-xs text-slate-600 flex items-start gap-2">
                            <span className="text-indigo-500 font-bold mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center max-w-sm mx-auto space-y-2">
            <svg className="w-12 h-12 text-slate-300 stroke-current mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
            <h3 className="font-bold text-slate-700 text-base">Active Workspace Canvas Empty</h3>
            <p className="text-xs text-slate-400 max-w-xs">Select an entry from the tracking list layout column or append a fresh new canvas entry record above to initialize Gemini extraction pipelines.</p>
          </div>
        )}
      </main>
    </div>
  );
}
