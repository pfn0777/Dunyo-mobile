import logging

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from dunyo_mobile.bot.keyboards.inline import payment_methods_kb
from dunyo_mobile.bot.keyboards.reply import main_menu_kb
from dunyo_mobile.bot.states.order_states import OrderStates
from dunyo_mobile.db.models.cart import CartItem
from dunyo_mobile.db.models.order import Order, OrderItem, PaymentMethod
from dunyo_mobile.db.session import get_session
from dunyo_mobile.services.delivery import get_delivery_price
from dunyo_mobile.services.notification import notify_admins_new_order
from dunyo_mobile.services.payment.click import click_service
from dunyo_mobile.services.payment.payme import payme_service

logger = logging.getLogger(__name__)
router = Router()


@router.callback_query(F.data == "checkout")
async def checkout_start(callback: CallbackQuery, state: FSMContext) -> None:
    try:
        user_id = callback.from_user.id
        async with get_session() as session:
            result = await session.execute(
                select(CartItem).where(CartItem.user_id == user_id)
            )
            items = result.scalars().all()

        if not items:
            await callback.answer("Savat bo'sh!", show_alert=True)
            return

        await callback.message.answer(
            "📝 Buyurtmani rasmiylashtirish\n\n👤 Ismingizni kiriting:"
        )
        await state.set_state(OrderStates.waiting_name)
        await callback.answer()
    except Exception as e:
        logger.error("checkout_start error: %s", e)
        await callback.answer("Xatolik yuz berdi.", show_alert=True)


@router.message(OrderStates.waiting_name)
async def get_name(message: Message, state: FSMContext) -> None:
    await state.update_data(full_name=message.text)
    await message.answer(
        "📞 Telefon raqamingizni kiriting:\nMisol: +998901234567"
    )
    await state.set_state(OrderStates.waiting_phone)


@router.message(OrderStates.waiting_phone)
async def get_phone(message: Message, state: FSMContext) -> None:
    phone = message.text or ""
    if not any(c.isdigit() for c in phone):
        await message.answer("❌ Noto'g'ri format. Qayta kiriting:")
        return
    await state.update_data(phone=phone)
    await message.answer("📍 Yetkazib berish manzilingizni kiriting:")
    await state.set_state(OrderStates.waiting_address)


@router.message(OrderStates.waiting_address)
async def get_address(message: Message, state: FSMContext) -> None:
    await state.update_data(address=message.text)
    await message.answer(
        "💳 To'lov usulini tanlang:",
        reply_markup=payment_methods_kb(),
    )
    await state.set_state(OrderStates.waiting_payment)


@router.callback_query(OrderStates.waiting_payment, F.data.startswith("pay_"))
async def select_payment(callback: CallbackQuery, state: FSMContext, bot: Bot) -> None:
    try:
        method_str = callback.data.split("_")[1]  # payme | click | cash
        try:
            method = PaymentMethod(method_str)
        except ValueError:
            await callback.answer("Noma'lum to'lov usuli.", show_alert=True)
            return

        data = await state.get_data()
        user_id = callback.from_user.id
        address = data["address"]
        delivery_price = get_delivery_price(address)

        async with get_session() as session:
            # Load cart with products
            result = await session.execute(
                select(CartItem)
                .options(selectinload(CartItem.product))
                .where(CartItem.user_id == user_id)
            )
            cart_items = result.scalars().all()

            if not cart_items:
                await callback.answer("Savat bo'sh!", show_alert=True)
                await state.clear()
                return

            # Validate stock
            for ci in cart_items:
                if ci.product.stock < ci.quantity:
                    await callback.answer(
                        f"❌ {ci.product.name} da yetarli stok yo'q.", show_alert=True
                    )
                    return

            items_total = sum(ci.product.price * ci.quantity for ci in cart_items)
            total_price = items_total + delivery_price

            order = Order(
                user_id=user_id,
                full_name=data["full_name"],
                phone=data["phone"],
                address=address,
                delivery_price=delivery_price,
                total_price=total_price,
                payment_method=method,
            )
            session.add(order)
            await session.flush()  # get order.id

            for ci in cart_items:
                session.add(
                    OrderItem(
                        order_id=order.id,
                        product_id=ci.product_id,
                        quantity=ci.quantity,
                        price=ci.product.price,
                    )
                )
                ci.product.stock -= ci.quantity

            await session.execute(
                delete(CartItem).where(CartItem.user_id == user_id)
            )
            # Reload order with items for notification
            await session.refresh(order)
            result2 = await session.execute(
                select(OrderItem)
                .options(selectinload(OrderItem.product))
                .where(OrderItem.order_id == order.id)
            )
            order.items = result2.scalars().all()

        await state.clear()

        if method == PaymentMethod.cash:
            await callback.message.answer(
                f"✅ Buyurtmangiz <b>#{order.id}</b> qabul qilindi!\n\n"
                f"🚚 Tez orada kuryer siz bilan bog'lanadi.\n"
                f"📞 Savollar uchun: @dunyo_mobile_support",
                reply_markup=main_menu_kb(),
            )
        else:
            if method == PaymentMethod.payme:
                payment_url = payme_service.generate_payment_url(order.id, order.total_price)
            else:
                payment_url = click_service.generate_payment_url(order.id, order.total_price)

            await callback.message.answer(
                f"✅ Buyurtma <b>#{order.id}</b> yaratildi!\n\n"
                f"💳 To'lov qilish uchun:\n{payment_url}",
                reply_markup=main_menu_kb(),
            )

        await notify_admins_new_order(bot, order)
        await callback.answer()
    except Exception as e:
        logger.error("select_payment error: %s", e)
        await callback.answer("Xatolik yuz berdi.", show_alert=True)


@router.message(F.text == "📦 Buyurtmalarim")
async def my_orders(message: Message) -> None:
    try:
        user_id = message.from_user.id
        async with get_session() as session:
            result = await session.execute(
                select(Order)
                .where(Order.user_id == user_id)
                .order_by(Order.created_at.desc())
                .limit(5)
            )
            orders = result.scalars().all()

        if not orders:
            await message.answer("Sizda hali buyurtmalar yo'q.")
            return

        text = "📦 <b>So'nggi buyurtmalaringiz:</b>\n\n"
        status_labels = {
            "pending": "⏳ Kutilmoqda",
            "confirmed": "✅ Tasdiqlangan",
            "delivering": "🚚 Yetkazilmoqda",
            "delivered": "📬 Yetkazildi",
            "cancelled": "❌ Bekor qilindi",
        }
        for o in orders:
            status = status_labels.get(o.status.value, o.status.value)
            text += (
                f"🔹 <b>#{o.id}</b> — {o.total_price:,} UZS\n"
                f"   {status} · {o.created_at.strftime('%d.%m.%Y')}\n\n"
            )

        await message.answer(text)
    except Exception as e:
        logger.error("my_orders error: %s", e)
        await message.answer("Xatolik yuz berdi. Iltimos qayta urinib ko'ring.")
