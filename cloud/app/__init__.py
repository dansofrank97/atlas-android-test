# Atlas Cloud package bootstrap.
# Apply runtime resolver hardening and the business operating kernel before
# callers import app.advanced_main directly.
from . import advanced_main as _engine
from .resolver_overrides import apply as _apply_resolver_overrides
from .business_kernel import apply as _apply_business_kernel

_apply_resolver_overrides(_engine)
_apply_business_kernel(_engine)
