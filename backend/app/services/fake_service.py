"""Service factice pour simuler un appel à une API d'essayage virtuel."""
from __future__ import annotations

import asyncio
from typing import Dict, List, Optional, Union

from app.schemas.tryon import ProductInfo

ProductInfoLike = Union[ProductInfo, Dict[str, Union[str, int, None]]]


class FakeService:
    """Simule les résultats d'un service d'essayage virtuel externe."""

    async def generate_results(
        self,
        person_image_url: str,
        product_ids: List[int],
        products_info: Optional[List[ProductInfoLike]] = None,
    ) -> Dict[str, Dict[str, Union[str, int, None]]]:
        """Génère des résultats factices après un délai simulé."""

        await asyncio.sleep(min(1.0 + len(product_ids) * 0.5, 4.0))

        info_map: Dict[int, ProductInfoLike] = {}
        if products_info:
            for item in products_info:
                raw_id = getattr(item, "id", None)
                if raw_id is None and isinstance(item, dict):
                    raw_id = item.get("id")
                if raw_id is None:
                    continue

                try:
                    product_id = int(raw_id)  # type: ignore[arg-type]
                except (TypeError, ValueError):
                    continue

                info_map[product_id] = item

        results: Dict[str, Dict[str, Union[str, int, None]]] = {}
        for product_id in product_ids:
            info = info_map.get(product_id)
            name: Optional[str] = None
            description: Optional[str] = None
            price: Optional[str] = None

            if info is not None:
                if isinstance(info, ProductInfo):
                    name = info.name
                    description = getattr(info, "description", None)
                    price = info.price
                else:
                    name = info.get("name")  # type: ignore[assignment]
                    description = info.get("description")  # type: ignore[assignment]
                    price = info.get("price")  # type: ignore[assignment]

            if not name:
                name = f"Produit #{product_id}"

            if price is not None:
                price = str(price)

            results[f"product_{product_id}"] = {
                "product_id": product_id,
                "product_name": name,
                "product_description": description,
                "product_price": price,
                "result_image": person_image_url,
                "status": "success",
            }

        return results
