import asyncio

from datahere import mailer, server

TOOLS = {
    "profile_seller", "import_attendees", "run_pipeline", "rank_prospects", "explain_prospect",
    "remember", "draft_outreach", "send_email", "graph_stats",
}


def test_send_email_refuses_without_approval(monkeypatch):
    calls = []
    monkeypatch.setattr(mailer, "send", lambda *a: calls.append(a))
    out = server.send_email("x@example.com", "hi", "body", approved=False)
    assert out["sent"] is False and calls == []
    assert server.send_email("x@example.com", "hi", "body", approved=True)["sent"] is True
    assert len(calls) == 1


def test_all_tools_registered():
    tools = asyncio.run(server.mcp.list_tools())
    assert {t.name for t in tools} == TOOLS
    send = next(t for t in tools if t.name == "send_email")
    assert "Only call after the human explicitly approved this exact email." in send.description
