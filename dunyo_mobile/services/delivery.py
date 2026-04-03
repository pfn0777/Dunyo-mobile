from dunyo_mobile.config import settings

TASHKENT_KEYWORDS = ("toshkent", "ташкент", "tashkent")


def get_delivery_price(address: str) -> int:
    """Return delivery price (UZS) based on address keyword matching."""
    if any(kw in address.lower() for kw in TASHKENT_KEYWORDS):
        return settings.DELIVERY_TASHKENT_PRICE
    return settings.DELIVERY_REGION_PRICE
