import logging

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from dunyo_mobile.bot.keyboards.inline import order_status_kb
from dunyo_mobile.bot.states.order_states import BroadcastStates
from dunyo_mobile.config import settings
from dunyo_mobile.db.models.order import Order, OrderItem, OrderStatus, PaymentStatus
from dunyo_mobile.db.models.user import User
from dunyo_mobile.db.session import get_session
from dunyo_mobile.services.notification import notify_order_status

logger = logging.getLogger(__name__)
router = Router()


def is_admin(user_id: int) -> bool:
    return user_id in settings.ADMIN_IDS


# ── Admin panel ──────────────────────────────────────────────────────────────

@router.message(Command("admin"))
async def admin_panel(message: Message) -> None:
    if not is_admin(message.from_user.id):
        return

    builder = InlineKeyboardBuilder()
    builder.button(text="📦 Buyurtmalar", callback_data="admin_orders")
    builder.button(text="📊 Statistika", callback_data="admin_stats")
    builder.button(text="📢 Xabar yuborish", callback_data="admin_broadcast")
    builder.adjust(2, 1)

    await message.answer(
        "🔧 <b>Admin panel — Dunyo Mobile</b>",
        reply_markup=builder.as_markup(),
    )


# ── Orders list ──────────────────────────────────────────────────────────────

@router.callback_query(F.data == "admin_orders")
async def admin_orders(callback: CallbackQuery) -> None:
    if not is_admin(callback.from_user.id):
        return await callback.answer()

    try:
        async with get_session() as session:
            result = await session.execute(
                select(Order).order_by(Order.created_at.desc()).limit(10)
            )
            orders = result.scalars().all()

        if not orders:
            await callback.message.edit_text("Hozircha buyurtmalar yo'q.")
            return

        status_icons = {
            "pending": "⏳",
            "confirmed": "✅",
            "delivering": "🚚",
            "delivered": "📬",
            "cancelled": "❌",
        }
        builder = InlineKeyboardBuilder()
        for o in orders:
            icon = status_icons.get(o.status.value, "❓")
            builder.button(
                text=f"{icon} #{o.id} — {o.total_price:,} UZS",
                callback_data=f"admin_order_{o.id}",
            )
        builder.adjust(1)

        await callback.message.edit_text(
            "📦 <b>So'nggi 10 buyurtma:</b>",
            reply_markup=builder.as_markup(),
        )
        await callback.answer()
    except Exception as e:
        logger.error("admin_orders error: %s", e)
        await callback.answer("Xatolik yuz berdi.", show_alert=True)


@router.callback_query(F.data.startswith("admin_order_"))
async def admin_order_detail(callback: CallbackQuery) -> None:
    if not is_admin(callback.from_user.id):
        return await callback.answer()

    try:
        order_id = int(callback.data.split("_")[2])
        async with get_session() as session:
            result = await session.execute(
                select(Order)
                .options(selectinload(Order.items).selectinload(OrderItem.product))
                .where(Order.id == order_id)
            )
            order = result.scalar_one_or_none()

        if not order:
            await callback.answer("Buyurtma topilmadi.", show_alert=True)
            return

        items_text = ""
        for item in order.items:
            items_text += f"  • {item.product.name} × {item.quantity}\n"

        text = (
            f"📦 <b>Buyurtma #{order.id}</b>\n\n"
            f"👤 {order.full_name}\n"
            f"📞 {order.phone}\n"
            f"📍 {order.address}\n"
            f"💰 {order.total_price:,} UZS\n"
            f"💳 {order.payment_method.value}\n"
            f"📊 {order.status.value}\n\n"
            f"Mahsulotlar:\n{items_text}"
        )
        await callback.message.edit_text(text, reply_markup=order_status_kb(order.id))
        await callback.answer()
    except Exception as e:
        logger.error("admin_order_detail error: %s", e)
        await callback.answer("Xatolik yuz berdi.", show_alert=True)


# ── Order status changes ──────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("order_confirm_"))
async def order_confirm(callback: CallbackQuery, bot: Bot) -> None:
    if not is_admin(callback.from_user.id):
        return await callback.answer()
    await _update_order_status(
        callback, bot, OrderStatus.confirmed, "Buyurtmangiz tasdiqlandi! ✅"
    )


@router.callback_query(F.data.startswith("order_deliver_"))
async def order_deliver(callback: CallbackQuery, bot: Bot) -> None:
    if not is_admin(callback.from_user.id):
        return await callback.answer()
    await _update_order_status(
        callback, bot, OrderStatus.delivering, "Buyurtmangiz yetkazilmoqda 🚚"
    )


@router.callback_query(F.data.startswith("order_cancel_"))
async def order_cancel(callback: CallbackQuery, bot: Bot) -> None:
    if not is_admin(callback.from_user.id):
        return await callback.answer()
    await _restore_stock_and_cancel(callback, bot)


