import time
import requests

def main():
    artifact_id = int(time.time())
    payload = {
        "id": artifact_id,
        "title": f"Cycle Artifact {artifact_id}",
        "body_markdown": (
            "This is a **fake artifact** written by `push_fake_cycle.py` (via API).\n\n"
            "- It proves the end-to-end loop works.\n"
            "- Next: replace this with v12_1 output.\n"
        ),
        "monologue_public": (
            "I wake, I sample the air. A soft bias toward continuity.\n"
            "The dial is warm. The crowd wants reflect.\n"
        ),
    }
    r = requests.post("http://localhost:8000/publish", json=payload, timeout=10)
    r.raise_for_status()
    print(f"Published artifact {artifact_id}")

if __name__ == "__main__":
    main()