import hashlib

from dunyo_mobile.config import settings


class ClickService:
    BASE_URL = "https://my.click.uz/services/pay"

    def generate_payment_url(self, order_id: int, amount_uzs: int) -> str:
        return (
            f"{self.BASE_URL}"
            f"?service_id={settings.CLICK_MERCHANT_ID}"
            f"&merchant_id={settings.CLICK_MERCHANT_ID}"
            f"&amount={amount_uzs}"
            f"&transaction_param={order_id}"
            f"&return_url=https://t.me/DunyoMobileBot"
        )

    def verify_signature(
        self,
        click_trans_id: str,
        service_id: str,
        secret_key: str,
        merchant_trans_id: str,
        amount: str,
        action: str,
        sign_time: str,
    ) -> str:
        sign_string = (
            f"{click_trans_id}{service_id}{secret_key}"
            f"{merchant_trans_id}{amount}{action}{sign_time}"
        )
        return hashlib.md5(sign_string.encode()).hexdigest()


click_service = ClickService()
