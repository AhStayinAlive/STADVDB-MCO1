from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import kpi, aggregate

app = FastAPI(title="OLAP API")

# Allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(kpi.router)
app.include_router(aggregate.router)

@app.get("/")
def root():
    return {"message": "Backend API is running"}
