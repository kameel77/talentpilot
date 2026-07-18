"""QA v1 router for Talent->Competency->Action flow."""
import json
import logging
import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from openai import OpenAIError
from sqlalchemy.orm import Session

from auth import get_current_user
from database import SessionLocal, get_db
from models import GeneratedAnswer, UserFeedback, UserQuery, ReviewStatus
from schemas import (
    QAAnswer,
    QAFeedbackRequest,
    QAHistoryItem,
    QAQueryRequest,
    QAQueryResponse,
)
from services.assistant_service import (
    build_prompt,
    compute_question_hash,
    find_similar_query,
    generate_answer,
    get_embedding,
    get_user_in_organization,
    get_user_talents,
    retrieve_instruction,
    retrieve_knowledge,
    stream_answer_chunks,
)
from services.intent_service import classify_intent
from services.settings_service import get_setting

router = APIRouter(prefix="/v1/qa", tags=["qa-v1"])
logger = logging.getLogger(__name__)


def parse_structured_answer(text: str) -> QAAnswer:
    """Parse raw LLM text into Talent/Competency/Action structure.
    
    Expected format (roughly):
    Talent: [Talent Name]
    Kompetencja: [Business Competency]
    Akcja:
    1) Step 1
    2) Step 2
    """
    talent = "General"
    competency = "General Management"
    actions = []
    fallback = False

    try:
        logger.info(f"--- PARSING LLM TEXT ---\n{text}")
        
        # Proactively detect and parse JSON response format
        cleaned_text = text.strip()
        if cleaned_text.startswith("```"):
            lines = cleaned_text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned_text = "\n".join(lines).strip()
            
        try:
            data = json.loads(cleaned_text)
            if isinstance(data, dict):
                msg_content = ""
                if "response" in data:
                    res_val = data["response"]
                    if isinstance(res_val, dict) and "message" in res_val:
                        msg_content = res_val["message"]
                    elif isinstance(res_val, str):
                        msg_content = res_val
                if not msg_content and "message" in data:
                    msg_content = data["message"]
                
                if msg_content:
                    text = msg_content
                    logger.info(f"--- EXTRACTED JSON MESSAGE ---\n{text}")
        except Exception:
            pass

        # Simple regex-based parsing
        talent_match = re.search(r"Talent:\s*(.*)", text, re.IGNORECASE)
        if talent_match:
            talent = talent_match.group(1).split("\n")[0].strip()
        
        comp_match = re.search(r"Kompetencja:\s*(.*)", text, re.IGNORECASE)
        if comp_match:
            competency = comp_match.group(1).split("\n")[0].strip()
            
        # Actions - look for numbered list or bullet points
        action_parts = re.split(r"Akcja:\s*", text, flags=re.IGNORECASE)
        if len(action_parts) > 1:
            actions_text = action_parts[1]
            # Match 1) or - or *
            items = re.findall(r"(?:^\d+[\)\.]\s*|^\-\s*|^[•*]\s*)(.*)", actions_text, re.MULTILINE)
            actions = [i.strip() for i in items if i.strip()]
        
        # Clean up keys if LLM included them in text (sometimes happens with weak models)
        talent = re.sub(r"^\*\*|\*\*$|^\[|\]$", "", talent)
        competency = re.sub(r"^\*\*|\*\*$|^\[|\]$", "", competency)
        
        if not actions:
            # Fallback if parsing fails but text exists
            actions = [line.strip() for line in text.split("\n") if line.strip() and len(line) > 10][:3]
            fallback = True

    except Exception as e:
        logger.error(f"Error parsing structured answer: {e}")
        fallback = True
        actions = ["Nie udało się sformatować odpowiedzi, skontaktuj się z administratorem."]

    return QAAnswer(
        talent=talent,
        competency=competency,
        actions=actions,
        fallback=fallback
    )


