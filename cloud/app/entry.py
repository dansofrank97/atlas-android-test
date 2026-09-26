from fastapi.middleware.cors import CORSMiddleware

from .advanced_main import app as core_app

# Atlas Android currently renders a local WebView and calls the Atlas Cloud
# HTTPS API through a native bridge. CORS remains enabled for browser/WebView
# fallback clients; bearer authentication is still enforced by advanced_main.
core_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app = core_app
