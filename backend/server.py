from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query as QueryParam
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import math
import hashlib
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from collections import Counter

import jwt
import bcrypt
import aiofiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# LLM key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'obsidian-rag-secret-key-2024')
UPLOAD_DIR = ROOT_DIR / 'data'
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ========== PYDANTIC MODELS ==========

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class QueryRequest(BaseModel):
    query: str
    top_k: int = 5

class DocumentOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    filename: str
    file_type: str
    file_size: int
    total_chunks: int
    status: str
    uploaded_by: str
    uploaded_at: str

class ChunkOut(BaseModel):
    chunk_id: str
    text: str
    filename: str
    file_type: str
    page_number: Optional[int] = None
    timestamp: Optional[str] = None

class QueryResponse(BaseModel):
    answer: str
    citations: List[dict]
    query_id: str

class StatsOut(BaseModel):
    total_documents: int
    total_chunks: int
    total_queries: int
    total_users: int
    file_distribution: dict
    recent_queries: List[dict]

# ========== AUTH HELPERS ==========

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(token: str = None):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = token.replace("Bearer ", "")
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

from fastapi import Request

async def auth_dependency(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await get_current_user(auth_header)

async def admin_dependency(request: Request):
    user = await auth_dependency(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ========== AUDIT LOGGING ==========

async def log_audit(action: str, user_id: str, details: str = ""):
    doc = {
        "id": str(uuid.uuid4()),
        "action": action,
        "user_id": user_id,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(doc)

# ========== TEXT EXTRACTION ==========

def extract_pdf_text(filepath: str) -> List[dict]:
    """Extract text from PDF, returns list of {page, text}"""
    import fitz
    pages = []
    try:
        doc = fitz.open(filepath)
        for i, page in enumerate(doc):
            text = page.get_text()
            if text.strip():
                pages.append({"page": i + 1, "text": text.strip()})
        doc.close()
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
    return pages

def extract_docx_text(filepath: str) -> List[dict]:
    """Extract text from DOCX, returns list of {page, text}"""
    from docx import Document
    paragraphs = []
    try:
        doc = Document(filepath)
        current_text = []
        page_num = 1
        for para in doc.paragraphs:
            if para.text.strip():
                current_text.append(para.text.strip())
                if len("\n".join(current_text)) > 2000:
                    paragraphs.append({"page": page_num, "text": "\n".join(current_text)})
                    current_text = []
                    page_num += 1
        if current_text:
            paragraphs.append({"page": page_num, "text": "\n".join(current_text)})
    except Exception as e:
        logger.error(f"DOCX extraction error: {e}")
    return paragraphs

def extract_image_text(filepath: str) -> List[dict]:
    """Simulate OCR for images"""
    filename = os.path.basename(filepath)
    return [{"page": 1, "text": f"[Image content from {filename}] This image contains visual information that has been processed by the OCR engine. In a production system, Tesseract OCR and CLIP would extract detailed text and visual embeddings from this image."}]

def extract_audio_text(filepath: str) -> List[dict]:
    """Simulate audio transcription"""
    filename = os.path.basename(filepath)
    return [{"page": 1, "text": f"[Audio transcript from {filename}] This audio file has been processed by the speech-to-text engine. In a production system, Whisper would provide accurate timestamps and full transcription.", "timestamp": "00:00:00"}]

# ========== CHUNKING ==========

def chunk_text(text: str, chunk_size: int = 600, overlap: int = 100) -> List[str]:
    """Split text into overlapping chunks"""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap
    return chunks if chunks else [text[:2000]] if text.strip() else []

# ========== SIMULATED VECTOR SEARCH ==========

def compute_keywords(text: str) -> dict:
    """Compute keyword frequency for simple text matching"""
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    stop_words = {'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'from', 'this', 'that', 'with', 'they', 'been', 'said', 'each', 'which', 'their', 'will', 'other', 'about', 'many', 'then', 'them', 'these', 'some', 'would', 'make', 'like', 'into', 'could', 'time', 'very', 'when', 'come', 'made', 'after', 'back'}
    words = [w for w in words if w not in stop_words]
    return dict(Counter(words))

def compute_similarity(query_keywords: dict, chunk_keywords: dict) -> float:
    """Compute cosine similarity between keyword vectors"""
    all_keys = set(query_keywords.keys()) | set(chunk_keywords.keys())
    if not all_keys:
        return 0.0
    dot = sum(query_keywords.get(k, 0) * chunk_keywords.get(k, 0) for k in all_keys)
    mag_q = math.sqrt(sum(v**2 for v in query_keywords.values()))
    mag_c = math.sqrt(sum(v**2 for v in chunk_keywords.values()))
    if mag_q == 0 or mag_c == 0:
        return 0.0
    return dot / (mag_q * mag_c)

# ========== AUTH ROUTES ==========

@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_count = await db.users.count_documents({})
    user = {
        "id": str(uuid.uuid4()),
        "username": data.username,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "role": "admin" if user_count == 0 else "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    token = create_token(user["id"], user["role"])
    await log_audit("user_register", user["id"], f"User {data.username} registered")
    return {"token": token, "user": {"id": user["id"], "username": user["username"], "email": user["email"], "role": user["role"]}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], user["role"])
    await log_audit("user_login", user["id"], f"User {user['username']} logged in")
    return {"token": token, "user": {"id": user["id"], "username": user["username"], "email": user["email"], "role": user["role"]}}

@api_router.get("/auth/me")
async def get_me(user=Depends(auth_dependency)):
    return {"id": user["id"], "username": user["username"], "email": user["email"], "role": user["role"]}

# ========== UPLOAD ROUTES ==========

@api_router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...), user=Depends(auth_dependency)):
    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    type_map = {
        "pdf": "pdf", "docx": "docx", "doc": "docx",
        "png": "image", "jpg": "image", "jpeg": "image", "gif": "image", "bmp": "image", "webp": "image",
        "mp3": "audio", "wav": "audio", "ogg": "audio", "m4a": "audio", "flac": "audio"
    }
    file_type = type_map.get(ext, "unknown")
    if file_type == "unknown":
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")

    doc_id = str(uuid.uuid4())
    filepath = UPLOAD_DIR / f"{doc_id}_{file.filename}"
    
    content = await file.read()
    async with aiofiles.open(str(filepath), 'wb') as f:
        await f.write(content)
    
    # Extract text based on type
    if file_type == "pdf":
        pages = extract_pdf_text(str(filepath))
    elif file_type == "docx":
        pages = extract_docx_text(str(filepath))
    elif file_type == "image":
        pages = extract_image_text(str(filepath))
    elif file_type == "audio":
        pages = extract_audio_text(str(filepath))
    else:
        pages = []

    # Chunk and store
    chunks_stored = 0
    for page_data in pages:
        text_chunks = chunk_text(page_data["text"])
        for i, chunk_text_content in enumerate(text_chunks):
            chunk = {
                "chunk_id": str(uuid.uuid4()),
                "document_id": doc_id,
                "text": chunk_text_content,
                "filename": file.filename,
                "file_type": file_type,
                "page_number": page_data.get("page"),
                "timestamp": page_data.get("timestamp"),
                "keywords": compute_keywords(chunk_text_content),
                "chunk_index": i,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.chunks.insert_one(chunk)
            chunks_stored += 1

    # Store document record
    document = {
        "id": doc_id,
        "filename": file.filename,
        "file_type": file_type,
        "file_size": len(content),
        "total_chunks": chunks_stored,
        "status": "indexed" if chunks_stored > 0 else "empty",
        "uploaded_by": user["id"],
        "uploaded_by_name": user["username"],
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    await db.documents.insert_one(document)
    await log_audit("document_upload", user["id"], f"Uploaded {file.filename} ({chunks_stored} chunks)")

    return {
        "id": doc_id,
        "filename": file.filename,
        "file_type": file_type,
        "total_chunks": chunks_stored,
        "status": document["status"]
    }

@api_router.get("/documents")
async def list_documents(user=Depends(auth_dependency)):
    docs = await db.documents.find({}, {"_id": 0}).sort("uploaded_at", -1).to_list(500)
    return docs

@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user=Depends(auth_dependency)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    await db.documents.delete_one({"id": doc_id})
    await db.chunks.delete_many({"document_id": doc_id})
    
    # Delete file from disk
    for f in UPLOAD_DIR.glob(f"{doc_id}_*"):
        f.unlink(missing_ok=True)
    
    await log_audit("document_delete", user["id"], f"Deleted {doc.get('filename', doc_id)}")
    return {"message": "Document deleted", "id": doc_id}

# ========== QUERY ROUTES ==========

@api_router.post("/query")
async def query_rag(data: QueryRequest, user=Depends(auth_dependency)):
    query_keywords = compute_keywords(data.query)
    
    # Get all chunks and compute similarity
    all_chunks = await db.chunks.find({}, {"_id": 0}).to_list(10000)
    
    scored = []
    for chunk in all_chunks:
        score = compute_similarity(query_keywords, chunk.get("keywords", {}))
        scored.append((score, chunk))
    
    scored.sort(key=lambda x: x[0], reverse=True)
    top_chunks = scored[:data.top_k]
    
    # Build context
    context_parts = []
    citations = []
    for i, (score, chunk) in enumerate(top_chunks):
        if score > 0:
            ref_label = f"[{i+1}]"
            context_parts.append(f"{ref_label} {chunk['text']}")
            citation = {
                "index": i + 1,
                "filename": chunk.get("filename", "Unknown"),
                "file_type": chunk.get("file_type", "unknown"),
                "page_number": chunk.get("page_number"),
                "timestamp": chunk.get("timestamp"),
                "text_preview": chunk["text"][:200],
                "score": round(score, 4)
            }
            citations.append(citation)
    
    context = "\n\n".join(context_parts) if context_parts else "No relevant documents found."
    
    # Generate LLM response
    answer = ""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        system_prompt = """You are a secure offline assistant for Project Obsidian. Answer strictly using the provided context. Include numbered citations like [1], [2] etc. referencing the source documents. If the context doesn't contain relevant information, say so clearly. Be precise and professional."""
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"query-{str(uuid.uuid4())[:8]}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        
        user_msg = UserMessage(text=f"Context:\n{context}\n\nQuestion: {data.query}")
        answer = await chat.send_message(user_msg)
    except Exception as e:
        logger.error(f"LLM error: {e}")
        if citations:
            answer = f"Based on the retrieved documents, here is the relevant information:\n\n"
            for c in citations:
                answer += f"[{c['index']}] From {c['filename']}"
                if c.get('page_number'):
                    answer += f" (Page {c['page_number']})"
                answer += f": {c['text_preview']}...\n\n"
        else:
            answer = "No relevant documents found for your query. Please upload documents first."
    
    # Store query
    query_record = {
        "id": str(uuid.uuid4()),
        "query": data.query,
        "answer": answer,
        "citations": citations,
        "user_id": user["id"],
        "username": user["username"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.queries.insert_one(query_record)
    await log_audit("query", user["id"], f"Query: {data.query[:100]}")
    
    return {
        "answer": answer,
        "citations": citations,
        "query_id": query_record["id"]
    }

@api_router.get("/query/history")
async def query_history(user=Depends(auth_dependency), limit: int = 50):
    queries = await db.queries.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return queries

# ========== ANALYTICS ROUTES ==========

@api_router.get("/analytics/stats")
async def get_stats(user=Depends(auth_dependency)):
    total_docs = await db.documents.count_documents({})
    total_chunks = await db.chunks.count_documents({})
    total_queries = await db.queries.count_documents({})
    total_users = await db.users.count_documents({})
    
    # File distribution
    pipeline = [{"$group": {"_id": "$file_type", "count": {"$sum": 1}}}]
    dist_cursor = db.documents.aggregate(pipeline)
    distribution = {}
    async for item in dist_cursor:
        distribution[item["_id"]] = item["count"]
    
    # Recent queries
    recent = await db.queries.find({}, {"_id": 0, "query": 1, "username": 1, "created_at": 1}).sort("created_at", -1).to_list(10)
    
    # Query count by date (last 7 days)
    query_dates_pipeline = [
        {"$addFields": {"date_str": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {"_id": "$date_str", "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
        {"$limit": 7}
    ]
    date_cursor = db.queries.aggregate(query_dates_pipeline)
    query_by_date = []
    async for item in date_cursor:
        query_by_date.append({"date": item["_id"], "count": item["count"]})
    
    return {
        "total_documents": total_docs,
        "total_chunks": total_chunks,
        "total_queries": total_queries,
        "total_users": total_users,
        "file_distribution": distribution,
        "recent_queries": recent,
        "query_by_date": query_by_date
    }

# ========== ADMIN ROUTES ==========

@api_router.get("/admin/audit-logs")
async def get_audit_logs(user=Depends(admin_dependency), limit: int = 100):
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs

@api_router.post("/admin/rebuild-index")
async def rebuild_index(user=Depends(admin_dependency)):
    """Rebuild keyword indexes for all chunks"""
    chunks = await db.chunks.find({}, {"_id": 0}).to_list(50000)
    updated = 0
    for chunk in chunks:
        new_keywords = compute_keywords(chunk.get("text", ""))
        await db.chunks.update_one(
            {"chunk_id": chunk["chunk_id"]},
            {"$set": {"keywords": new_keywords}}
        )
        updated += 1
    
    await log_audit("rebuild_index", user["id"], f"Rebuilt index for {updated} chunks")
    return {"message": f"Index rebuilt for {updated} chunks", "total_chunks": updated}

@api_router.get("/admin/users")
async def list_users(user=Depends(admin_dependency)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users

# ========== ROOT ==========

@api_router.get("/")
async def root():
    return {"message": "Project Obsidian API", "status": "operational"}

@api_router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.documents.create_index("id", unique=True)
    await db.chunks.create_index("document_id")
    await db.chunks.create_index("chunk_id", unique=True)
    await db.queries.create_index("user_id")
    await db.audit_logs.create_index("timestamp")
    logger.info("Project Obsidian API started - indexes created")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
