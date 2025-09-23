```json
{
  "id": "blade.blade-thickness",
  "label": "Blade Thickness",
  "summary": "Thickness (Z) through the blade; affects stiffness and mass.",
  "details": [
    "Pair with taper % for realistic dynamics.",
    "Left/Right thickness bias allows asymmetry."
  ],
  "parts": ["blade"],
  "related": ["blade.left-thickness", "blade.right-thickness"]
}
```

Higher values look sturdier; watch weight and breaking strain for very thin blades.
