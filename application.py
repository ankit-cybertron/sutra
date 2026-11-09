"""AWS Elastic Beanstalk entry point for Sutra FastAPI application."""

import sys
from pathlib import Path

# Ensure repository root is in Python path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from apps.api.app.main import app

# Elastic Beanstalk looks for 'application' callable by default
application = app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("application:app", host="0.0.0.0", port=5000, reload=True)