async def _update_order_status(
    callback: CallbackQuery, bot: Bot, new_status: OrderStatus, user_msg: str
) -> None:
    try:
        parts = callback.data.split("_")
        order_id = int(parts[-1])
        async with get_session() as session:
            order = await session.get(Order, order_id)
            if not order:
                await callback.answer("Buyurtma topilmadi.", show_alert=True)
                return
            order.status = new_status

        await notify_order_status(bot, order, user_msg)
        await callback.answer(f"✅ #{order_id} yangilandi")
        await callback.message.edit_text(
            callback.message.text + f"\n\n✅ Holat: <b>{new_status.value}</b>"
        )
    except Exception as e:
        logger.error("_update_order_status error: %s", e)
        await callback.answer("Xatolik yuz berdi.", show_alert=True)


async def _restore_stock_and_cancel(callback: CallbackQuery, bot: Bot) -> None:
    try:
        from dunyo_mobile.db.models.product import Product

        order_id = int(callback.data.split("_")[-1])
        async with get_session() as session:
            result = await session.execute(
                select(Order)
                .options(selectinload(Order.items))
                .where(Order.id == order_id)
            )
            order = result.scalar_one_or_none()
            if not order:
                await callback.answer("Buyurtma topilmadi.", show_alert=True)
                return
            if order.status == OrderStatus.cancelled:
                await callback.answer("Allaqachon bekor qilingan.", show_alert=True)
                return

            for item in order.items:
                product = await session.get(Product, item.product_id)
                if product:
                    product.stock += item.quantity

            order.status = OrderStatus.cancelled

        await notify_order_status(bot, order, "Buyurtmangiz bekor qilindi ❌")
        await callback.answer(f"❌ #{order_id} bekor qilindi")
        await callback.message.edit_text(
            callback.message.text + "\n\n❌ Holat: <b>cancelled</b>"
        )
    except Exception as e:
        logger.error("_restore_stock_and_cancel error: %s", e)
        await callback.answer("Xatolik yuz berdi.", show_alert=True)


# ── Statistics ────────────────────────────────────────────────────────────────

@router.message(Command("stats"))
@router.callback_query(F.data == "admin_stats")
async def admin_stats(event) -> None:
    user_id = event.from_user.id
    if not is_admin(user_id):
        return

    try:
        from datetime import date, datetime, timezone

        today_start = datetime.combine(date.today(), datetime.min.time()).replace(
            tzinfo=timezone.utc
        )

        async with get_session() as session:
            # Today's orders
            today_count_result = await session.execute(
                select(func.count(Order.id)).where(Order.created_at >= today_start)
            )
            today_count = today_count_result.scalar() or 0

            # Today's paid total
            today_total_result = await session.execute(
                select(func.coalesce(func.sum(Order.total_price), 0)).where(
                    Order.created_at >= today_start,
                    Order.payment_status == PaymentStatus.paid,
                )
            )
            today_total = today_total_result.scalar() or 0

            # All-time users
            users_count_result = await session.execute(select(func.count(User.id)))
            users_count = users_count_result.scalar() or 0

        text = (
            f"📊 <b>Statistika</b>\n\n"
            f"📅 Bugun:\n"
            f"  • Buyurtmalar: <b>{today_count}</b>\n"
            f"  • To'langan: <b>{today_total:,} UZS</b>\n\n"
            f"👥 Jami foydalanuvchilar: <b>{users_count}</b>"
        )

        if hasattr(event, "message"):
            await event.message.edit_text(text)
            await event.answer()
        else:
            await event.answer(text)
    except Exception as e:
        logger.error("admin_stats error: %s", e)


# ── Broadcast ─────────────────────────────────────────────────────────────────

@router.message(Command("broadcast"))
@router.callback_query(F.data == "admin_broadcast")
async def broadcast_start(event, state: FSMContext) -> None:
    user_id = event.from_user.id
    if not is_admin(user_id):
        return

    if hasattr(event, "message"):
        await event.message.answer("📢 Yubormoqchi bo'lgan xabarni kiriting:")
        await event.answer()
    else:
        await event.answer("📢 Yubormoqchi bo'lgan xabarni kiriting:")

    await state.set_state(BroadcastStates.waiting_message)


@router.message(BroadcastStates.waiting_message)
async def broadcast_send(message: Message, state: FSMContext, bot: Bot) -> None:
    if not is_admin(message.from_user.id):
        return

    text = message.text or message.caption or ""
    success = 0
    fail = 0

    try:
        async with get_session() as session:
            result = await session.execute(
                select(User.id).where(User.is_banned == False)  # noqa: E712
            )
            user_ids = result.scalars().all()

        for uid in user_ids:
            try:
                await bot.send_message(uid, text, parse_mode="HTML")
                success += 1
            except Exception:
                fail += 1

        await message.answer(
            f"📢 Xabar yuborildi!\n✅ Muvaffaqiyatli: {success}\n❌ Xatolik: {fail}"
        )
    except Exception as e:
        logger.error("broadcast_send error: %s", e)
        await message.answer("Xatolik yuz berdi.")
    finally:
        await state.clear()


