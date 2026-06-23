"""Общий пакет инфраструктуры Python-сервисов EPTA.

Сервисы импортируют подмодули напрямую, например::

    from epta_common.app import create_app
    from epta_common.db import Base, ensure_schema
    from epta_common.settings import get_settings

Пакет намеренно НЕ реэкспортит ``create_app`` на уровне ``__init__`` —
это исключает циклический импорт между ``app`` и остальными модулями.
"""

__version__ = "0.1.0"
