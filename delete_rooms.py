#!/usr/bin/env python3
"""
Delete all existing LiveKit rooms
"""

import asyncio
import os
from dotenv import load_dotenv
from livekit.api import LiveKitAPI, ListRoomsRequest, DeleteRoomRequest

# Load environment variables
load_dotenv()

async def delete_all_rooms():
    """Delete all existing LiveKit rooms"""
    try:
        print("🔧 Connecting to LiveKit API...")

        # Create LiveKit API client
        async with LiveKitAPI() as lkapi:
            print("📋 Listing all rooms...")

            # List all rooms
            rooms_response = await lkapi.room.list_rooms(ListRoomsRequest())
            rooms = rooms_response.rooms

            if not rooms:
                print("✅ No rooms found to delete")
                return

            print(f"🗑️ Found {len(rooms)} rooms to delete:")

            # Delete each room
            for room in rooms:
                try:
                    print(f"  Deleting room: {room.name} (ID: {room.sid})")
                    await lkapi.room.delete_room(DeleteRoomRequest(room=room.name))
                    print(f"  ✅ Deleted room: {room.name}")
                except Exception as e:
                    print(f"  ❌ Failed to delete room {room.name}: {e}")

            print(f"🎉 Successfully deleted {len(rooms)} rooms")

    except Exception as e:
        print(f"❌ Error deleting rooms: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🚀 Starting room cleanup...")
    asyncio.run(delete_all_rooms())
    print("✅ Room cleanup complete")