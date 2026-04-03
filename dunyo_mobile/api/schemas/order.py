from pydantic import BaseModel


class OrderOut(BaseModel):
    id: int
    user_id: int
    status: str
    payment_status: str
    total_price: int

    model_config = {"from_attributes": True}
