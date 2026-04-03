import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dunyo_mobile.db.base import Base

if TYPE_CHECKING:
    from dunyo_mobile.db.models.order import Order


class PaymentProvider(str, enum.Enum):
    payme = "payme"
    click = "click"


class PaymentRecordStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id", ondelete="CASCADE")
    )
    provider: Mapped[PaymentProvider] = mapped_column(Enum(PaymentProvider))
    transaction_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    amount: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[PaymentRecordStatus] = mapped_column(
        Enum(PaymentRecordStatus),
        default=PaymentRecordStatus.pending,
        server_default=PaymentRecordStatus.pending,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    order: Mapped["Order"] = relationship(back_populates="payments")
