# Smart Construction Connect

## CV-Ready Project Description

Smart Construction Connect is a full-stack construction marketplace and AI assistant platform that connects clients, construction companies, material suppliers, and administrators in one system. The project combines a React and TypeScript frontend with a FastAPI backend to support role-based dashboards, JWT authentication, company and supplier discovery, project requests, real-time messaging, bilingual English and Urdu support, and an AI recommendation workflow tailored to construction use cases.

The platform includes a retrieval-augmented AI assistant that analyzes user requirements, searches company and supplier data, processes uploaded documents, and returns context-aware recommendations. It also supports live chat through WebSockets, admin monitoring through server-sent events, and JSON-based data persistence with atomic writes and indexing utilities for lightweight deployment without a traditional database server.

## Key Highlights

- Built a multi-role SaaS platform for clients, construction companies, suppliers, and admins with separate workflows and dashboards.
- Developed a FastAPI backend with modular routers for authentication, AI chat, companies, suppliers, admin operations, messaging, uploads, requests, and event streaming.
- Created a React 18 + TypeScript frontend with Vite, Tailwind CSS, Zustand, TanStack Query, and role-aware pages for marketplace browsing, messaging, AI chat, analytics, approvals, and settings.
- Implemented an AI assistant using retrieval-augmented generation, intent extraction, TF-IDF and semantic indexing, session memory, response caching, and OpenRouter model failover.
- Added document understanding features for PDF, Word, Excel, JSON, and image files, including OCR support for extracting content from uploaded files.
- Built real-time messaging with WebSocket delivery, conversation tracking, attachment support, and read-status updates.
- Added bilingual English and Urdu support with RTL handling to improve accessibility for local users.
- Designed the backend around flat-file JSON storage with atomic writes, per-file locking, and background index refresh to keep deployment simple and reliable.

## Technologies Used

- Frontend: React, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query, Framer Motion, i18next
- Backend: FastAPI, Pydantic, Uvicorn, PyJWT, bcrypt, httpx, python-multipart
- AI and Search: OpenRouter, TF-IDF retrieval, semantic embeddings, FAISS, OCR-based file extraction
- Data and Infrastructure: JSON file storage, WebSockets, Server-Sent Events, static SPA serving

## Short Version for Resume

Built Smart Construction Connect, a full-stack AI-powered construction marketplace using React, TypeScript, and FastAPI. Developed role-based dashboards, JWT authentication, real-time messaging, bilingual support, document analysis, and a retrieval-augmented AI assistant for matching clients with construction companies and material suppliers.

## Short Version for LinkedIn or Portfolio

Smart Construction Connect is an AI-enabled marketplace for the construction industry that helps clients discover companies and suppliers, communicate in real time, upload project documents, and receive context-aware recommendations. The platform uses a React frontend, FastAPI backend, and a custom RAG pipeline with semantic search and document processing.