"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase";
import {
  fetchProjects,
  createProject,
  deleteProject,
  createSession,
  Project,
} from "@/lib/api";
import {
  Plus,
  FolderOpen,
  Trash2,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // New project modal/inline state
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    async function initAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionToken = data.session?.access_token || null;
        setToken(sessionToken);
        await loadProjects(sessionToken);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load projects");
        setLoading(false);
      }
    }
    initAuth();
  }, []);

  async function loadProjects(authToken: string | null) {
    try {
      setLoading(true);
      setError(null);
      const list = await fetchProjects(authToken);
      setProjects(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setCreating(true);
      const created = await createProject(newName.trim(), token);
      setProjects([created, ...projects]);
      setNewName("");
      setShowNew(false);
      // Auto open workspace in a new session
      await handleOpen(created.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  async function handleOpen(projectId: string) {
    try {
      setActionId(projectId);
      const session = await createSession(projectId, token);
      router.push(`/projects/${projectId}/sessions/${session.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create session");
      setActionId(null);
    }
  }

  async function handleDelete(projectId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project and all its sessions?")) {
      return;
    }
    try {
      await deleteProject(projectId, token);
      setProjects(projects.filter((p) => p.id !== projectId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg text-ink">
      {/* Top Console Navigation Bar */}
      <header className="h-14 border-b border-line bg-surface/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-50">
        <a href="/" className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center font-mono font-bold text-accent-ink text-sm shadow-sm">
            V
          </div>
          <span className="font-semibold text-ink tracking-tight text-base font-mono">
            VoxSpec
          </span>
          <span className="text-xs px-2 py-0.5 rounded border border-line bg-surface-2 text-ink-muted font-mono">
            Workspace
          </span>
        </a>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => setShowNew(true)}
            className="px-3.5 py-1.5 rounded-md bg-accent text-accent-ink text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New Project
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-ink tracking-tight">
              Projects
            </h1>
            <p className="text-xs text-ink-muted font-sans mt-0.5">
              Select an existing product workspace or initialize a new specification brief.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-md border border-danger/30 bg-danger/10 text-danger text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* New Project Inline Card */}
        {showNew && (
          <form
            onSubmit={handleCreate}
            className="p-5 rounded-lg border border-accent/40 bg-surface shadow-sm space-y-4"
          >
            <div className="space-y-1">
              <label htmlFor="pname" className="block text-xs font-mono font-medium text-ink">
                PROJECT NAME
              </label>
              <input
                id="pname"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Clinic Appointment Booking, Logistics Route Dispatch"
                required
                autoFocus
                className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface-2 text-ink placeholder:text-ink-muted/50 focus:border-focus focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="px-3 py-1.5 rounded text-xs text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-1.5 rounded bg-accent text-accent-ink text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...
                  </>
                ) : (
                  "Create & Launch"
                )}
              </button>
            </div>
          </form>
        )}

        {/* Projects List States */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-5 rounded-lg border border-line bg-surface animate-pulse space-y-3"
              >
                <div className="h-4 bg-surface-2 rounded w-1/2" />
                <div className="h-3 bg-surface-2 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center rounded-lg border border-line border-dashed bg-surface/50 space-y-4">
            <div className="w-12 h-12 rounded-full bg-surface-2 border border-line mx-auto flex items-center justify-center text-accent">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-ink">No projects yet</h3>
              <p className="text-xs text-ink-muted max-w-sm mx-auto">
                Create your first project to start turning messy voice rambles into validated, versioned specs.
              </p>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="px-4 py-2 rounded-md bg-accent text-accent-ink text-xs font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Initialize Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => handleOpen(proj.id)}
                className="p-5 rounded-lg border border-line bg-surface hover:border-accent/40 transition-all cursor-pointer group flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-ink text-sm group-hover:text-accent transition-colors flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-ink-muted group-hover:text-accent" />
                      {proj.name}
                    </h3>
                    <p className="text-xs font-mono text-ink-muted">
                      Created {new Date(proj.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(proj.id, e)}
                    className="p-1.5 rounded text-ink-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-line text-xs font-mono text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                    Active Spec Workspace
                  </span>
                  <span className="text-accent group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    {actionId === proj.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        Open <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
