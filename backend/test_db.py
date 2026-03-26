import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import KnowledgeItem
import os

from dotenv import load_dotenv
load_dotenv(".env")

engine = create_engine(os.getenv("DATABASE_URL"))
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

items = db.query(KnowledgeItem).filter(KnowledgeItem.title == 'Piwnice').all()
for item in items:
    print(f"ID: {item.id}, Section: {item.section}, Category: {item.category}, Active: {item.is_active}, Language: {item.language}, Meta: {item.metadata_json}")

intent = db.query(KnowledgeItem).filter(KnowledgeItem.section == 'instructions', KnowledgeItem.category == 'shadow_sides').first()
if intent:
    print(f"\nFound instruction for shadow_sides: {intent.id}, Meta: {intent.metadata_json}")
else:
    print("\nNo instruction found for shadow_sides with section='instructions'")
