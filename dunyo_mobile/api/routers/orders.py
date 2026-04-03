import logging

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from dunyo_mobile.db.models.order import Order
from dunyo_mobile.db.session import get_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("/{order_id}")
async def get_order(order_id: int) -> dict:
    async with get_session() as session:
        order = await session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "id": order.id,
        "user_id": order.user_id,
        "status": order.status.value,
        "payment_status": order.payment_status.value,
        "total_price": order.total_price,
        "created_at": order.created_at.isoformat(),
    }
