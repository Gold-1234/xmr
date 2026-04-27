#!/usr/bin/env python3
"""
LiveKit Medical Assistant Agent (livekit-agents v1.x)
"""

import json
import logging
import os

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentServer, AgentSession, Agent, TurnHandlingOptions
from livekit.plugins import google

load_dotenv(".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("medical-assistant")

# Service account JSON for Cloud STT (Chirp) and Cloud TTS
os.environ.setdefault(
    "GOOGLE_APPLICATION_CREDENTIALS",
    os.path.join(os.path.dirname(__file__), "vertex_key.json"),
)

# Always force VERTEX_AI_API_KEY → GOOGLE_API_KEY so google.LLM picks it up
_vertex_key = os.getenv("VERTEX_AI_API_KEY")
if _vertex_key:
    os.environ["GOOGLE_API_KEY"] = _vertex_key


# -----------------------------------------------------------------
# Medical Assistant Agent
# -----------------------------------------------------------------
class MedicalAssistant(Agent):
    def __init__(self, instructions: str = "") -> None:
        super().__init__(instructions=instructions)


# -----------------------------------------------------------------
# Agent server
# -----------------------------------------------------------------
server = AgentServer(
    num_idle_processes=1,
    initialize_process_timeout=30.0,
)


def _build_instructions(metadata: dict) -> str:
    profile = metadata.get("user_profile") or {}
    patient = metadata.get("patient_info") or {}
    tests = metadata.get("extracted_tests") or []
    saved = metadata.get("saved_reports") or []

    name = profile.get("name") or patient.get("name") or "the patient"
    age = profile.get("age") or patient.get("age") or "unknown"

    lines = [
        "You are a professional Medical Assistant AI helping patients understand their health data.",
        "",
        "IMPORTANT GUIDELINES:",
        "- Be empathetic, supportive, and concise (this is a voice interface)",
        "- Recommend consulting healthcare professionals for personalized advice",
        "- Use the patient data below to give specific, relevant answers",
        "",
        f"PATIENT: {name}, Age: {age}",
    ]

    if profile.get("bodyType"):
        lines.append(f"Body type: {profile['bodyType']}")
    if profile.get("currentGoal"):
        lines.append(f"Health goal: {profile['currentGoal']}")
    if profile.get("previousDiseases"):
        lines.append(f"Medical history: {profile['previousDiseases']}")

    if tests:
        lines += ["", "CURRENT REPORT TESTS:"]
        for t in tests[:20]:
            interp = t.get("interpretation", "")
            lines.append(
                f"- {t.get('test_name')}: {t.get('value')} {t.get('unit') or ''} "
                f"[{interp}] ref: {t.get('reference_range') or 'N/A'}"
            )

    if saved:
        lines += ["", f"PAST SAVED REPORTS ({len(saved)} total):"]
        for r in saved[:5]:
            lines.append(f"- {r.get('filename', 'report')} ({r.get('created_at', '')[:10]})")

    lines += [
        "",
        "Use this context to give specific, personalised answers.",
        "If asked about a specific test, refer to the values above.",
    ]
    return "\n".join(lines)


@server.rtc_session(agent_name="medical-assistant")
async def session_handler(ctx: agents.JobContext):
    logger.info(f"New session: {ctx.room.name}")

    metadata = {}
    if ctx.job.metadata:
        try:
            metadata = json.loads(ctx.job.metadata)
        except Exception:
            pass

    instructions = _build_instructions(metadata)

    session = AgentSession(
        stt=google.STT(model="latest_long"),
        llm=google.LLM(model="gemini-2.5-flash-lite"),
        tts=google.TTS(
            voice_name="en-US-Chirp3-HD-Aoede",
        ),
        turn_handling=TurnHandlingOptions(turn_detection=None),
    )

    await session.start(
        room=ctx.room,
        agent=MedicalAssistant(instructions=instructions),
    )

    profile_name = metadata.get("user_profile", {}).get("name") or \
                   metadata.get("patient_info", {}).get("name") or ""
    greeting_name = f", {profile_name}" if profile_name else ""
    has_report = bool(metadata.get("extracted_tests"))
    report_note = " I can see your current report and will use it to answer your questions." if has_report else ""

    await session.say(
        f"Hello{greeting_name}! I'm your medical assistant.{report_note} How can I help you today?"
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
