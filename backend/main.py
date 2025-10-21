from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .queries import get_portfolio_kpi

app = FastAPI(title="MCO1 Credit Risk API")

# Allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # replace with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/kpi")
def portfolio_kpi():
    df = get_portfolio_kpi()
    return df.to_dict(orient="records")
