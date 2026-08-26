from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth
app = FastAPI(title="MedHear API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
@app.get("/")
async def root():
    return {"status": "MedHear API running"}
