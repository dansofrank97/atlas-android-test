# Atlas Cloud package bootstrap.
# Apply runtime resolver hardening before callers import app.advanced_main directly.
from . import advanced_main as _engine
from .resolver_overrides import apply as _apply_resolver_overrides

_apply_resolver_overrides(_engine)
