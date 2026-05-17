import json
import os
from typing import List, Optional
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import google.generativeai as genai

from models import SessionLocal, init_db, User, Note
from schemas import UserCreate, UserLogin, NoteCreate, NoteUpdate
from auth import hash_password, verify_password, create_access_token, get_current_user

# Initialize FastAPI & Database
app = FastAPI(title="Peblo AI Notes Workspace API")
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
GENAI_API_KEY = os.getenv("LLM_API_KEY", "YOUR_GEMINI_KEY")
genai.configure(api_key=GENAI_API_KEY)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- AUTHENTICATION ENDPOINTS ---
@app.post("/auth/signup")
def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        hashed_password=hash_password(user_data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    token = create_access_token({"sub": new_user.email})
    return {"access_token": token, "token_type": "bearer", "user": {"id": new_user.id, "name": new_user.name, "email": new_user.email}}

@app.post("/auth/login")
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "name": user.name, "email": user.email}}

# --- NOTES WORKSPACE ENDPOINTS ---
@app.get("/notes")
def get_notes(
    search: Optional[str] = None, 
    tag: Optional[str] = None, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    query = db.query(Note).filter(Note.user_id == current_user.id, Note.is_archived == False)
    
    if search:
        query = query.filter((Note.title.ilike(f"%{search}%")) | (Note.content.ilike(f"%{search}%")))
    
    notes = query.order_by(Note.updated_at.desc()).all()
    
    # Client side or simple Python filtering for JSON tags array
    if tag:
        notes = [n for n in notes if tag in json.loads(n.tags)]
        
    return [{
        "note_id": n.note_id, "title": n.title, "content": n.content,
        "tags": json.loads(n.tags), "summary": n.summary,
        "action_items": json.loads(n.action_items) if n.action_items else [],
        "is_public": n.is_public, "share_id": n.share_id, "updated_at": n.updated_at
    } for n in notes]

@app.post("/notes")
def create_note(note_data: NoteCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_note = Note(
        user_id=current_user.id,
        title=note_data.title or "Untitled Note",
        content=note_data.content or "",
        tags=json.dumps(note_data.tags or [])
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note

@app.patch("/notes/{id}")
def update_note(id: str, note_data: NoteUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.note_id == id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if note_data.title is not None: note.title = note_data.title
    if note_data.content is not None: note.content = note_data.content
    if note_data.tags is not None: note.tags = json.dumps(note_data.tags)
    if note_data.is_archived is not None: note.is_archived = note_data.is_archived
    if note_data.is_public is not None: note.is_public = note_data.is_public
    
    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    return note

# --- AI WORKFLOW INTEGRATION ---
@app.post("/notes/{id}/generate-summary")
def generate_summary(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.note_id == id, Note.user_id == current_user.id).first()
    if not note or not note.content.strip():
        raise HTTPException(status_code=400, detail="Note is empty or not found")
    
    prompt = f"""
    Analyze the following note content and provide output strictly structured as a valid JSON object. Do not include markdown formatting or backticks outside the valid JSON structure.
    Expected Format:
    {{
        "summary": "A cohesive 2-3 sentence summary.",
        "action_items": ["Action item 1", "Action item 2"],
        "suggested_title": "A cleaner, descriptive title"
    }}
    
    Note Content:
    {note.content}
    """
    
    try:
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(prompt)
        raw_text = response.text.strip().replace("```json", "").replace("```", "")
        ai_data = json.loads(raw_text)
        
        note.summary = ai_data.get("summary", "")
        note.action_items = json.dumps(ai_data.get("action_items", []))
        if note.title == "Untitled Note" or not note.title:
            note.title = ai_data.get("suggested_title", note.title)
            
        db.commit()
        return {
            "summary": note.summary,
            "action_items": ai_data.get("action_items", []),
            "suggested_title": note.title
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Engine processing failure: {str(e)}")

# --- PUBLIC ROUTE ---
@app.get("/shared/{shareId}")
def get_public_note(shareId: str, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.share_id == shareId, Note.is_public == True).first()
    if not note:
        raise HTTPException(status_code=404, detail="Public note not found or access restricted")
    return {
        "title": note.title,
        "content": note.content,
        "summary": note.summary,
        "tags": json.loads(note.tags),
        "updated_at": note.updated_at
    }

# --- PRODUCTIVITY INSIGHTS ---
@app.get("/insights")
def get_insights(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notes = db.query(Note).filter(Note.user_id == current_user.id).all()
    
    total_notes = len(notes)
    ai_used_count = sum(1 for n in notes if n.summary)
    
    tag_counts = {}
    for n in notes:
        for tag in json.loads(n.tags):
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
            
    sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        "total_notes": total_notes,
        "ai_usage_count": ai_used_count,
        "most_used_tags": dict(sorted_tags),
        "recent_activity": f"{len([n for n in notes if not n.is_archived])} active notes in workspace."
    }
