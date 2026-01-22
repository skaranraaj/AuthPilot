# AuthPilot - Product Requirements Document

## Overview
AuthPilot is a web application for healthcare revenue cycle teams to automate prior authorization and appeals drafting using LLM + RAG over payer medical policies.

## Target Users
- Prior authorization specialists at specialty clinics
- Appeals specialists at healthcare organizations

## Architecture
- **Frontend**: React with Tailwind CSS, Shadcn/UI components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **LLM**: OpenAI GPT-5.2 via Emergent LLM Key
- **Vector Search**: In-memory with sentence-transformers (all-MiniLM-L6-v2)
- **Document Processing**: PyPDF2 + Tesseract OCR
- **Export**: WeasyPrint for HTML-to-PDF

## Core Requirements (Static)
1. User creates a Case (payer, state, CPT/HCPCS, ICD-10, request type, due date)
2. User uploads denial letter (required), clinical notes (optional), imaging report (optional)
3. App extracts structured facts from documents using LLM
4. App retrieves relevant payer policy criteria using RAG
5. App generates denial analysis, missing docs checklist, appeal letter with citations
6. User can edit facts, regenerate, mark reviewed, export to PDF
7. Dashboard shows work queue by status

## What's Been Implemented (January 22, 2026)

### Backend APIs
- [x] User authentication (JWT-based login/register)
- [x] Organization management
- [x] Case CRUD operations
- [x] Document upload with OCR extraction
- [x] LLM-powered fact extraction
- [x] Policy RAG retrieval with vector similarity
- [x] Denial analysis with missing docs checklist
- [x] Appeal letter generation with citations
- [x] PDF export with compliance disclaimer
- [x] Templates CRUD
- [x] Analytics endpoints
- [x] Audit logging

### Frontend Pages
- [x] Login page with demo account
- [x] Register page
- [x] Dashboard with work queue and stats
- [x] Create Case form (2-step: details + documents)
- [x] Case Viewer with 4-panel layout
- [x] Policy Library management
- [x] Templates page
- [x] Analytics page with charts

### Design Implementation
- [x] Professional healthcare theme (teal primary, amber accent)
- [x] Compliance banner on all pages
- [x] Status badges (New Denial, Draft Appeal, Submitted, Won, Lost)
- [x] Responsive layout
- [x] Manrope + Inter typography

### Seed Data
- Demo user: demo@authpilot.com / demo123
- 2 sample payers: Blue Cross Blue Shield (CA), Aetna (NY)
- 2 indexed policies
- 3 sample cases

## User Personas
1. **Prior Auth Specialist**: Needs quick case creation, document upload, status tracking
2. **Appeals Specialist**: Needs detailed case analysis, policy citations, draft generation
3. **Manager**: Needs analytics, win rate tracking, team oversight

## Prioritized Backlog

### P0 (Critical - Future)
- [ ] Real document upload testing with sample denial letters
- [ ] Multi-user organization support testing
- [ ] PHI redaction toggle implementation

### P1 (High Priority)
- [ ] Batch processing multiple cases
- [ ] Email notifications for due dates
- [ ] Role-based access control
- [ ] Document preview in case viewer

### P2 (Medium Priority)
- [ ] More detailed analytics (avg drafting time, processing time)
- [ ] Template variable substitution
- [ ] Policy version control
- [ ] Audit log viewer in UI

### P3 (Nice to Have)
- [ ] Dark mode
- [ ] Mobile responsive improvements
- [ ] Export to DOCX format
- [ ] Payer-specific templates
