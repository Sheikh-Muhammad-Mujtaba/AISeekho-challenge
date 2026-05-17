from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from core.config import settings

# Note: For Neon Postgres async driver, use postgresql+asyncpg://
# E.g. DATABASE_URL should be postgresql+asyncpg://user:pass@ep-host.region.aws.neon.tech/neondb
db_url = settings.DATABASE_URL
if db_url and "sslmode=" in db_url:
    db_url = db_url.replace("sslmode=", "ssl=")

engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    # ── Serverless / Neon pool hardening ──────────────────────────────
    # Ping the DB before handing out a connection to detect stale ones.
    pool_pre_ping=True,
    # Recycle connections after 270s (Neon closes idle at ~300s).
    pool_recycle=270,
    # Keep the pool tiny — each Vercel lambda is single-concurrency.
    pool_size=2,
    max_overflow=3,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    """Yield a scoped async session, guaranteed to close after the request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

