from fastapi.middleware.cors import CORSMiddleware

from .main import app as core_app

# The Android client currently renders a local WebView (file:// origin) and calls
# the Atlas Cloud HTTPS API directly. Allow only the API methods/headers needed
# by this test client. Authentication is still enforced by the Bearer token in
# app.main.verify_mobile_auth.
core_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app = core_app
