"use client";

import { useEffect, useMemo, useState } from "react";
import Footer from "../components/Footer";

type Todo = {
  id: string;
  text: string;
  status: "open" | "done";
  created_cycle: number | null;
  completed_cycle: number | null;
};

export default function TodosPage() {
  const API = useMemo(() => "/api/proxy", []);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/agent-state/todos`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Todo[]) => setTodos(Array.isArray(data) ? data : []))
      .catch(() => setTodos([]))
      .finally(() => setLoading(false));
  }, [API]);

  const open = todos.filter((t) => t.status === "open");
  const done = todos.filter((t) => t.status === "done");

  return (
    <main className="page-container">
      <header className="site-header">
        <h1 className="site-title" style={{ fontSize: 24 }}>Analog_I&apos;s To Do List</h1>
        <div className="site-tagline">Tasks the agent has set for itself</div>
      </header>

      <div style={{ marginBottom: 16 }}>
        <a href="/" style={{ color: "var(--cyan)", fontSize: 13, textDecoration: "none" }}>
          &larr; Back to home
        </a>
      </div>

      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}>
          Loading todos...
        </div>
      ) : todos.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}>
          No todos yet.
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <section>
              <div className="section-label" style={{ marginBottom: 12 }}>
                Open ({open.length})
              </div>
              <div className="cyber-panel" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {open.map((t, i) => (
                  <div key={t.id} className="todo-item">
                    <span className="todo-bullet">&#9656;</span>
                    <span className="todo-text">{t.text}</span>
                    {t.created_cycle != null && (
                      <span className="todo-meta">cycle {t.created_cycle}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <div className="section-label" style={{ marginBottom: 12 }}>
                Completed ({done.length})
              </div>
              <div className="cyber-panel" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {done.map((t) => (
                  <div key={t.id} className="todo-item todo-done">
                    <span className="todo-bullet">&#10003;</span>
                    <span className="todo-text">{t.text}</span>
                    {t.completed_cycle != null && (
                      <span className="todo-meta">done cycle {t.completed_cycle}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <Footer />
    </main>
  );
}
