from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    echo=settings.SQL_ECHO,
    pool_pre_ping=True,
)

# expire_on_commit=False is load-bearing: without it, touching an attribute
# after await db.commit() triggers a lazy refresh outside the greenlet context
# and raises MissingGreenlet.
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
