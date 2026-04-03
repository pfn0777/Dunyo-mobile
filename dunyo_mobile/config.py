from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Bot
    BOT_TOKEN: str
    ADMIN_IDS: List[int]
    CHANNEL_ID: str = "@dunyo_mobile"

    # Database
    DATABASE_URL: str

    # Payme
    PAYME_MERCHANT_ID: str
    PAYME_SECRET_KEY: str
    PAYME_TEST_MODE: bool = True

    # Click
    CLICK_MERCHANT_ID: str
    CLICK_SECRET_KEY: str

    # Webhook
    WEBHOOK_URL: str
    WEBHOOK_PATH: str = "/webhook"
    WEBHOOK_SECRET_TOKEN: str = ""

    # Delivery prices (UZS)
    DELIVERY_TASHKENT_PRICE: int = 15000
    DELIVERY_REGION_PRICE: int = 35000


settings = Settings()
