# Routing rules

- Coordinates are WGS84 latitude/longitude.
- The path is open: there is no depot and no required return to the first stop.
- Prefer a globally shorter practical path over preserving the input order.
- Tie-break deterministically by the lexical stop ID.
- Never infer coordinates from an ID or surrounding context.
- The caller validates the returned permutation and uses a deterministic nearest-neighbor fallback when the response is unavailable or invalid.
