from pydantic import BaseModel


class ProductOut(BaseModel):
    id: int
    name: str
    price: int
    old_price: int | None
    stock: int
    photo_id: str | None
    description: str | None

    model_config = {"from_attributes": True}


class CategoryOut(BaseModel):
    id: int
    name_uz: str
    emoji: str | None

    model_config = {"from_attributes": True}
