# PANDI image testing rules

- Accepted image MIME types for AI analysis are `image/jpeg`, `image/png`, and `image/webp`.
- SVG, BMP, and HEIC images must be transcoded before analysis.
- For animated GIF/APNG/animated WEBP, use frame 1 only.
- Resize images before encoding and avoid multi-megabyte base64 payloads.
- Reject blank or solid-colour images rather than claiming they were analyzed.