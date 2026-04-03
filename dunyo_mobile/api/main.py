import logging

from fastapi import FastAPI

from dunyo_mobile.api.routers import admin, orders, payment_webhook, products

logger = logging.getLogger(__name__)

app = FastAPI(title="Dunyo Mobile API", version="1.0.0")

app.include_router(products.router)
app.include_router(orders.router)
app.include_router(payment_webhook.router)
app.include_router(admin.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
