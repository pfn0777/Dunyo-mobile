import logging

from aiogram import Bot
from fastapi import APIRouter, Body, HTTPException, Request
from sqlalchemy import select

from dunyo_mobile.config import settings
from dunyo_mobile.db.models.order import Order, PaymentStatus
from dunyo_mobile.db.models.payment import Payment, PaymentProvider, PaymentRecordStatus
from dunyo_mobile.db.session import get_session
from dunyo_mobile.services.notification import notify_order_status
from dunyo_mobile.services.payment.click import click_service
from dunyo_mobile.services.payment.payme import payme_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payment", tags=["payment"])


def _get_bot() -> Bot:
    from dunyo_mobile.bot.main import _bot_instance  # set at startup
    return _bot_instance


# ── Payme JSON-RPC webhook ────────────────────────────────────────────────────

@router.post("/payme")
async def payme_webhook(request: Request, body: dict = Body(...)) -> dict:
    method = body.get("method", "")
    params = body.get("params", {})
    rpc_id = body.get("id")

    # Signature check via HTTP Basic Auth
    auth = request.headers.get("Authorization", "")
    encoded = auth.replace("Basic ", "")
    if not payme_service.verify_signature(params, encoded):
        logger.warning("Payme: invalid signature")
        return {"id": rpc_id, "error": {"code": -32504, "message": "Unauthorized"}}

    if method == "PerformTransaction":
        order_id = int(params.get("account", {}).get("order_id", 0))
        amount = int(params.get("amount", 0)) // 100  # tiyin → UZS

        try:
            async with get_session() as session:
                order = await session.get(Order, order_id)
                if not order:
                    return {"id": rpc_id, "error": {"code": -31099, "message": "Order not found"}}

                order.payment_status = PaymentStatus.paid
                session.add(
                    Payment(
                        order_id=order.id,
                        provider=PaymentProvider.payme,
                        transaction_id=params.get("id"),
                        amount=amount,
                        status=PaymentRecordStatus.completed,
                    )
                )

            bot = _get_bot()
            await notify_order_status(bot, order, "To'lov qabul qilindi ✅ (Payme)")
            admin_bot = _get_bot()
            for admin_id in settings.ADMIN_IDS:
                try:
                    await admin_bot.send_message(
                        admin_id,
                        f"💳 Buyurtma #{order.id} uchun Payme to'lovi qabul qilindi.",
                    )
                except Exception:
                    pass

            return {
                "id": rpc_id,
                "result": {"transaction": params.get("id"), "perform_time": 0, "state": 2},
            }
        except Exception as e:
            logger.error("payme PerformTransaction error: %s", e)
            return {"id": rpc_id, "error": {"code": -31008, "message": "Internal error"}}

    # For other Payme methods return minimal success
    return {"id": rpc_id, "result": {}}


# ── Click webhook ─────────────────────────────────────────────────────────────

@router.post("/click")
async def click_webhook(
    click_trans_id: str,
    service_id: str,
    merchant_trans_id: str,
    amount: str,
    action: str,
    sign_time: str,
    sign_string: str,
    error: int = 0,
) -> dict:
    expected = click_service.verify_signature(
        click_trans_id=click_trans_id,
        service_id=service_id,
        secret_key=settings.CLICK_SECRET_KEY,
        merchant_trans_id=merchant_trans_id,
        amount=amount,
        action=action,
        sign_time=sign_time,
    )
    if sign_string != expected:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if error < 0:
        return {"error": error, "error_note": "Payment failed"}

    if action == "2":  # confirm
        try:
            order_id = int(merchant_trans_id)
            async with get_session() as session:
                order = await session.get(Order, order_id)
                if not order:
                    return {"error": -5, "error_note": "Order not found"}

                order.payment_status = PaymentStatus.paid
                session.add(
                    Payment(
                        order_id=order.id,
                        provider=PaymentProvider.click,
                        transaction_id=click_trans_id,
                        amount=int(float(amount)),
                        status=PaymentRecordStatus.completed,
                    )
                )

            bot = _get_bot()
            await notify_order_status(bot, order, "To'lov qabul qilindi ✅ (Click)")
            for admin_id in settings.ADMIN_IDS:
                try:
                    await bot.send_message(
                        admin_id,
                        f"💳 Buyurtma #{order.id} uchun Click to'lovi qabul qilindi.",
                    )
                except Exception:
                    pass
        except Exception as e:
            logger.error("click webhook error: %s", e)
            return {"error": -9, "error_note": "Internal error"}

    return {"error": 0, "error_note": "Success", "click_trans_id": click_trans_id}
