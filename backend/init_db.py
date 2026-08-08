import subprocess
import sys

def init_db():
    subprocess.run([sys.executable, "-c", """
import asyncio
from app.core.database import init_collections

async def main():
    await init_collections()

if __name__ == "__main__":
    asyncio.run(main())
"""])

if __name__ == "__main__":
    init_db()
