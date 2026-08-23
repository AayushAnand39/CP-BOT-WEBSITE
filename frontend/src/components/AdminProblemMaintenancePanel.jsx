import { useEffect, useMemo, useState } from "react";
import {
  listMaintenanceProblems,
  getMaintenanceProblem,
  polishManualProblem,
  updateMaintenanceProblem,
  regenerateMaintenanceTestcases,
  rebuildMaintenanceArchive
} from "../api/admin.api";
import ErrorBox from "./ErrorBox";

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function editableFrom(problem) {
  return {
    title: problem?.title || "",
    statement: problem?.statement || "",
    constraints: problem?.constraints || "",
    inputFormat: problem?.inputFormat || "",
    outputFormat: problem?.outputFormat || "",
    examples: Array.isArray(problem?.examples) ? problem.examples : []
  };
}

export default function AdminProblemMaintenancePanel() {
  const [problems, setProblems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [problem, setProblem] = useState(null);
  const [artifactHealth, setArtifactHealth] = useState(null);
  const [draft, setDraft] = useState(editableFrom(null));
  const [testCount, setTestCount] = useState(10);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingProblem, setLoadingProblem] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(null);

  const selectedSummary = useMemo(
    () => problems.find((item) => item.id === selectedId),
    [problems, selectedId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingList(true);
        const data = await listMaintenanceProblems();
        if (!cancelled) setProblems(data.items || []);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function loadProblem(problemId = selectedId) {
    if (!problemId) return;
    try {
      setLoadingProblem(true);
      setError(null);
      setMessage("");
      const data = await getMaintenanceProblem(problemId);
      setProblem(data.problem);
      setArtifactHealth(data.artifactHealth || null);
      setDraft(editableFrom(data.problem));
      const existingCount = Number(data.problem?.testcaseArtifact?.testCount || data.artifactHealth?.testCount || 10);
      setTestCount(Math.max(1, Math.min(10, existingCount || 10)));
    } catch (err) {
      setError(err);
    } finally {
      setLoadingProblem(false);
    }
  }

  function updateDraft(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function polish() {
    try {
      setPolishing(true);
      setError(null);
      setMessage("");
      const data = await polishManualProblem(draft);
      setDraft((prev) => ({
        ...prev,
        title: data.title ?? prev.title,
        statement: data.statement ?? prev.statement,
        constraints: data.constraints ?? prev.constraints,
        inputFormat: data.inputFormat ?? prev.inputFormat,
        outputFormat: data.outputFormat ?? prev.outputFormat,
        examples: Array.isArray(data.examples) ? data.examples : prev.examples
      }));
      setMessage("AI polish applied locally. Review it, then click Save Problem Text.");
    } catch (err) {
      setError(err);
    } finally {
      setPolishing(false);
    }
  }

  async function saveContent() {
    if (!problem?.id) return;
    try {
      setSaving(true);
      setError(null);
      setMessage("");
      const data = await updateMaintenanceProblem(problem.id, draft);
      setProblem(data.problem);
      setDraft(editableFrom(data.problem));
      setMessage("Problem text updated. Generator, trusted solution, and testcase artifact were left unchanged.");
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function rebuildArchive() {
    if (!problem?.id) return;
    try {
      setRebuilding(true);
      setError(null);
      setMessage("");
      const data = await rebuildMaintenanceArchive(problem.id);
      setProblem(data.problem);
      setArtifactHealth((prev) => ({
        ...(prev || {}),
        jobId: data.testcaseJob?.jobId,
        jobAvailable: true,
        archiveAvailable: true,
        testCount: data.testcaseJob?.testCount || prev?.testCount || 0,
        archiveBytes: data.testcaseJob?.archiveBytes ?? null,
        message: "ZIP rebuilt from the existing hidden testcase files"
      }));
      setMessage(`ZIP rebuilt successfully for job ${data.testcaseJob?.jobId}. Hidden tests were not regenerated.`);
    } catch (err) {
      setError(err);
    } finally {
      setRebuilding(false);
    }
  }

  async function regenerate() {
    if (!problem?.id) return;
    try {
      setRegenerating(true);
      setError(null);
      setMessage("");
      const data = await regenerateMaintenanceTestcases(problem.id, Number(testCount));
      setProblem(data.problem);
      setArtifactHealth({
        jobId: data.testcaseJob?.jobId,
        jobAvailable: true,
        archiveAvailable: data.testcaseJob?.archiveBytes != null,
        testCount: data.testcaseJob?.testCount || 0,
        archiveBytes: data.testcaseJob?.archiveBytes ?? null,
        message: "Testcase job and archive were regenerated successfully"
      });
      setMessage(
        `Regenerated ${data.testcaseJob?.testCount || testCount} hidden testcase files. ` +
        `New job: ${data.testcaseJob?.jobId || "created"}.` +
        (data.previousJobId ? ` Previous job: ${data.previousJobId}.` : "")
      );
    } catch (err) {
      setError(err);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <section className="admin-maintenance-section">
      <div className="page-header">
        <div>
          <span className="eyebrow">Administrator recovery</span>
          <h2>Maintain Existing Problems</h2>
          <p>
            Recover deleted testcase artifacts without recreating the problem, or edit and AI-polish an existing statement.
          </p>
        </div>
      </div>

      <div className="card admin-maintenance-picker">
        <div className="admin-field">
          <label htmlFor="maintenance-problem">Existing problem</label>
          <select
            id="maintenance-problem"
            className="admin-input"
            value={selectedId}
            disabled={loadingList}
            onChange={(event) => {
              const id = event.target.value;
              setSelectedId(id);
              setProblem(null);
              setArtifactHealth(null);
              setMessage("");
            }}
          >
            <option value="">{loadingList ? "Loading problems..." : "Select a problem"}</option>
            {problems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.rating ? `${item.rating} · ` : ""}{item.title}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={!selectedId || loadingProblem}
          onClick={() => loadProblem()}
        >
          {loadingProblem ? "Loading..." : "Open Maintenance Panel"}
        </button>

        {selectedSummary && <span className="muted">ID: {selectedSummary.id}</span>}
      </div>

      <ErrorBox error={error} />
      {message && <div className="card admin-maintenance-message">{message}</div>}

      {problem && (
        <>
          <div className="card admin-artifact-health">
            <div>
              <span className="eyebrow">Testcase artifact</span>
              <h3>{artifactHealth?.message || "Artifact status unavailable"}</h3>
              <p className="muted">
                Stored job: <code>{artifactHealth?.jobId || problem.testcaseArtifact?.jobId || "none"}</code>
              </p>
            </div>

            <div className="artifact-health-grid">
              <div><span>Job directory</span><strong>{artifactHealth?.jobAvailable ? "Available" : "Missing"}</strong></div>
              <div><span>ZIP archive</span><strong>{artifactHealth?.archiveAvailable ? "Available" : "Missing"}</strong></div>
              <div><span>Hidden files</span><strong>{artifactHealth?.testCount ?? "—"}</strong></div>
              <div><span>ZIP size</span><strong>{formatBytes(artifactHealth?.archiveBytes)}</strong></div>
            </div>

            <div className="admin-regenerate-row">
              <label>
                Test files
                <input
                  className="admin-input"
                  type="number"
                  min="1"
                  max="10"
                  value={testCount}
                  onChange={(event) => setTestCount(event.target.value)}
                />
              </label>
              {artifactHealth?.jobAvailable && !artifactHealth?.archiveAvailable && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={rebuilding || regenerating}
                  onClick={rebuildArchive}
                >
                  {rebuilding ? "Rebuilding ZIP..." : "Rebuild ZIP from Existing Tests"}
                </button>
              )}

              <button
                type="button"
                className="primary-button"
                disabled={regenerating || rebuilding || !problem.hasSolutionCode || !problem.hasGeneratorCode}
                onClick={regenerate}
              >
                {regenerating ? "Regenerating ZIP..." : "Regenerate Hidden Tests + ZIP"}
              </button>
            </div>

            {(!problem.hasSolutionCode || !problem.hasGeneratorCode) && (
              <p className="error-text">
                Regeneration requires both the stored trusted solution and generator code.
              </p>
            )}
          </div>

          <div className="card admin-problem-form admin-maintenance-editor">
            <div className="admin-form-toolbar">
              <div>
                <span className="eyebrow">Editable content</span>
                <h3>Problem statement & presentation</h3>
                <p className="muted">Saving here never changes solution code, generator code, or testcase artifacts.</p>
              </div>
              <button
                type="button"
                className="ai-polish-button"
                disabled={polishing || !draft.statement.trim()}
                onClick={polish}
              >
                {polishing ? "Polishing..." : "✦ Polish current text with AI"}
              </button>
            </div>

            <div className="admin-field full-width">
              <label>Problem title</label>
              <input className="admin-input" value={draft.title} onChange={(e) => updateDraft("title", e.target.value)} />
            </div>

            <div className="admin-field full-width">
              <div className="admin-field-heading"><label>Problem statement</label><span>Markdown + LaTeX supported</span></div>
              <textarea className="admin-textarea statement-editor" rows="14" value={draft.statement} onChange={(e) => updateDraft("statement", e.target.value)} />
            </div>

            <div className="admin-form-grid two-column">
              <div className="admin-field">
                <label>Constraints</label>
                <textarea className="admin-textarea" rows="7" value={draft.constraints} onChange={(e) => updateDraft("constraints", e.target.value)} />
              </div>
              <div className="admin-field">
                <label>Input format</label>
                <textarea className="admin-textarea" rows="7" value={draft.inputFormat} onChange={(e) => updateDraft("inputFormat", e.target.value)} />
              </div>
            </div>

            <div className="admin-field full-width">
              <label>Output format</label>
              <textarea className="admin-textarea" rows="6" value={draft.outputFormat} onChange={(e) => updateDraft("outputFormat", e.target.value)} />
            </div>

            <div className="admin-form-actions">
              <span className="muted">Review AI-polished text before saving.</span>
              <button type="button" className="primary-button" disabled={saving || polishing} onClick={saveContent}>
                {saving ? "Saving..." : "Save Problem Text"}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
