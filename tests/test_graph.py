import os

os.environ["GRAPH_NAME"] = "datahere_test"

from datahere import graph  # noqa: E402
from datahere.schema import ICP, CompanyInfo, Note, PersonProfile, SellerProfile, Signal  # noqa: E402

EVENT = "Restaurant Expo"
SELLER = "https://seller.example"


def test_rank_end_to_end():
    graph.reset()
    graph.init()
    try:
        graph.upsert_seller(SellerProfile(
            url=SELLER, name="PriceCo", summary="menu pricing",
            icp=ICP(segments=["Fast Casual"], min_locations=10, max_locations=200,
                    buyer_roles=["vp operations", "cfo"], pain_topics=["pricing"]),
            customers=["Bowl Co"],
        ))
        graph.upsert_event(EVENT)
        graph.upsert_company(CompanyInfo(name="Bowl Co", kind="operator", segment="fast casual"))
        graph.upsert_company(CompanyInfo(
            name="Taco Chain", kind="operator", segment="fast casual", locations=60,
            signals=[Signal(kind="news", topic="Pricing", text="Taco Chain raises menu prices 8%", date="2026-09-01")],
        ))
        graph.upsert_company(CompanyInfo(name="Steak House", kind="operator", segment="fine dining", locations=5))
        graph.upsert_company(CompanyInfo(name="POS Vendor", kind="vendor", segment="fast casual"))

        vp = graph.upsert_person(PersonProfile(
            name="Priya Shah", company="Taco Chain", title="VP of Operations",
            signals=[Signal(kind="post", topic="pricing", text="Menu pricing is our 2027 focus", date="2026-10-01")],
        ), EVENT)
        graph.upsert_person(PersonProfile(name="Sam Lee", company="Steak House", title="CFO"), EVENT)
        graph.upsert_person(PersonProfile(name="Val Ng", company="POS Vendor", title="CEO"), EVENT)

        ranked = graph.rank(SELLER, EVENT)
        assert [m.name for m in ranked][:2] == ["Priya Shah", "Sam Lee"]
        assert "Val Ng" not in {m.name for m in ranked}  # vendor excluded
        top = ranked[0]
        assert top.person_id == vp
        assert {"fit", "intent"} <= {r.factor for r in top.reasons}
        assert top.hook == "Menu pricing is our 2027 focus"
        assert top.warm_intro is None

        edges = graph.remember(Note(person="Dana Fox", met_at="Tech Week", can_help_with=["fundraising"], knows=["priya shah"]))
        assert len(edges) == 3
        top = graph.rank(SELLER, EVENT)[0]
        assert top.warm_intro == "Dana Fox"
        assert any(r.factor == "warmth" for r in graph.explain(vp, SELLER))
        assert graph.stats()["Person"] == 4  # Dana merged in, Priya not duplicated
    finally:
        graph.reset()


def test_role_hit():
    from datahere.graph import _role_hit
    roles = {"cfo", "vp operations", "chief marketing officer", "founder", "owner", "president"}
    assert _role_hit("CMO", roles) == "chief marketing officer"
    assert _role_hit("VP of Ops", roles) == "vp operations"  # not 'president'
    assert _role_hit("Co-Founder & CEO", roles) == "founder"
    assert _role_hit("Chief Operating Officer", roles) == "vp operations"
    assert _role_hit("Account Executive", roles) is None
    assert _role_hit("Director of Training", roles) is None  # 'director' alone is seniority, not a role
