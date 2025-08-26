# KB Chat (RAG) – Minimal Test App

## Run

```bash
cd chat
# create .env and fill your OpenAI key if needed
npm i
npm run dev
```

- Server listens on PORT (default 5050)
- Expects the vector server at VECTOR_API_URL (default http://localhost:4000)

## Endpoint

POST /chat
```json
{ "question": "elements of theft" }
```
Response
```json
{ "answer": "...", "sources": [ { "entry_id": "...", "title": "..." } ] }
```
