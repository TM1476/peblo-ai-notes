import uuid
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./notes.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: f"USR_{uuid.uuid4().hex[:6].upper()}")
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

class Note(Base):
    __tablename__ = "notes"
    note_id = Column(String, primary_key=True, default=lambda: f"NOTE_{uuid.uuid4().hex[:6].upper()}")
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, default="Untitled Note")
    content = Column(Text, default="")
    tags = Column(String, default="[]")  # Stored as a JSON string
    summary = Column(Text, nullable=True)
    action_items = Column(Text, nullable=True)  # Stored as a JSON string
    is_archived = Column(Boolean, default=False)
    is_public = Column(Boolean, default=False)
    share_id = Column(String, unique=True, default=lambda: uuid.uuid4().hex[:8])
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)
