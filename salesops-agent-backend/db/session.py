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
    future=True
)

AsyncSessionLocal = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
