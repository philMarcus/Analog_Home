import time
from db import init_db, connect

def main():
    init_db()
    con = connect()

    artifact_id = int(time.time())
    title = f"Cycle Artifact {artifact_id}"
    body = (
        "This is a **fake artifact** written by `push_fake_cycle.py`.\n\n"
        "- It proves the end-to-end loop works.\n"
        "- Next: replace this with v12_1 output.\n"
    )
    monologue = (
        "I wake, I sample the air. A soft bias toward continuity.\n"
        "The dial is warm. The crowd wants reflect.\n"
    )

    con.execute(
        "INSERT INTO artifacts (id, title, body_markdown, monologue_public) VALUES (?, ?, ?, ?);",
        [artifact_id, title, body, monologue],
    )
    con.close()
    print(f"Wrote artifact {artifact_id}")

if __name__ == "__main__":
    main()
