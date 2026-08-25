# Import all the models, so that Base has them before being
# imported by Alembic
from app.db.base_class import Base  # noqa
from app.models.user import User  # noqa
from app.models.startup import Startup  # noqa
from app.models.report import Report  # noqa
from app.models.investor_view import InvestorView  # noqa
from app.models.cohort import Cohort  # noqa
from app.models.outcome import Outcome  # noqa
