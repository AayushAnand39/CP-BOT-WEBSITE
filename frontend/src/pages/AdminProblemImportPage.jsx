import { useState } from "react";
import {
  importCodeforcesProblem,
  polishManualProblem,
  generateManualProblemGenerator,
  generateManualProblemTestcases,
  submitManualProblem
} from "../api/admin.api";
import ErrorBox from "../components/ErrorBox";
import AdminProblemMaintenancePanel from "../components/AdminProblemMaintenancePanel";

const EMPTY_MANUAL = {
  title: "",
  statement: "",
  constraints: "",
  inputFormat: "",
  outputFormat: "",
  solutionCode: "",
  rating: "",
  tags: "",
  timeLimitMs: 2000,
  memoryLimitMb: 256,
  testCount: 5,
  examples: [{ input: "", output: "", explanation: "" }]
};

export default function AdminProblemImportPage() {
  // Existing Codeforces importer state.
  const [problemCode, setProblemCode] = useState("");
  const [testCount, setTestCount] = useState(5);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Separate manual problem-creation state.
  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [manualLoading, setManualLoading] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [manualError, setManualError] = useState(null);
  const [generatorCode, setGeneratorCode] = useState("");
  const [concepts, setConcepts] = useState([]);
  const [testcaseJob, setTestcaseJob] = useState(null);
  const [manualProblem, setManualProblem] = useState(null);

  async function submit(event) {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const data = await importCodeforcesProblem({
        problemCode: problemCode.trim(),
        testCount: Number(testCount)
      });
      setResult(data);
    } catch (err) {
      setError(err);
      const stages = err.response?.data?.details?.stages;
      if (stages) setResult({ success: false, stages });
    } finally {
      setLoading(false);
    }
  }

  function updateManual(field, value) {
    setManual((prev) => ({ ...prev, [field]: value }));
  }

  function manualPayload() {
    return {
      title: manual.title.trim(),
      statement: manual.statement.trim(),
      constraints: manual.constraints.trim(),
      inputFormat: manual.inputFormat.trim(),
      outputFormat: manual.outputFormat.trim(),
      solutionCode: manual.solutionCode,
      rating: manual.rating === "" ? null : Number(manual.rating),
      tags: manual.tags,
      timeLimitMs: Number(manual.timeLimitMs),
      memoryLimitMb: Number(manual.memoryLimitMb),
      examples: (manual.examples || []).filter((x) => x.input.trim() || x.output.trim())
    };
  }

  async function polishProblemText() {
    try {
      setPolishing(true);
      setManualError(null);

      const data = await polishManualProblem({
        title: manual.title,
        statement: manual.statement,
        constraints: manual.constraints,
        inputFormat: manual.inputFormat,
        outputFormat: manual.outputFormat,
        examples: manual.examples || []
      });

      setManual((prev) => ({
        ...prev,
        title: data.title ?? prev.title,
        statement: data.statement ?? prev.statement,
        constraints: data.constraints ?? prev.constraints,
        inputFormat: data.inputFormat ?? prev.inputFormat,
        outputFormat: data.outputFormat ?? prev.outputFormat,
        examples: Array.isArray(data.examples) && data.examples.length
          ? data.examples
          : prev.examples
      }));
      setGeneratorCode("");
      setTestcaseJob(null);
      setManualProblem(null);
    } catch (err) {
      setManualError(err);
    } finally {
      setPolishing(false);
    }
  }

  async function createGenerator(event) {
    event.preventDefault();
    try {
      setManualLoading(true);
      setManualError(null);
      setGeneratorCode("");
      setTestcaseJob(null);
      setManualProblem(null);

      const data = await generateManualProblemGenerator(manualPayload());
      setGeneratorCode(data.generatorCode);
      setConcepts(data.concepts || []);
    } catch (err) {
      setManualError(err);
    } finally {
      setManualLoading(false);
    }
  }

  async function approveGeneratorAndCreateZip() {
    try {
      setManualLoading(true);
      setManualError(null);
      setTestcaseJob(null);
      setManualProblem(null);

      const data = await generateManualProblemTestcases({
        generatorCode,
        solutionCode: manual.solutionCode,
        testCount: Number(manual.testCount)
      });
      setTestcaseJob(data.testcaseJob);
    } catch (err) {
      setManualError(err);
    } finally {
      setManualLoading(false);
    }
  }

  async function persistManualProblem() {
    try {
      setManualLoading(true);
      setManualError(null);
      const data = await submitManualProblem({
        ...manualPayload(),
        generatorCode,
        concepts,
        testcaseJob: testcaseJob?.jobId ? { jobId: testcaseJob.jobId } : null
      });
      setManualProblem(data.problem);
    } catch (err) {
      setManualError(err);
    } finally {
      setManualLoading(false);
    }
  }

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <span className="eyebrow">Administrator</span>
          <h1>Problem Preparation</h1>
          <p>Use the automatic Codeforces importer or create a problem manually.</p>
        </div>
      </div>

      {/* Existing importer stays as its own section. */}
      <section>
        <h2>Import Codeforces Problem</h2>
        <form className="card admin-import-form" onSubmit={submit}>
          <label>
            Codeforces problem ID
            <input
              value={problemCode}
              onChange={(e) => setProblemCode(e.target.value.toUpperCase())}
              placeholder="2167A"
              required
            />
          </label>

          <label>
            Generated testcase files
            <input
              type="number"
              min="1"
              max="50"
              value={testCount}
              onChange={(e) => setTestCount(e.target.value)}
            />
          </label>

          <button className="primary-button" disabled={loading}>
            {loading ? "Importing & preparing..." : "Import & Prepare Problem"}
          </button>
        </form>

        <ErrorBox error={error} />

        {result?.stages && (
          <section className="card admin-stages">
            <h3>Preparation status</h3>
            {result.stages.map((stage, index) => (
              <div className="admin-stage" key={`${stage.name}-${index}`}>
                <strong>{stage.status === "DONE" ? "✓" : "✕"} {stage.name}</strong>
                {stage.details && <pre>{JSON.stringify(stage.details, null, 2)}</pre>}
              </div>
            ))}
            {result.problem && (
              <p>Problem created: <strong>{result.problem.title}</strong> ({result.problem.status})</p>
            )}
          </section>
        )}
      </section>

      <hr style={{ margin: "40px 0" }} />

      <AdminProblemMaintenancePanel />

      <hr style={{ margin: "40px 0" }} />

      {/* New manual section. It never invokes Codeforces scraping. */}
      <section>
        <div className="page-header">
          <div>
            <span className="eyebrow">Manual fallback</span>
            <h2>Create Problem Manually</h2>
            <p>
              Enter the statement, constraints, I/O formats and trusted solution.
              The existing AI/Testcase pipeline handles generator creation and ZIP generation.
            </p>
          </div>
        </div>

        <form className="card admin-problem-form" onSubmit={createGenerator}>
          <div className="admin-form-toolbar">
            <div>
              <span className="eyebrow">Problem content</span>
              <h3>Paste first, polish second</h3>
              <p className="muted">AI cleanup only improves presentation. It does not change the trusted solution code.</p>
            </div>
            <button
              type="button"
              className="ai-polish-button"
              disabled={polishing || manualLoading || !manual.statement.trim()}
              onClick={polishProblemText}
            >
              {polishing ? "Polishing..." : "✦ Polish copied text with AI"}
            </button>
          </div>

          <div className="admin-field full-width">
            <label htmlFor="manual-title">Problem title</label>
            <input
              id="manual-title"
              className="admin-input"
              value={manual.title}
              onChange={(e) => updateManual("title", e.target.value)}
              placeholder="e.g. Maximum Balanced Subarray"
              required
            />
          </div>

          <div className="admin-field full-width">
            <div className="admin-field-heading">
              <label htmlFor="manual-statement">Problem statement</label>
              <span>Markdown + LaTeX supported</span>
            </div>
            <textarea
              id="manual-statement"
              className="admin-textarea statement-editor"
              rows="12"
              value={manual.statement}
              onChange={(e) => updateManual("statement", e.target.value)}
              placeholder="Paste the raw problem statement here. Use the AI polish action to clean copied formatting."
              required
            />
          </div>

          <div className="admin-form-grid two-column">
            <div className="admin-field">
              <label htmlFor="manual-constraints">Constraints</label>
              <textarea
                id="manual-constraints"
                className="admin-textarea"
                rows="7"
                value={manual.constraints}
                onChange={(e) => updateManual("constraints", e.target.value)}
                placeholder={"1 ≤ n ≤ 2 × 10^5\n1 ≤ a[i] ≤ 10^9"}
                required
              />
            </div>

            <div className="admin-field">
              <label htmlFor="manual-input-format">Input format</label>
              <textarea
                id="manual-input-format"
                className="admin-textarea"
                rows="7"
                value={manual.inputFormat}
                onChange={(e) => updateManual("inputFormat", e.target.value)}
                placeholder="Describe every input line and variable."
                required
              />
            </div>
          </div>

          <div className="admin-field full-width">
            <label htmlFor="manual-output-format">Output format</label>
            <textarea
              id="manual-output-format"
              className="admin-textarea"
              rows="6"
              value={manual.outputFormat}
              onChange={(e) => updateManual("outputFormat", e.target.value)}
              placeholder="Describe exactly what should be printed."
              required
            />
          </div>

          <div className="admin-samples-section">
            <div className="admin-section-heading">
              <div>
                <h3>Sample testcases</h3>
                <p className="muted">These samples are shown to users and are used by Run Samples.</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setManual((prev) => ({ ...prev, examples: [...prev.examples, { input: "", output: "", explanation: "" }] }))}
              >
                + Add sample
              </button>
            </div>

            {(manual.examples || []).map((sample, index) => (
              <div className="admin-sample-card" key={index}>
                <strong>Sample {index + 1}</strong>
                <div className="sample-grid">
                  <div className="admin-field">
                    <label>Input</label>
                    <textarea className="admin-textarea code-like" rows="5" value={sample.input} onChange={(e) => setManual((prev) => ({ ...prev, examples: prev.examples.map((x, i) => i === index ? { ...x, input: e.target.value } : x) }))} />
                  </div>
                  <div className="admin-field">
                    <label>Output</label>
                    <textarea className="admin-textarea code-like" rows="5" value={sample.output} onChange={(e) => setManual((prev) => ({ ...prev, examples: prev.examples.map((x, i) => i === index ? { ...x, output: e.target.value } : x) }))} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="admin-field full-width">
            <div className="admin-field-heading">
              <label htmlFor="manual-solution">Trusted solution code</label>
              <span>GNU C++20 · never modified by AI polish</span>
            </div>
            <textarea
              id="manual-solution"
              className="admin-textarea code-editor"
              rows="18"
              value={manual.solutionCode}
              onChange={(e) => updateManual("solutionCode", e.target.value)}
              spellCheck="false"
              placeholder={"#include <bits/stdc++.h>\nusing namespace std;\n..."}
              required
            />
          </div>

          <div className="admin-form-grid metadata-grid">
            <div className="admin-field">
              <label>Rating <span>(optional)</span></label>
              <input className="admin-input" type="number" min="0" max="5000" value={manual.rating} onChange={(e) => updateManual("rating", e.target.value)} placeholder="1500" />
            </div>
            <div className="admin-field">
              <label>Tags <span>(comma separated)</span></label>
              <input className="admin-input" value={manual.tags} onChange={(e) => updateManual("tags", e.target.value)} placeholder="dp, graphs, greedy" />
            </div>
            <div className="admin-field">
              <label>Time limit <span>ms</span></label>
              <input className="admin-input" type="number" min="1" value={manual.timeLimitMs} onChange={(e) => updateManual("timeLimitMs", e.target.value)} />
            </div>
            <div className="admin-field">
              <label>Memory limit <span>MB</span></label>
              <input className="admin-input" type="number" min="1" value={manual.memoryLimitMb} onChange={(e) => updateManual("memoryLimitMb", e.target.value)} />
            </div>
            <div className="admin-field">
              <label>Generated testcase files</label>
              <input className="admin-input" type="number" min="1" max="40" value={manual.testCount} onChange={(e) => updateManual("testCount", e.target.value)} />
            </div>
          </div>

          <div className="admin-form-actions">
            <span className="muted">Review the cleaned content before creating the generator.</span>
            <button className="primary-button" disabled={manualLoading || polishing}>
              {manualLoading ? "Generating..." : "Generate Generator Code"}
            </button>
          </div>
        </form>

        <ErrorBox error={manualError} />

        {generatorCode && (
          <section className="card admin-stages">
            <h3>Review generated generator</h3>
            <p>Edit it if required. ZIP generation only starts after approval.</p>
            <textarea
              rows="22"
              value={generatorCode}
              onChange={(e) => {
                setGeneratorCode(e.target.value);
                setTestcaseJob(null);
                setManualProblem(null);
              }}
              spellCheck="false"
              className="admin-textarea code-editor generator-editor"
            />

            {concepts.length > 0 && (
              <p><strong>Detected concepts:</strong> {concepts.join(", ")}</p>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="primary-button"
                disabled={manualLoading}
                onClick={approveGeneratorAndCreateZip}
              >
                {manualLoading ? "Creating ZIP..." : "Approve & Generate ZIP"}
              </button>

              <button
                type="button"
                className="secondary-button"
                disabled={manualLoading}
                onClick={createGenerator}
              >
                Regenerate Generator
              </button>
            </div>
          </section>
        )}

        {testcaseJob && (
          <section className="card admin-stages">
            <h3>ZIP generated</h3>
            <p>
              Testcase Service completed generation. The problem is still not in the database.
            </p>
            <pre>{JSON.stringify(testcaseJob, null, 2)}</pre>

            <button
              type="button"
              className="primary-button"
              disabled={manualLoading || !!manualProblem}
              onClick={persistManualProblem}
            >
              {manualProblem ? "Problem Submitted" : "Submit Problem"}
            </button>
          </section>
        )}

        {manualProblem && (
          <section className="card admin-stages">
            <h3>Problem stored</h3>
            <p>
              <strong>{manualProblem.title}</strong> is now {manualProblem.status}.
            </p>
            <pre>{JSON.stringify(manualProblem, null, 2)}</pre>
          </section>
        )}
      </section>
    </main>
  );
}
