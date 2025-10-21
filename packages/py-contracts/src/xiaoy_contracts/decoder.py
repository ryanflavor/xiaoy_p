from dataclasses import dataclass, field
from typing import Any, Dict

@dataclass
class UnknownFields:
    count: int = 0
    names: set[str] = field(default_factory=set)

def decode_tick(obj: Any, on_unknown=None) -> Dict[str, Any]:
    if isinstance(obj, (bytes, bytearray)):
        # Placeholder: in real impl decode protobuf/flatbuffers
        raise TypeError("binary decode not implemented in stub")
    if isinstance(obj, str):
        import json
        obj = json.loads(obj)
    if not isinstance(obj, dict):
        raise TypeError("Tick must be a mapping or JSON string")
    out = {
        "ts_ms": int(obj.get("ts_ms", obj.get("ts", 0))),
        "symbol": str(obj.get("symbol", "")),
        "price": float(obj.get("price", float("nan"))),
    }
    if "volume" in obj:
        out["volume"] = int(obj["volume"])
    for k in obj.keys():
        if k not in out:
            if on_unknown:
                on_unknown(k, obj[k])
    if not out["symbol"] or out["price"] != out["price"]:
        raise ValueError("Tick missing required fields")
    return out

