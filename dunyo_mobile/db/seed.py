"""
Seed initial categories and sample products.
Run from project root: python -m dunyo_mobile.db.seed
"""
import asyncio
import logging

from sqlalchemy import select

from dunyo_mobile.db.models.product import Category, Product
from dunyo_mobile.db.session import get_session

logger = logging.getLogger(__name__)

CATEGORIES = [
    {"name_uz": "Smartfonlar", "name_ru": "Смартфоны", "emoji": "📱", "order": 1},
    {"name_uz": "Aksessuarlar", "name_ru": "Аксессуары", "emoji": "🎧", "order": 2},
    {"name_uz": "Zaryadlovchilar", "name_ru": "Зарядники", "emoji": "🔋", "order": 3},
    {"name_uz": "Qopqoqlar", "name_ru": "Чехлы", "emoji": "🛡️", "order": 4},
    {"name_uz": "Smart soatlar", "name_ru": "Смарт-часы", "emoji": "⌚", "order": 5},
    {"name_uz": "Power bank", "name_ru": "Power bank", "emoji": "🔌", "order": 6},
]

SAMPLE_PRODUCTS = [
    {
        "name": "Samsung Galaxy A55",
        "description": "6.6\" Super AMOLED, 8/256GB, 50MP kamera",
        "price": 4_990_000,
        "old_price": 5_500_000,
        "category_name": "Smartfonlar",
        "stock": 10,
    },
    {
        "name": "iPhone 15 128GB",
        "description": "6.1\" Super Retina XDR, A16 Bionic chip",
        "price": 12_500_000,
        "old_price": None,
        "category_name": "Smartfonlar",
        "stock": 5,
    },
    {
        "name": "AirPods Pro 2",
        "description": "Aktiv shovqin o'chirish, MagSafe qutisi",
        "price": 2_200_000,
        "old_price": None,
        "category_name": "Aksessuarlar",
        "stock": 20,
    },
    {
        "name": "Samsung 65W Zaryadlovchi",
        "description": "Super Fast Charging 2.0, USB-C",
        "price": 180_000,
        "old_price": None,
        "category_name": "Zaryadlovchilar",
        "stock": 50,
    },
]


async def seed() -> None:
    async with get_session() as session:
        # Insert categories
        cat_map: dict[str, int] = {}
        for cat_data in CATEGORIES:
            result = await session.execute(
                select(Category).where(Category.name_uz == cat_data["name_uz"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                cat_map[cat_data["name_uz"]] = existing.id
                logger.info("Category already exists: %s", cat_data["name_uz"])
            else:
                cat = Category(**cat_data)
                session.add(cat)
                await session.flush()
                cat_map[cat_data["name_uz"]] = cat.id
                logger.info("Created category: %s", cat_data["name_uz"])

        # Insert products
        for prod_data in SAMPLE_PRODUCTS:
            cat_name = prod_data.pop("category_name")
            cat_id = cat_map.get(cat_name)
            if not cat_id:
                logger.warning("Category not found: %s", cat_name)
                continue

            result = await session.execute(
                select(Product).where(Product.name == prod_data["name"])
            )
            if result.scalar_one_or_none():
                logger.info("Product already exists: %s", prod_data["name"])
                continue

            product = Product(category_id=cat_id, **prod_data)
            session.add(product)
            logger.info("Created product: %s", prod_data["name"])

    logger.info("Seed completed.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
