import base64
import hashlib

from dunyo_mobile.config import settings


class PaymeService:
    BASE_URL = "https://checkout.paycom.uz"
    TEST_URL = "https://test.paycom.uz"

    def generate_payment_url(self, order_id: int, amount_uzs: int) -> str:
        """Generate Payme checkout URL. Amount is converted to tiyin (×100)."""
        base = self.TEST_URL if settings.PAYME_TEST_MODE else self.BASE_URL
        params = (
            f"m={settings.PAYME_MERCHANT_ID};"
            f"ac.order_id={order_id};"
            f"a={amount_uzs * 100};"
            f"l=uz"
        )
        encoded = base64.b64encode(params.encode()).decode()
        return f"{base}/{encoded}"

    def verify_signature(self, data: dict, signature: str) -> bool:
        key = settings.PAYME_SECRET_KEY
        raw = (data.get("id", "") + key).encode()
        computed = hashlib.sha1(raw).hexdigest()
        return computed == signature


payme_service = PaymeService()
