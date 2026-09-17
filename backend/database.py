import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("mongodb+srv://naveenprasanas265_db_user:EMjF76LNqabH2EWG@codelens.yizexyo.mongodb.net/?appName=CodeLens")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "codelens")

if not MONGODB_URL:
    raise ValueError("MONGODB_URL is not configured in backend/.env")

client = MongoClient(MONGODB_URL)

db = client[MONGODB_DATABASE]

# MongoDB collections
executions_collection = db["executions"]
programs_collection = db["programs"]
visualizations_collection = db["visualizations"]
activities_collection = db["activities"]
ai_interactions_collection = db["ai_interactions"]


def test_mongodb_connection():
    try:
        client.admin.command("ping")
        print("MongoDB Atlas connected successfully!")
        return True
    except Exception as e:
        print("MongoDB connection failed:", e)
        return False