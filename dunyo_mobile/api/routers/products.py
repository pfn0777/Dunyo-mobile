import logging
from typing import List

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from dunyo_mobile.db.models.product import Category, Product
from dunyo_mobile.db.session import get_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/products", tags=["products"])


@router.get("/categories")
async def list_categories() -> list:
    async with get_session() as session:
        result = await session.execute(
            select(Category).where(Category.is_active == True).order_by(Category.order)  # noqa: E712
        )
        cats = result.scalars().all()
    return [{"id": c.id, "name_uz": c.name_uz, "emoji": c.emoji} for c in cats]


@router.get("/")
async def list_products(category_id: int | None = None) -> list:
    async with get_session() as session:
        q = select(Product).where(Product.is_active == True)  # noqa: E712
        if category_id:
            q = q.where(Product.category_id == category_id)
        result = await session.execute(q)
        products = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "price": p.price,
            "old_price": p.old_price,
            "stock": p.stock,
        }
        for p in products
    ]


@router.get("/{product_id}")
async def get_product(product_id: int) -> dict:
    async with get_session() as session:
        product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "price": product.price,
        "old_price": product.old_price,
        "stock": product.stock,
        "photo_id": product.photo_id,
    }
