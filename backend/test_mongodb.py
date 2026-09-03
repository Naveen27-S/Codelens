from pymongo import MongoClient
import sys

def test_connection():
    print("Testing MongoDB Connection...")
    try:
        # Connect to local MongoDB
        client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=2000)
        db = client["codelens_db"]
        
        # Insert a test document
        test_doc = {"name": "connection_test", "status": "success"}
        result = db.test_collection.insert_one(test_doc)
        print(f"Insertion successful. Inserted ID: {result.inserted_id}")
        
        # Retrieve the document
        fetched = db.test_collection.find_one({"name": "connection_test"})
        print(f"Retrieved document: {fetched}")
        
        # Delete the document
        delete_result = db.test_collection.delete_one({"name": "connection_test"})
        print(f"Deleted count: {delete_result.deleted_count}")
        
        print("MongoDB test finished successfully!")
        
    except Exception as e:
        print(f"MongoDB test failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_connection()
