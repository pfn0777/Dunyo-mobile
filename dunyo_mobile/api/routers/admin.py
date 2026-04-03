import logging

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from dunyo_mobile.db.models.order import Order, OrderStatus
from dunyo_mobile.db.session import get_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/orders")
async def admin_orders(limit: int = 20) -> list:
    async with get_session() as session:
        result = await session.execute(
            select(Order).order_by(Order.created_at.desc()).limit(limit)
        )
        orders = result.scalars().all()
    return [
        {
            "id": o.id,
            "user_id": o.user_id,
            "status": o.status.value,
            "total_price": o.total_price,
            "created_at": o.created_at.isoformat(),
        }
        for o in orders
    ]


@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: int, status: str) -> dict:
    try:
        new_status = OrderStatus(status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")

    async with get_session() as session:
        order = await session.get(Order, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        order.status = new_status

    return {"id": order_id, "status": new_status.value}
