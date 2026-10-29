import os
import sys

# Pastikan folder backend/ ada di path supaya `app.main` bisa diimpor
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.main import app  # noqa: E402,F401