@router.post("/query", response_model=QAQueryResponse)
def query_qa(
    request: QAQueryRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    logger.info(f"--- QA QUERY START --- User: {current_user.email}, Q: {request.question}, Context: {request.context}")

    language = request.language or current_user.language or "pl"
    target_user_id = request.target_user_id or current_user.id
    target_user = get_user_in_organization(db, target_user_id, current_user.organization_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Reuse logic for history/caching if needed
    question_hash = compute_question_hash(request.question)
    
    # DEBUG: Temporarily commented out cache to force regeneration
    # existing_query = (
    #     db.query(UserQuery)
    #     .filter(
    #         UserQuery.organization_id == current_user.organization_id,
    #         UserQuery.question_hash == question_hash,
    #         UserQuery.language == language,
    #     )
    #     .order_by(UserQuery.created_at.desc())
    #     .first()
    # )
    # 
    # if existing_query:
    #     existing_answer = (
    #         db.query(GeneratedAnswer)
    #         .filter(GeneratedAnswer.query_id == existing_query.id)
    #         .first()
    #     )
    #     if existing_answer:
    #         logger.info(f"--- QA CACHE HIT --- Query ID: {existing_query.id}")
    #         return QAQueryResponse(
    #             query_id=existing_query.id,
    #             answer_id=existing_answer.id,
    #             answer=parse_structured_answer(existing_answer.answer_text)
    #         )

    # Generate new
    query_embedding = get_embedding(db, request.question)
    
    user_query = UserQuery(
        user_id=current_user.id,
        target_user_id=target_user.id,
        organization_id=current_user.organization_id,
        question=request.question,
        question_hash=question_hash,
        embedding=query_embedding,
        language=language,
        is_unique=True,
    )
    db.add(user_query)
    db.flush()

    talents = get_user_talents(db, target_user.id, language)
    knowledge_items = retrieve_knowledge(db, current_user.organization_id, query_embedding, language)

    # Intent classification: classify question → retrieve matching instruction
    intent = classify_intent(db, request.question, language)
    instruction, render_mode = retrieve_instruction(db, intent, language)
    logger.info(f"--- INTENT: {intent}, RENDER_MODE: {render_mode}, INSTRUCTION: {'found' if instruction else 'none'} ---")

    answer_text, model_name = generate_answer(
        db,
        request.question,
        talents,
        knowledge_items,
        language,
        instruction_content=instruction,
    )
    
    sources = [item.id for item in knowledge_items]
    generated_answer = GeneratedAnswer(
        query_id=user_query.id,
        answer_text=answer_text,
        model_name=model_name,
        sources=sources,
    )
    db.add(generated_answer)
    db.commit()

    # Conditional parsing: only parse into structured format for "structured" render mode
    if render_mode == "structured":
        parsed_answer = parse_structured_answer(answer_text)
    else:
        # For freeform/other modes: minimal structured wrapper, raw text drives rendering
        parsed_answer = QAAnswer(
            talent="",
            competency="",
            actions=[],
            fallback=False,
        )

    return QAQueryResponse(
        query_id=user_query.id,
        answer_id=generated_answer.id,
        answer=parsed_answer,
        answer_raw=answer_text,
        render_mode=render_mode,
    )


from services.sse import sse_event as _sse_event  # noqa: E402  (shared SSE helper)


@router.post("/query/stream")
def query_qa_stream(
    request: QAQueryRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """SSE streaming variant of /query.

    Protocol (Server-Sent Events):
      event: meta  -> {query_id, render_mode}
      event: delta -> {text}            (repeated)
      event: done  -> full QAQueryResponse payload
      event: error -> {detail}

    Honors the admin setting `qa_streaming_enabled`: when disabled, the
    answer is generated non-streaming and emitted as a single delta + done,
    so the client uses one protocol either way.
    """
    logger.info(f"--- QA STREAM START --- User: {current_user.email}, Q: {request.question}")

    language = request.language or current_user.language or "pl"
    target_user_id = request.target_user_id or current_user.id
    target_user = get_user_in_organization(db, target_user_id, current_user.organization_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # --- All DB pre-work happens here, inside the request-scoped session ---
    question_hash = compute_question_hash(request.question)
    query_embedding = get_embedding(db, request.question)

    user_query = UserQuery(
        user_id=current_user.id,
        target_user_id=target_user.id,
        organization_id=current_user.organization_id,
        question=request.question,
        question_hash=question_hash,
        embedding=query_embedding,
        language=language,
        is_unique=True,
    )
    db.add(user_query)
    db.commit()
    db.refresh(user_query)
    query_id = user_query.id

    talents = get_user_talents(db, target_user.id, language)
    knowledge_items = retrieve_knowledge(db, current_user.organization_id, query_embedding, language)
    sources = [item.id for item in knowledge_items]

    intent = classify_intent(db, request.question, language)
    instruction, render_mode = retrieve_instruction(db, intent, language)
    logger.info(f"--- STREAM INTENT: {intent}, RENDER_MODE: {render_mode} ---")

    streaming_enabled = get_setting(db, "qa_streaming_enabled").lower() == "true"
    model_name = get_setting(db, "openrouter_chat_model")
    messages = build_prompt(
        db, request.question, talents, knowledge_items, language,
        instruction_content=instruction,
    )

    # --- Generator runs after the request session may be closed: no `db` usage ---
    def event_generator():
        answer_text = ""
        try:
            yield _sse_event("meta", {"query_id": query_id, "render_mode": render_mode})

            if streaming_enabled:
                for chunk in stream_answer_chunks(model_name, messages):
                    answer_text += chunk
                    yield _sse_event("delta", {"text": chunk})
            else:
                # Toggle off: same protocol, single delta
                session = SessionLocal()
                try:
                    text, _ = generate_answer(
                        session, request.question, talents, knowledge_items,
                        language, instruction_content=instruction,
                    )
                finally:
                    session.close()
                answer_text = text
                yield _sse_event("delta", {"text": answer_text})

            answer_text = answer_text.strip()
            if not answer_text:
                yield _sse_event("error", {"detail": "Pusta odpowiedź modelu. Spróbuj ponownie."})
                return

            # Persist the final answer using a fresh session
            session = SessionLocal()
            try:
                generated_answer = GeneratedAnswer(
                    query_id=query_id,
                    answer_text=answer_text,
                    model_name=model_name,
                    sources=sources,
                )
                session.add(generated_answer)
                session.commit()
                session.refresh(generated_answer)
                answer_id = generated_answer.id
            finally:
                session.close()

            if render_mode == "structured":
                parsed_answer = parse_structured_answer(answer_text)
            else:
                parsed_answer = QAAnswer(talent="", competency="", actions=[], fallback=False)

            yield _sse_event("done", {
                "query_id": query_id,
                "answer_id": answer_id,
                "answer": parsed_answer.model_dump(),
                "answer_raw": answer_text,
                "render_mode": render_mode,
            })
        except OpenAIError as e:
            logger.error(f"OpenRouter streaming error: {e}")
            yield _sse_event("error", {"detail": "Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę."})
        except Exception as e:
            logger.exception(f"Unexpected error during QA stream: {e}")
            yield _sse_event("error", {"detail": "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable buffering on nginx/proxies
        },
    )


@router.post("/feedback")
def save_feedback(
    request: QAFeedbackRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Verify ownership/access
    query = db.query(UserQuery).filter(
        UserQuery.id == request.query_id,
        UserQuery.organization_id == current_user.organization_id
    ).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    feedback = UserFeedback(
        query_id=request.query_id,
        answer_id=request.answer_id,
        user_id=current_user.id,
        rating=request.rating,
        is_effective=request.is_effective,
        comment=request.comment
    )
    db.add(feedback)
    db.commit()
    return {"status": "ok"}


@router.get("/history", response_model=list[QAHistoryItem])
def get_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Fetch user's queries joined with answers
    results = (
        db.query(UserQuery, GeneratedAnswer)
        .join(GeneratedAnswer, GeneratedAnswer.query_id == UserQuery.id)
        .filter(UserQuery.user_id == current_user.id)
        .order_by(UserQuery.created_at.desc())
        .limit(20)
        .all()
    )
    
    history = []
    for q, a in results:
        history.append(QAHistoryItem(
            query_id=q.id,
            question=q.question,
            context="self" if q.target_user_id == q.user_id else "team",
            answer=parse_structured_answer(a.answer_text),
            answer_raw=a.answer_text or "",
            render_mode="structured",  # Historical entries default to structured
            created_at=q.created_at
        ))
    
    return history
