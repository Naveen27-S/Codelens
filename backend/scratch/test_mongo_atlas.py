"""Quick test: connect to MongoDB Atlas and check/create the dashboard_history collection."""
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ServerSelectionTimeoutError
from datetime import datetime, timezone

MONGO_URL = "mongodb+srv://naveenprasanas265_db_user:EMjF76LNqabH2EWG@codelens.yizexyo.mongodb.net/codelens_db?retryWrites=true&w=majority&appName=CodeLens"
DB_NAME = "codelens_db"

try:
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=8000)
    client.admin.command("ping")
    print("✅ MongoDB Atlas connected successfully!")

    db = client[DB_NAME]
    existing = db.list_collection_names()
    print(f"📁 Existing collections: {existing}")

    # Create dashboard_history collection with indexes
    coll = db["dashboard_history"]

    # Ensure indexes
    coll.create_index([("user_id", ASCENDING)], name="idx_dh_user_id")
    coll.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)], name="idx_dh_user_created")
    coll.create_index([("activity_type", ASCENDING)], name="idx_dh_activity_type")
    print("✅ Indexes created on 'dashboard_history' collection")

    # Insert a sample seed document so collection is visible in Atlas UI
    seed = {
        "user_id": 0,
        "activity_type": "system_init",
        "title": "Dashboard History Initialized",
        "description": "Collection created by CodeLens backend setup.",
        "language": None,
        "program_name": None,
        "topic": None,
        "status": "completed",
        "started_at": datetime.now(timezone.utc),
        "completed_at": datetime.now(timezone.utc),
        "duration_seconds": 0.0,
        "metadata_json": {"version": "1.0"},
        "created_at": datetime.now(timezone.utc),
    }
    result = coll.insert_one(seed)
    print(f"✅ Seed document inserted: {result.inserted_id}")

    # Also ensure indexes on activities collection (already used by activity_service)
    act_coll = db["activities"]
    act_coll.create_index([("user_id", ASCENDING)], name="idx_act_user_id")
    act_coll.create_index([("user_id", ASCENDING), ("started_at", DESCENDING)], name="idx_act_user_started")
    act_coll.create_index([("activity_type", ASCENDING)], name="idx_act_type")
    print("✅ Indexes ensured on 'activities' collection")

    final_collections = db.list_collection_names()
    print(f"\n📁 Final collections in '{DB_NAME}': {final_collections}")
    print("\n🎉 MongoDB Atlas setup complete!")

except ServerSelectionTimeoutError as e:
    print(f"❌ Could not connect: {e}")
except Exception as e:
    print(f"❌ Error: {e}")
