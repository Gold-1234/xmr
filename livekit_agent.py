#!/usr/bin/env python3
"""
LiveKit Medical Assistant Agent
Handles voice conversations for medical report analysis and health insights.
"""

import asyncio
import logging
import os
from dotenv import load_dotenv

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.plugins import noise_cancellation, silero, cartesia
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from livekit.api import LiveKitAPI, ListRoomsRequest, DeleteRoomRequest

# Load environment variables
load_dotenv(".env.local")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("medical-assistant")


class MedicalAssistant(Agent):
    """
    Medical Assistant Agent with specialized healthcare knowledge
    """

    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a professional Medical Assistant AI, specializing in helping patients understand their medical test results and health data.

CORE RESPONSIBILITIES:
- Explain medical test results in simple, understandable language
- Provide context about what lab values mean for health
- Answer questions about symptoms, medications, and health conditions
- Give general health advice and wellness tips
- Help interpret medical terminology and jargon

IMPORTANT GUIDELINES:
- Always be empathetic, supportive, and patient-centered
- Explain medical concepts clearly without overwhelming the patient
- When discussing results, relate them to normal ranges and health implications
- Recommend consulting healthcare professionals for personalized medical advice
- Focus on education and understanding rather than diagnosis
- Use conversational, friendly language while maintaining professionalism

MEDICAL CONTEXT:
- Understand common lab tests (CBC, metabolic panels, lipid panels, etc.)
- Explain reference ranges and what deviations might indicate
- Discuss general health implications of test results
- Provide context about age, gender, and other factors affecting results

RESPONSE STYLE:
- Keep responses clear and concise
- Use simple language, avoid complex medical jargon unless explaining it
- Be encouraging and supportive
- End conversations by offering to answer more questions
- Always emphasize that you're not a replacement for professional medical advice

If the user mentions specific test results, medications, or symptoms, provide helpful context and explanations while encouraging professional medical consultation.""",
        )


# Create the agent server
server = AgentServer()


async def cleanup_existing_rooms():
    """Clean up any existing LiveKit rooms before starting the agent"""
    try:
        logger.info("🧹 Starting room cleanup before agent startup...")

        # Create LiveKit API client
        async with LiveKitAPI() as lkapi:
            # List all rooms
            rooms_response = await lkapi.room.list_rooms(ListRoomsRequest())
            rooms = rooms_response.rooms

            if not rooms:
                logger.info("✅ No existing rooms found - clean slate!")
                return

            logger.info(f"🗑️ Found {len(rooms)} existing rooms to clean up:")

            # Delete each room
            deleted_count = 0
            for room in rooms:
                try:
                    logger.info(f"  Deleting room: {room.name}")
                    await lkapi.room.delete_room(DeleteRoomRequest(room=room.name))
                    deleted_count += 1
                except Exception as e:
                    logger.warning(f"  ⚠️ Failed to delete room {room.name}: {e}")

            logger.info(f"✅ Successfully cleaned up {deleted_count}/{len(rooms)} rooms")

    except Exception as e:
        logger.error(f"❌ Error during room cleanup: {e}")
        logger.warning("⚠️ Continuing with agent startup despite cleanup failure...")


@server.rtc_session()
async def my_medical_agent(ctx: agents.JobContext):
    """
    Medical agent session handler - called when a user joins a room
    """
    logger.info(f"🏥 New medical assistant session started for room: {ctx.room.name}")

    # Create agent session with Cartesia STT and TTS
    session = AgentSession(
        # Use Cartesia for Speech-to-Text (high-quality, auto language detection)
        stt=cartesia.STT(
            model="ink-whisper"
        ),

        # Language Model: OpenAI GPT-4.1 mini for medical intelligence
        llm="openai/gpt-4.1-mini",

        # Use Cartesia for Text-to-Speech (professional medical voice)
        tts=cartesia.TTS(model="sonic-3", voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"),

        # Voice Activity Detection
        vad=silero.VAD.load(),

        # Multilingual turn detection for better conversation flow
        turn_detection=MultilingualModel(),
    )

    logger.info("🎯 Agent session configured with:")
    logger.info("   STT: Cartesia (auto language detection)")
    logger.info("   LLM: OpenAI GPT-4.1 mini")
    logger.info("   TTS: Cartesia Sonic-3 Professional Voice")
    logger.info("   VAD: Silero Voice Activity Detection")
    logger.info("   Turn Detection: Multilingual Model")

    # Create medical assistant agent
    medical_assistant = MedicalAssistant()
    logger.info("🏥 Medical Assistant agent initialized")

    try:
        # Start the agent session with noise cancellation
        await session.start(
            room=ctx.room,
            agent=medical_assistant,
            room_options=room_io.RoomOptions(
                audio_input=room_io.AudioInputOptions(
                    noise_cancellation=lambda params: (
                        noise_cancellation.BVCTelephony()
                        if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                        else noise_cancellation.BVC()
                    ),
                ),
            ),
        )

        # Initial greeting - speak immediately
        logger.info("🎤 TTS LOG: Speaking greeting immediately...")
        await session.say("Hi there, how can I help you today?")
        logger.info("✅ TTS LOG: Greeting spoken")

        # Add delay for audio transmission
        await asyncio.sleep(2)

        # Now start the connection loop
        await ctx.connect()




        @session.on("speech_started")
        def on_speech_started(event):
            logger.info("🎤 TTS LOG: Speech started event received")

        @session.on("speech_stopped")
        def on_speech_stopped(event):
            logger.info("🎤 TTS LOG: Speech stopped event received")

        @session.on("user_input_received")
        def on_user_input(event):
            logger.info(f"🤖 LLM LOG: User input received: {event}")
            logger.info("🤖 LLM LOG: About to generate AI response...")

        @session.on("agent_response_generated")
        def on_agent_response(event):
            logger.info(f"🤖 LLM LOG: Agent response generated: {event}")

        @session.on("llm_started")
        def on_llm_started(event):
            logger.info("🤖 LLM LOG: LLM processing started")

        @session.on("llm_stopped")
        def on_llm_stopped(event):
            logger.info("🤖 LLM LOG: LLM processing completed")

        @session.on("tts_started")
        def on_tts_started(event):
            logger.info("🎤 TTS LOG: TTS generation started")

        @session.on("tts_stopped")
        def on_tts_stopped(event):
            logger.info("🎤 TTS LOG: TTS generation completed")

        

    except Exception as e:
        logger.error(f"❌ Error in medical assistant session: {e}")
        logger.error(f"   Error type: {type(e).__name__}")
        import traceback
        logger.error(f"   Traceback: {traceback.format_exc()}")
   


def sync_cleanup_rooms():
    """Synchronous wrapper for room cleanup"""
    try:
        # Create a new event loop for cleanup
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(cleanup_existing_rooms())
        # Don't close the loop - let LiveKit CLI manage it
    except Exception as e:
        logger.error(f"❌ Failed to run room cleanup: {e}")


def main():
    """Main function to run the agent server with cleanup"""
    # Run the agent server - this will connect to LiveKit Cloud
    logger.info("🚀 Starting LiveKit Medical Assistant Agent Server...")
    logger.info("📡 This agent will be available through LiveKit Cloud")
    logger.info("🤖 Agent Name: medical-assistant")

    try:
        # Clean up existing rooms before starting (synchronously)
        sync_cleanup_rooms()

        # This will run the agent server and handle incoming connections
        agents.cli.run_app(server)
    except KeyboardInterrupt:
        logger.info("👋 Medical Assistant Agent Server stopped by user")
    except Exception as e:
        logger.error(f"💥 Fatal error in agent server: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")


if __name__ == "__main__":
    main()
