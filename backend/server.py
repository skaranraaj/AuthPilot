from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.responses import StreamingResponse
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import json
import asyncio
import io
import re
from PyPDF2 import PdfReader
import pytesseract
from PIL import Image
from pdf2image import convert_from_bytes
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'authpilot_secret_key_2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# LLM Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Upload directory
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

# Initialize sentence transformer for embeddings
embedding_model = None

def get_embedding_model():
    global embedding_model
    if embedding_model is None:
        embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    return embedding_model

# Create the main app
app = FastAPI(title="AuthPilot API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Pydantic Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    organization_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    created_at: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class OrganizationCreate(BaseModel):
    name: str

class CaseCreate(BaseModel):
    payer: str
    state: str
    cpt_codes: List[str]
    icd10_codes: List[str]
    request_type: str = "Appeal"
    due_date: str
    patient_name: Optional[str] = None
    patient_dob: Optional[str] = None
    patient_mrn: Optional[str] = None

class CaseUpdate(BaseModel):
    payer: Optional[str] = None
    state: Optional[str] = None
    cpt_codes: Optional[List[str]] = None
    icd10_codes: Optional[List[str]] = None
    request_type: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    extracted_facts: Optional[Dict[str, Any]] = None

class PolicyCreate(BaseModel):
    payer: str
    state: str
    effective_date: str
    category: str
    name: str
    content: Optional[str] = None

class TemplateCreate(BaseModel):
    name: str
    type: str
    content: str
    tone: str = "professional"

class AuditLogEntry(BaseModel):
    case_id: Optional[str] = None
    action: str
    details: Optional[Dict[str, Any]] = None

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({'id': payload['user_id']}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def create_audit_log(user_id: str, organization_id: str, action: str, case_id: str = None, details: dict = None):
    log_entry = {
        'id': str(uuid.uuid4()),
        'user_id': user_id,
        'organization_id': organization_id,
        'case_id': case_id,
        'action': action,
        'details': details or {},
        'timestamp': datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(log_entry)

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF, with OCR fallback for scanned documents."""
    text = ""
    try:
        pdf_reader = PdfReader(io.BytesIO(file_bytes))
        for page in pdf_reader.pages:
            page_text = page.extract_text() or ""
            text += page_text + "\n"
        
        # If very little text extracted, try OCR
        if len(text.strip()) < 100:
            images = convert_from_bytes(file_bytes)
            for img in images:
                text += pytesseract.image_to_string(img) + "\n"
    except Exception as e:
        logging.error(f"PDF extraction error: {e}")
        # Fallback to OCR only
        try:
            images = convert_from_bytes(file_bytes)
            for img in images:
                text += pytesseract.image_to_string(img) + "\n"
        except Exception as ocr_e:
            logging.error(f"OCR fallback error: {ocr_e}")
    
    return text.strip()

def extract_text_from_image(file_bytes: bytes) -> str:
    """Extract text from image using OCR."""
    try:
        img = Image.open(io.BytesIO(file_bytes))
        return pytesseract.image_to_string(img)
    except Exception as e:
        logging.error(f"Image OCR error: {e}")
        return ""

async def call_llm(system_prompt: str, user_prompt: str) -> str:
    """Call OpenAI GPT via emergentintegrations."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message=system_prompt
        ).with_model("openai", "gpt-5.2")
        
        response = await chat.send_message(UserMessage(text=user_prompt))
        return response
    except Exception as e:
        logging.error(f"LLM call error: {e}")
        raise HTTPException(status_code=500, detail=f"LLM processing error: {str(e)}")

def compute_embedding(text: str) -> List[float]:
    """Compute embedding for text using sentence-transformers."""
    model = get_embedding_model()
    return model.encode(text).tolist()

async def search_policies(query: str, payer: str, state: str, top_k: int = 5) -> List[Dict]:
    """Search policies using semantic similarity with metadata filtering."""
    # Get all policy chunks for the payer/state
    filter_query = {}
    if payer:
        filter_query['payer'] = {'$regex': payer, '$options': 'i'}
    if state:
        filter_query['state'] = {'$regex': state, '$options': 'i'}
    
    chunks = await db.policy_chunks.find(filter_query, {'_id': 0}).to_list(1000)
    
    if not chunks:
        return []
    
    # Compute query embedding
    query_embedding = compute_embedding(query)
    
    # Compute similarities
    results = []
    for chunk in chunks:
        if 'embedding' in chunk:
            similarity = cosine_similarity([query_embedding], [chunk['embedding']])[0][0]
            results.append({
                'policy_id': chunk.get('policy_id'),
                'policy_name': chunk.get('policy_name'),
                'effective_date': chunk.get('effective_date'),
                'section': chunk.get('section'),
                'page': chunk.get('page'),
                'excerpt_id': chunk.get('id'),
                'text': chunk.get('text'),
                'score': float(similarity)
            })
    
    # Sort by similarity and return top_k
    results.sort(key=lambda x: x['score'], reverse=True)
    return results[:top_k]

# Auth Routes
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if email exists
    existing = await db.users.find_one({'email': user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create organization if name provided
    org_id = None
    org_name = None
    if user_data.organization_name:
        org_id = str(uuid.uuid4())
        org_name = user_data.organization_name
        await db.organizations.insert_one({
            'id': org_id,
            'name': org_name,
            'created_at': datetime.now(timezone.utc).isoformat()
        })
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        'id': user_id,
        'email': user_data.email,
        'password_hash': hash_password(user_data.password),
        'name': user_data.name,
        'organization_id': org_id,
        'organization_name': org_name,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email)
    
    return TokenResponse(
        token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            organization_id=org_id,
            organization_name=org_name,
            created_at=user_doc['created_at']
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user['id'], user['email'])
    
    return TokenResponse(
        token=token,
        user=UserResponse(
            id=user['id'],
            email=user['email'],
            name=user['name'],
            organization_id=user.get('organization_id'),
            organization_name=user.get('organization_name'),
            created_at=user['created_at']
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    return UserResponse(
        id=user['id'],
        email=user['email'],
        name=user['name'],
        organization_id=user.get('organization_id'),
        organization_name=user.get('organization_name'),
        created_at=user['created_at']
    )

# Case Routes
@api_router.post("/cases")
async def create_case(case_data: CaseCreate, user=Depends(get_current_user)):
    case_id = str(uuid.uuid4())
    case_doc = {
        'id': case_id,
        'user_id': user['id'],
        'organization_id': user.get('organization_id'),
        'payer': case_data.payer,
        'state': case_data.state,
        'cpt_codes': case_data.cpt_codes,
        'icd10_codes': case_data.icd10_codes,
        'request_type': case_data.request_type,
        'due_date': case_data.due_date,
        'patient_name': case_data.patient_name,
        'patient_dob': case_data.patient_dob,
        'patient_mrn': case_data.patient_mrn,
        'status': 'new_denial',
        'extracted_facts': {},
        'policy_matches': [],
        'denial_analysis': {},
        'generated_draft': None,
        'documents': [],
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    await db.cases.insert_one(case_doc)
    await create_audit_log(user['id'], user.get('organization_id'), 'create_case', case_id, {'action': 'Case created'})
    
    return {**case_doc, '_id': None}

@api_router.get("/cases")
async def get_cases(status: Optional[str] = None, user=Depends(get_current_user)):
    query = {'organization_id': user.get('organization_id')}
    if status:
        query['status'] = status
    
    cases = await db.cases.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    return cases

@api_router.get("/cases/{case_id}")
async def get_case(case_id: str, user=Depends(get_current_user)):
    case = await db.cases.find_one({'id': case_id, 'organization_id': user.get('organization_id')}, {'_id': 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case

@api_router.put("/cases/{case_id}")
async def update_case(case_id: str, case_data: CaseUpdate, user=Depends(get_current_user)):
    case = await db.cases.find_one({'id': case_id, 'organization_id': user.get('organization_id')})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    update_data = {k: v for k, v in case_data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.cases.update_one({'id': case_id}, {'$set': update_data})
    await create_audit_log(user['id'], user.get('organization_id'), 'update_case', case_id, {'updates': list(update_data.keys())})
    
    updated_case = await db.cases.find_one({'id': case_id}, {'_id': 0})
    return updated_case

@api_router.delete("/cases/{case_id}")
async def delete_case(case_id: str, user=Depends(get_current_user)):
    result = await db.cases.delete_one({'id': case_id, 'organization_id': user.get('organization_id')})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"message": "Case deleted"}

# Document Upload
@api_router.post("/cases/{case_id}/documents")
async def upload_document(
    case_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    case = await db.cases.find_one({'id': case_id, 'organization_id': user.get('organization_id')})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Read file
    file_bytes = await file.read()
    
    # Extract text based on file type
    extracted_text = ""
    if file.filename.lower().endswith('.pdf'):
        extracted_text = extract_text_from_pdf(file_bytes)
    elif file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp')):
        extracted_text = extract_text_from_image(file_bytes)
    else:
        extracted_text = file_bytes.decode('utf-8', errors='ignore')
    
    # Save file
    doc_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{doc_id}_{file.filename}"
    with open(file_path, 'wb') as f:
        f.write(file_bytes)
    
    # Create document record
    doc_record = {
        'id': doc_id,
        'case_id': case_id,
        'type': document_type,
        'filename': file.filename,
        'file_path': str(file_path),
        'extracted_text': extracted_text,
        'uploaded_at': datetime.now(timezone.utc).isoformat()
    }
    await db.documents.insert_one(doc_record)
    
    # Update case documents list
    await db.cases.update_one(
        {'id': case_id},
        {'$push': {'documents': doc_id}, '$set': {'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    await create_audit_log(user['id'], user.get('organization_id'), 'upload_document', case_id, {'document_type': document_type, 'filename': file.filename})
    
    return {**doc_record, '_id': None, 'file_path': None}

@api_router.get("/cases/{case_id}/documents")
async def get_case_documents(case_id: str, user=Depends(get_current_user)):
    case = await db.cases.find_one({'id': case_id, 'organization_id': user.get('organization_id')})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    documents = await db.documents.find({'case_id': case_id}, {'_id': 0, 'file_path': 0}).to_list(100)
    return documents

# LLM Processing Routes
@api_router.post("/cases/{case_id}/extract")
async def extract_facts(case_id: str, user=Depends(get_current_user)):
    """Extract structured facts from case documents using LLM."""
    case = await db.cases.find_one({'id': case_id, 'organization_id': user.get('organization_id')})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Get documents
    documents = await db.documents.find({'case_id': case_id}, {'_id': 0}).to_list(100)
    
    denial_text = ""
    clinical_text = ""
    imaging_text = ""
    
    for doc in documents:
        if doc['type'] == 'denial_letter':
            denial_text = doc.get('extracted_text', '')
        elif doc['type'] == 'clinical_notes':
            clinical_text = doc.get('extracted_text', '')
        elif doc['type'] == 'imaging_report':
            imaging_text = doc.get('extracted_text', '')
    
    if not denial_text:
        raise HTTPException(status_code=400, detail="Denial letter required for extraction")
    
    system_prompt = """You are an administrative assistant for healthcare prior authorization and appeals. You do not provide medical advice. Extract structured data from the following documents for an insurance appeal case.

Hard rules:
- If information is missing, ask for it or list it as "Missing".
- Do not invent clinical facts, codes, dates, or policy criteria.
- Only use facts explicitly found in the documents.

Return ONLY valid JSON with no markdown formatting."""

    user_prompt = f"""Extract structured data from these documents.

Return JSON with:
- payer_name
- denial_reasons: [list]
- denial_reason_category: (missing_documentation | medical_necessity | coding_billing | authorization_issue | eligibility | other)
- requested_service (plain English)
- CPT_HCPCS_codes: [list]
- ICD10_codes: [list]
- patient_age (if present)
- key_clinical_facts: [bullet list of facts explicitly stated]
- dates: {{date_of_service, denial_date, submission_date if present}}
- missing_information: [list of fields needed to proceed]

Only use facts explicitly found in the documents. If not present, set null and add to missing_information.

DENIAL LETTER:
{denial_text[:8000]}

CLINICAL NOTES:
{clinical_text[:4000] if clinical_text else 'Not provided'}

IMAGING REPORT:
{imaging_text[:4000] if imaging_text else 'Not provided'}"""

    response = await call_llm(system_prompt, user_prompt)
    
    # Parse JSON from response
    try:
        # Try to extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            extracted_facts = json.loads(json_match.group())
        else:
            extracted_facts = {"error": "Could not parse extraction", "raw_response": response[:500]}
    except json.JSONDecodeError:
        extracted_facts = {"error": "Invalid JSON in response", "raw_response": response[:500]}
    
    # Update case
    await db.cases.update_one(
        {'id': case_id},
        {'$set': {'extracted_facts': extracted_facts, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    await create_audit_log(user['id'], user.get('organization_id'), 'extract_facts', case_id)
    
    return {'extracted_facts': extracted_facts}

@api_router.post("/cases/{case_id}/match-policies")
async def match_policies(case_id: str, user=Depends(get_current_user)):
    """Find relevant policy excerpts using RAG."""
    case = await db.cases.find_one({'id': case_id, 'organization_id': user.get('organization_id')})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    extracted_facts = case.get('extracted_facts', {})
    
    # Build search query
    query_parts = []
    if extracted_facts.get('requested_service'):
        query_parts.append(extracted_facts['requested_service'])
    if extracted_facts.get('denial_reasons'):
        query_parts.extend(extracted_facts['denial_reasons'][:3])
    if case.get('cpt_codes'):
        query_parts.extend(case['cpt_codes'])
    
    search_query = " ".join(query_parts) if query_parts else f"{case.get('payer', '')} coverage criteria"
    
    # Search policies
    matches = await search_policies(search_query, case.get('payer', ''), case.get('state', ''))
    
    # Update case
    await db.cases.update_one(
        {'id': case_id},
        {'$set': {'policy_matches': matches, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    await create_audit_log(user['id'], user.get('organization_id'), 'match_policies', case_id)
    
    return {'policy_matches': matches}

@api_router.post("/cases/{case_id}/analyze")
async def analyze_denial(case_id: str, user=Depends(get_current_user)):
    """Analyze denial and generate missing documentation checklist."""
    case = await db.cases.find_one({'id': case_id, 'organization_id': user.get('organization_id')})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    extracted_facts = case.get('extracted_facts', {})
    policy_matches = case.get('policy_matches', [])
    
    policy_excerpts = "\n".join([f"[{m.get('policy_name', 'Policy')} | {m.get('section', '')} | Page {m.get('page', '')}]: {m.get('text', '')[:500]}" for m in policy_matches[:5]])
    
    system_prompt = """You are an administrative assistant for healthcare prior authorization and appeals. Generate a missing documentation checklist based on case facts and policy requirements.

Return ONLY valid JSON with no markdown formatting."""

    user_prompt = f"""Using the case facts and policy excerpts, produce a checklist of required documentation.

CASE FACTS:
{json.dumps(extracted_facts, indent=2)}

POLICY EXCERPTS:
{policy_excerpts if policy_excerpts else 'No matching policies found'}

Return JSON array:
[
  {{"item":"...", "required_by_policy_citation":"[CITATION: PolicyName | Section | Page]", "status":"Present|Missing|Unknown", "notes":"..."}}
]"""

    response = await call_llm(system_prompt, user_prompt)
    
    try:
        json_match = re.search(r'\[[\s\S]*\]', response)
        if json_match:
            checklist = json.loads(json_match.group())
        else:
            checklist = [{"item": "Unable to generate checklist", "status": "Unknown", "notes": response[:200]}]
    except json.JSONDecodeError:
        checklist = [{"item": "Parse error", "status": "Unknown", "notes": response[:200]}]
    
    denial_analysis = {
        'denial_category': extracted_facts.get('denial_reason_category', 'unknown'),
        'denial_reasons': extracted_facts.get('denial_reasons', []),
        'missing_docs_checklist': checklist,
        'analyzed_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.cases.update_one(
        {'id': case_id},
        {'$set': {'denial_analysis': denial_analysis, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    await create_audit_log(user['id'], user.get('organization_id'), 'analyze_denial', case_id)
    
    return {'denial_analysis': denial_analysis}

@api_router.post("/cases/{case_id}/generate-draft")
async def generate_appeal_draft(case_id: str, user=Depends(get_current_user)):
    """Generate appeal letter draft with citations."""
    case = await db.cases.find_one({'id': case_id, 'organization_id': user.get('organization_id')})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    extracted_facts = case.get('extracted_facts', {})
    policy_matches = case.get('policy_matches', [])
    
    policy_excerpts_json = json.dumps([{
        'policy_name': m.get('policy_name', ''),
        'effective_date': m.get('effective_date', ''),
        'section': m.get('section', ''),
        'page': m.get('page', ''),
        'excerpt_id': m.get('excerpt_id', ''),
        'text': m.get('text', '')[:500]
    } for m in policy_matches[:5]], indent=2)
    
    case_json = json.dumps({
        'payer': case.get('payer', ''),
        'state': case.get('state', ''),
        'cpt_codes': case.get('cpt_codes', []),
        'icd10_codes': case.get('icd10_codes', []),
        'patient_name': '[PATIENT NAME]',
        'extracted_facts': extracted_facts
    }, indent=2)
    
    system_prompt = """You are an administrative assistant for healthcare prior authorization and appeals. Draft a first-level appeal letter.

Hard rules:
- If information is missing, ask for it or list it as "Missing".
- Do not invent clinical facts, codes, dates, or policy criteria.
- Every policy-based claim must include a citation: [CITATION: PolicyName | EffectiveDate | Section/Page | ExcerptID]
- If you cannot find support in the retrieved policy text, say so and mark the draft "Not reviewable".
- Use a professional, concise tone suitable for payer appeals.

Return ONLY valid JSON with no markdown formatting."""

    user_prompt = f"""Draft a first-level appeal letter using:
- the extracted case facts (CASE_JSON)
- the retrieved policy excerpts (POLICY_EXCERPTS)

Requirements:
- Address the denial reasons explicitly.
- Cite payer policy excerpts whenever you reference criteria or coverage rules.
- If the excerpts do not support the appeal, state that and mark "Not reviewable".
- Include:
  1) short executive summary
  2) case background (service requested, codes, dates)
  3) point-by-point response to denial reason(s)
  4) attachments checklist
  5) citations section listing each excerpt used

CASE_JSON:
{case_json}

POLICY_EXCERPTS:
{policy_excerpts_json if policy_matches else '[]'}

Return:
{{
  "reviewable": true/false,
  "appeal_letter": "...",
  "attachments_checklist": ["..."],
  "citations_used": ["..."]
}}"""

    response = await call_llm(system_prompt, user_prompt)
    
    try:
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            draft_data = json.loads(json_match.group())
        else:
            draft_data = {
                "reviewable": False,
                "appeal_letter": response,
                "attachments_checklist": [],
                "citations_used": []
            }
    except json.JSONDecodeError:
        draft_data = {
            "reviewable": False,
            "appeal_letter": response,
            "attachments_checklist": [],
            "citations_used": []
        }
    
    generated_draft = {
        **draft_data,
        'generated_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.cases.update_one(
        {'id': case_id},
        {'$set': {'generated_draft': generated_draft, 'status': 'draft_appeal', 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    await create_audit_log(user['id'], user.get('organization_id'), 'generate_draft', case_id)
    
    return {'generated_draft': generated_draft}

@api_router.post("/cases/{case_id}/regenerate")
async def regenerate_draft(case_id: str, user=Depends(get_current_user)):
    """Regenerate the appeal draft."""
    return await generate_appeal_draft(case_id, user)

@api_router.post("/cases/{case_id}/mark-reviewed")
async def mark_reviewed(case_id: str, user=Depends(get_current_user)):
    """Mark case as reviewed."""
    case = await db.cases.find_one({'id': case_id, 'organization_id': user.get('organization_id')})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    await db.cases.update_one(
        {'id': case_id},
        {'$set': {'reviewed': True, 'reviewed_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    await create_audit_log(user['id'], user.get('organization_id'), 'mark_reviewed', case_id)
    
    return {"message": "Case marked as reviewed"}

@api_router.post("/cases/{case_id}/export")
async def export_case(case_id: str, format: str = "pdf", user=Depends(get_current_user)):
    """Export appeal letter to PDF."""
    case = await db.cases.find_one({'id': case_id, 'organization_id': user.get('organization_id')})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    generated_draft = case.get('generated_draft', {})
    appeal_letter = generated_draft.get('appeal_letter', 'No draft available')
    
    # Create HTML for PDF
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }}
            .header {{ text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0F766E; padding-bottom: 20px; }}
            .disclaimer {{ background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin-bottom: 20px; font-size: 12px; }}
            .content {{ white-space: pre-wrap; }}
            .footer {{ margin-top: 30px; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }}
            .citation {{ background: #F0FDFA; padding: 3px 6px; font-size: 11px; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Appeal Letter</h1>
            <p>Case ID: {case_id}</p>
            <p>Generated: {datetime.now().strftime('%B %d, %Y')}</p>
        </div>
        <div class="disclaimer">
            <strong>ADMINISTRATIVE DRAFTING TOOL - NOT MEDICAL ADVICE</strong><br>
            This document was generated by AuthPilot for administrative purposes only. Human review is required before submission.
        </div>
        <div class="content">{appeal_letter}</div>
        <div class="footer">
            <p>Reviewable: {generated_draft.get('reviewable', 'Unknown')}</p>
            <p>Attachments: {', '.join(generated_draft.get('attachments_checklist', []))}</p>
        </div>
    </body>
    </html>
    """
    
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html_content).write_pdf()
        
        await create_audit_log(user['id'], user.get('organization_id'), 'export_case', case_id, {'format': format})
        
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=appeal_letter_{case_id}.pdf"}
        )
    except Exception as e:
        logging.error(f"PDF export error: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

# Policy Routes
@api_router.post("/policies")
async def create_policy(policy_data: PolicyCreate, user=Depends(get_current_user)):
    policy_id = str(uuid.uuid4())
    policy_doc = {
        'id': policy_id,
        'organization_id': user.get('organization_id'),
        'payer': policy_data.payer,
        'state': policy_data.state,
        'effective_date': policy_data.effective_date,
        'category': policy_data.category,
        'name': policy_data.name,
        'content': policy_data.content,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.policies.insert_one(policy_doc)
    
    # If content provided, create chunks for RAG
    if policy_data.content:
        await index_policy_content(policy_id, policy_data.name, policy_data.payer, policy_data.state, policy_data.effective_date, policy_data.content)
    
    return {**policy_doc, '_id': None}

@api_router.post("/policies/{policy_id}/upload")
async def upload_policy_file(
    policy_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    policy = await db.policies.find_one({'id': policy_id, 'organization_id': user.get('organization_id')})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    file_bytes = await file.read()
    
    # Extract text
    if file.filename.lower().endswith('.pdf'):
        content = extract_text_from_pdf(file_bytes)
    else:
        content = file_bytes.decode('utf-8', errors='ignore')
    
    # Save file
    file_path = UPLOAD_DIR / f"policy_{policy_id}_{file.filename}"
    with open(file_path, 'wb') as f:
        f.write(file_bytes)
    
    # Update policy
    await db.policies.update_one(
        {'id': policy_id},
        {'$set': {'content': content, 'file_path': str(file_path), 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    # Index for RAG
    await index_policy_content(policy_id, policy['name'], policy['payer'], policy['state'], policy['effective_date'], content)
    
    return {"message": "Policy file uploaded and indexed", "content_length": len(content)}

async def index_policy_content(policy_id: str, name: str, payer: str, state: str, effective_date: str, content: str):
    """Chunk and index policy content for RAG."""
    # Delete existing chunks
    await db.policy_chunks.delete_many({'policy_id': policy_id})
    
    # Simple chunking by paragraphs/sections
    chunks = []
    paragraphs = content.split('\n\n')
    
    current_section = "General"
    page_num = 1
    
    for i, para in enumerate(paragraphs):
        if len(para.strip()) < 50:
            # Might be a section header
            if para.strip():
                current_section = para.strip()[:100]
            continue
        
        # Estimate page number
        if i > 0 and i % 10 == 0:
            page_num += 1
        
        chunk_id = str(uuid.uuid4())
        embedding = compute_embedding(para[:1000])
        
        chunk_doc = {
            'id': chunk_id,
            'policy_id': policy_id,
            'policy_name': name,
            'payer': payer,
            'state': state,
            'effective_date': effective_date,
            'section': current_section,
            'page': page_num,
            'text': para[:2000],
            'embedding': embedding
        }
        chunks.append(chunk_doc)
    
    if chunks:
        await db.policy_chunks.insert_many(chunks)
    
    logging.info(f"Indexed {len(chunks)} chunks for policy {policy_id}")

@api_router.get("/policies")
async def get_policies(user=Depends(get_current_user)):
    policies = await db.policies.find({'organization_id': user.get('organization_id')}, {'_id': 0, 'content': 0}).to_list(1000)
    return policies

@api_router.get("/policies/{policy_id}")
async def get_policy(policy_id: str, user=Depends(get_current_user)):
    policy = await db.policies.find_one({'id': policy_id, 'organization_id': user.get('organization_id')}, {'_id': 0})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy

@api_router.delete("/policies/{policy_id}")
async def delete_policy(policy_id: str, user=Depends(get_current_user)):
    result = await db.policies.delete_one({'id': policy_id, 'organization_id': user.get('organization_id')})
    await db.policy_chunks.delete_many({'policy_id': policy_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Policy not found")
    return {"message": "Policy deleted"}

# Template Routes
@api_router.post("/templates")
async def create_template(template_data: TemplateCreate, user=Depends(get_current_user)):
    template_id = str(uuid.uuid4())
    template_doc = {
        'id': template_id,
        'organization_id': user.get('organization_id'),
        'name': template_data.name,
        'type': template_data.type,
        'content': template_data.content,
        'tone': template_data.tone,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.templates.insert_one(template_doc)
    return {**template_doc, '_id': None}

@api_router.get("/templates")
async def get_templates(user=Depends(get_current_user)):
    templates = await db.templates.find({'organization_id': user.get('organization_id')}, {'_id': 0}).to_list(100)
    return templates

@api_router.put("/templates/{template_id}")
async def update_template(template_id: str, template_data: TemplateCreate, user=Depends(get_current_user)):
    result = await db.templates.update_one(
        {'id': template_id, 'organization_id': user.get('organization_id')},
        {'$set': {**template_data.model_dump(), 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    template = await db.templates.find_one({'id': template_id}, {'_id': 0})
    return template

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, user=Depends(get_current_user)):
    result = await db.templates.delete_one({'id': template_id, 'organization_id': user.get('organization_id')})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

# Analytics Routes
@api_router.get("/analytics/summary")
async def get_analytics_summary(user=Depends(get_current_user)):
    org_id = user.get('organization_id')
    
    # Get case counts by status
    pipeline = [
        {'$match': {'organization_id': org_id}},
        {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
    ]
    status_counts = await db.cases.aggregate(pipeline).to_list(100)
    
    # Get case counts by payer
    payer_pipeline = [
        {'$match': {'organization_id': org_id}},
        {'$group': {'_id': '$payer', 'count': {'$sum': 1}}}
    ]
    payer_counts = await db.cases.aggregate(payer_pipeline).to_list(100)
    
    # Calculate win rate
    total_resolved = sum(1 for s in status_counts if s['_id'] in ['won', 'lost'])
    won_count = next((s['count'] for s in status_counts if s['_id'] == 'won'), 0)
    win_rate = (won_count / total_resolved * 100) if total_resolved > 0 else 0
    
    return {
        'status_breakdown': {s['_id']: s['count'] for s in status_counts},
        'payer_breakdown': {p['_id']: p['count'] for p in payer_counts},
        'win_rate': round(win_rate, 1),
        'total_cases': sum(s['count'] for s in status_counts)
    }

@api_router.get("/analytics/denial-types")
async def get_denial_type_analytics(user=Depends(get_current_user)):
    org_id = user.get('organization_id')
    
    pipeline = [
        {'$match': {'organization_id': org_id, 'denial_analysis.denial_category': {'$exists': True}}},
        {'$group': {'_id': '$denial_analysis.denial_category', 'count': {'$sum': 1}}}
    ]
    denial_types = await db.cases.aggregate(pipeline).to_list(100)
    
    return {'denial_types': {d['_id']: d['count'] for d in denial_types}}

# Audit Log Routes
@api_router.get("/audit-logs")
async def get_audit_logs(case_id: Optional[str] = None, limit: int = 100, user=Depends(get_current_user)):
    query = {'organization_id': user.get('organization_id')}
    if case_id:
        query['case_id'] = case_id
    
    logs = await db.audit_logs.find(query, {'_id': 0}).sort('timestamp', -1).limit(limit).to_list(limit)
    return logs

# Dashboard Stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user=Depends(get_current_user)):
    org_id = user.get('organization_id')
    
    # Count by status
    new_denials = await db.cases.count_documents({'organization_id': org_id, 'status': 'new_denial'})
    draft_appeals = await db.cases.count_documents({'organization_id': org_id, 'status': 'draft_appeal'})
    submitted = await db.cases.count_documents({'organization_id': org_id, 'status': 'submitted'})
    won = await db.cases.count_documents({'organization_id': org_id, 'status': 'won'})
    lost = await db.cases.count_documents({'organization_id': org_id, 'status': 'lost'})
    
    # Due soon (within 7 days)
    seven_days = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    due_soon = await db.cases.count_documents({
        'organization_id': org_id,
        'status': {'$nin': ['won', 'lost', 'submitted']},
        'due_date': {'$lte': seven_days}
    })
    
    return {
        'new_denials': new_denials,
        'draft_appeals': draft_appeals,
        'submitted': submitted,
        'won': won,
        'lost': lost,
        'due_soon': due_soon,
        'total': new_denials + draft_appeals + submitted + won + lost
    }

# Seed Data Route (for development)
@api_router.post("/seed")
async def seed_data():
    """Seed test data for development."""
    # Check if already seeded
    existing = await db.users.find_one({'email': 'demo@authpilot.com'})
    if existing:
        return {"message": "Data already seeded"}
    
    # Create demo organization and user
    org_id = str(uuid.uuid4())
    await db.organizations.insert_one({
        'id': org_id,
        'name': 'Demo Specialty Clinic',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        'id': user_id,
        'email': 'demo@authpilot.com',
        'password_hash': hash_password('demo123'),
        'name': 'Demo User',
        'organization_id': org_id,
        'organization_name': 'Demo Specialty Clinic',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    # Create sample payers/policies
    payers = [
        {'name': 'Blue Cross Blue Shield', 'state': 'CA'},
        {'name': 'Aetna', 'state': 'NY'}
    ]
    
    policy_contents = [
        """BLUE CROSS BLUE SHIELD - CALIFORNIA
Medical Policy: Prior Authorization for Advanced Imaging

Section 1: Coverage Criteria
MRI and CT scans require prior authorization for the following conditions:
- Musculoskeletal imaging beyond initial X-ray
- Neurological imaging without acute presentation
- Cardiac imaging for non-emergent evaluation

Section 2: Documentation Requirements
All requests must include:
1. Clinical notes supporting medical necessity
2. Previous imaging results if applicable
3. Treatment history and conservative therapy documentation
4. Specific CPT codes and ICD-10 diagnosis codes

Section 3: Medical Necessity Criteria
Coverage is approved when:
- Conservative treatment has failed (minimum 6 weeks)
- Clinical examination supports need for advanced imaging
- Imaging will change treatment plan

Section 4: Appeals Process
First-level appeals must be submitted within 60 days of denial.
Include additional clinical documentation supporting medical necessity.""",
        
        """AETNA - NEW YORK
Clinical Policy Bulletin: Durable Medical Equipment

Section A: Coverage Guidelines
DME is covered when:
- Prescribed by treating physician
- Medically necessary for treatment
- Used in patient's home setting

Section B: Prior Authorization Requirements
The following DME categories require PA:
- Power wheelchairs and scooters
- Hospital beds
- Oxygen equipment
- CPAP/BiPAP devices

Section C: Documentation Standards
Submit with PA request:
1. Physician's prescription
2. Clinical notes demonstrating need
3. Previous equipment usage history
4. Patient mobility assessment (for wheelchairs)

Section D: Denial Appeals
Appeals must include:
- Letter of medical necessity from physician
- Additional clinical evidence
- Peer-reviewed literature supporting coverage"""
    ]
    
    for i, payer in enumerate(payers):
        policy_id = str(uuid.uuid4())
        await db.policies.insert_one({
            'id': policy_id,
            'organization_id': org_id,
            'payer': payer['name'],
            'state': payer['state'],
            'effective_date': '2024-01-01',
            'category': 'Medical Policy',
            'name': f"{payer['name']} - {payer['state']} Policy",
            'content': policy_contents[i],
            'created_at': datetime.now(timezone.utc).isoformat()
        })
        
        # Index policy content
        await index_policy_content(policy_id, f"{payer['name']} - {payer['state']} Policy", payer['name'], payer['state'], '2024-01-01', policy_contents[i])
    
    # Create sample cases
    cases = [
        {
            'payer': 'Blue Cross Blue Shield',
            'state': 'CA',
            'cpt_codes': ['72148'],
            'icd10_codes': ['M54.5'],
            'request_type': 'Appeal',
            'due_date': (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()[:10],
            'status': 'new_denial',
            'patient_name': 'John Smith',
        },
        {
            'payer': 'Aetna',
            'state': 'NY',
            'cpt_codes': ['E1390'],
            'icd10_codes': ['G47.33'],
            'request_type': 'Appeal',
            'due_date': (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()[:10],
            'status': 'draft_appeal',
            'patient_name': 'Jane Doe',
        },
        {
            'payer': 'Blue Cross Blue Shield',
            'state': 'CA',
            'cpt_codes': ['70553'],
            'icd10_codes': ['G43.909'],
            'request_type': 'Appeal',
            'due_date': (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()[:10],
            'status': 'new_denial',
            'patient_name': 'Robert Johnson',
        }
    ]
    
    for case in cases:
        case_id = str(uuid.uuid4())
        await db.cases.insert_one({
            'id': case_id,
            'user_id': user_id,
            'organization_id': org_id,
            **case,
            'extracted_facts': {},
            'policy_matches': [],
            'denial_analysis': {},
            'generated_draft': None,
            'documents': [],
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        })
    
    # Create default templates
    templates = [
        {
            'name': 'Standard Appeal Letter',
            'type': 'appeal',
            'tone': 'professional',
            'content': 'Dear [PAYER]:\n\nI am writing to formally appeal the denial of coverage for [SERVICE]...'
        },
        {
            'name': 'Urgent Appeal Letter',
            'type': 'appeal',
            'tone': 'urgent',
            'content': 'URGENT APPEAL\n\nDear [PAYER]:\n\nThis letter constitutes a formal appeal requiring immediate attention...'
        }
    ]
    
    for template in templates:
        await db.templates.insert_one({
            'id': str(uuid.uuid4()),
            'organization_id': org_id,
            **template,
            'created_at': datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Seed data created", "demo_credentials": {"email": "demo@authpilot.com", "password": "demo123"}}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
