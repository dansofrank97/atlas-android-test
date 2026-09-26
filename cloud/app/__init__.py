# Atlas Cloud package bootstrap.
# Apply runtime resolver hardening, the business operating kernel, and the
# deterministic business knowledge layer before callers import
# app.advanced_main directly.
from . import advanced_main as _engine
from .resolver_overrides import apply as _apply_resolver_overrides
from .business_kernel import apply as _apply_business_kernel
from .knowledge_query import apply as _apply_knowledge_query

_apply_resolver_overrides(_engine)
_apply_business_kernel(_engine)
_apply_knowledge_query(_engine)
