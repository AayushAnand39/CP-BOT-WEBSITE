import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  finishContest,
  getContest,
  getContestActivity,
  getContestProblem,
  getStandings,
  getSubmission,
  runCode as runContestCode,
  submitCode,
} from "../api/contest.api";
import ErrorBox from "../components/ErrorBox";
import Loading from "../components/Loading";
import ProblemRenderer from "../components/ProblemRenderer";
import SubmissionCodeModal from "../components/SubmissionCodeModal";
import useContestTimer from "../hooks/useContestTimer";
import { formatDuration } from "../utils/time";

const defaultCode = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    return 0;
}
`;

function normalizeExamples(value) {
  if (!value) return [];
  let examples = value;
  if (typeof examples === "string") {
    try { examples = JSON.parse(examples); } catch { return []; }
  }
  if (!Array.isArray(examples)) return [];
  return examples.map((sample, index) => ({
    id: `sample-${index}`,
    label: `Sample ${index + 1}`,
    type: "sample",
    input: String(sample?.input ?? ""),
    output: String(sample?.output ?? sample?.expectedOutput ?? ""),
    explanation: String(sample?.explanation ?? ""),
  }));
}

function VerdictBadge({ verdict }) {
  const value = String(verdict || "PENDING");
  return <span className={`verdict-badge verdict-${value.toLowerCase()}`}>{value}</span>;
}

function HiddenTestResults({ submission }) {
  if (!submission) return null;
  const tests = Array.isArray(submission.judge?.tests) ? submission.judge.tests : [];
  const passed = tests.filter((test) => test.verdict === "AC").length;

  return (
    <div className="submission-result-v2">
      <div className="result-heading-row">
        <strong>Submission verdict</strong>
        <VerdictBadge verdict={submission.verdict} />
      </div>
      <p className="muted result-summary">
        Hidden tests executed: {tests.length}{tests.length ? ` · Passed: ${passed}` : ""} · Points earned: {submission.score ?? 0}
      </p>
      {submission.judge?.compilationError && (
        <pre className="testcase-output-v2 error-output">{submission.judge.compilationError}</pre>
      )}
      {tests.length > 0 && (
        <div className="hidden-tests-grid" aria-label="Hidden testcase verdicts">
          {tests.map((test, index) => (
            <div className="hidden-test-row" key={`${test.testNumber ?? index + 1}-${index}`}>
              <span>Hidden test {test.testNumber ?? index + 1}</span>
              <span className="muted">{test.timeMs != null ? `${test.timeMs} ms` : ""}</span>
              <VerdictBadge verdict={test.verdict} />
            </div>
          ))}
        </div>
      )}
      {tests.length === 0 && submission.verdict !== "CE" && (
        <p className="muted">The judge returned only the overall verdict for this submission.</p>
      )}
    </div>
  );
}

export default function ContestPage() {
  const { contestId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const challengeId = location.state?.challengeId || localStorage.getItem(`cpbot_challenge_for_contest_${contestId}`);
  const reviewMode = location.state?.review === true;

  const [contest, setContest] = useState(null);
  const [standings, setStandings] = useState([]);
  const [activity, setActivity] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedProblemId, setSelectedProblemId] = useState(null);
  const [problemDetails, setProblemDetails] = useState({});
  const [problemErrors, setProblemErrors] = useState({});
  const [code, setCode] = useState(defaultCode);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [testcases, setTestcases] = useState([]);
  const [activeTestcaseId, setActiveTestcaseId] = useState(null);
  const [viewedSubmission, setViewedSubmission] = useState(null);
  const [loadingSubmission, setLoadingSubmission] = useState(false);
  const remaining = useContestTimer(contest?.endsAt);

  const selectedProblem = useMemo(
    () => contest?.problems?.find((p) => p.problemId === selectedProblemId),
    [contest, selectedProblemId],
  );
  const selectedProblemDetails = selectedProblemId ? problemDetails[selectedProblemId] : null;
  const activeTestcase = useMemo(
    () => testcases.find((tc) => tc.id === activeTestcaseId) || null,
    [testcases, activeTestcaseId],
  );

  async function loadContest() {
    try {
      const data = await getContest(contestId);
      setContest(data);
      if (data.problems?.length) {
        // Polling must never overwrite a problem the user has explicitly selected.
        // A functional state update reads the latest value instead of the stale value
        // captured when the polling effect was first created.
        setSelectedProblemId((current) => current || data.problems[0].problemId);
      }
      if (data.status === "ENDED" && challengeId && !reviewMode) {
        navigate(`/result/${challengeId}`, { replace: true, state: { challengeId, contestId } });
      }
    } catch (err) { setError(err); }
  }

  async function loadStandings() {
    try { setStandings(await getStandings(contestId)); } catch { /* polling should not block solving */ }
  }

  async function loadActivity() {
    try { setActivity(await getContestActivity(contestId)); } catch { /* polling should not block solving */ }
  }

  useEffect(() => {
    loadContest();
    loadStandings();
    loadActivity();
    const contestPoll = setInterval(loadContest, 5000);
    const standingsPoll = setInterval(loadStandings, 3000);
    const activityPoll = setInterval(loadActivity, 2000);
    return () => {
      clearInterval(contestPoll);
      clearInterval(standingsPoll);
      clearInterval(activityPoll);
    };
  }, [contestId]);

  useEffect(() => {
    if (!selectedProblemId || problemDetails[selectedProblemId] || problemErrors[selectedProblemId]) return;
    getContestProblem(contestId, selectedProblemId)
      .then((problem) => setProblemDetails((current) => ({ ...current, [selectedProblemId]: problem })))
      .catch((err) => setProblemErrors((current) => ({ ...current, [selectedProblemId]: err })));
  }, [selectedProblemId, problemDetails, problemErrors]);

  useEffect(() => {
    if (!selectedProblemDetails) return;
    const samples = normalizeExamples(selectedProblemDetails.examplesJson);
    setTestcases(samples);
    setActiveTestcaseId(samples[0]?.id || null);
    setRunResult(null);
  }, [selectedProblemId, selectedProblemDetails]);

  function payload() {
    return { problemId: selectedProblemId, language: "cpp", sourceCode: code };
  }

  function addCustomTestcase() {
    const n = testcases.filter((tc) => tc.type === "custom").length + 1;
    const item = { id: `custom-${Date.now()}`, label: `Custom ${n}`, type: "custom", input: "", output: null };
    setTestcases((current) => [...current, item]);
    setActiveTestcaseId(item.id);
    setRunResult(null);
  }

  function updateActiveInput(value) {
    setTestcases((current) => current.map((tc) => (
      tc.id === activeTestcaseId ? { ...tc, input: value } : tc
    )));
  }

  async function run() {
    if (!selectedProblemId || !activeTestcase) return;
    try {
      setRunning(true);
      setError(null);
      setRunResult(null);
      const result = await runContestCode(contestId, {
        ...payload(),
        input: activeTestcase.input,
        ...(activeTestcase.type === "sample" ? { expectedOutput: activeTestcase.output } : {}),
      });
      setRunResult(result);
    } catch (err) { setError(err); }
    finally { setRunning(false); }
  }

  async function submit() {
    if (!selectedProblemId) return;
    try {
      setSubmitting(true);
      setError(null);
      setSubmissionResult(null);
      const result = await submitCode(contestId, payload());
      setSubmissionResult(result);
      await Promise.all([loadStandings(), loadActivity()]);
    } catch (err) { setError(err); }
    finally { setSubmitting(false); }
  }

  async function viewSubmission(id) {
    try {
      setLoadingSubmission(true);
      setError(null);
      setViewedSubmission(await getSubmission(contestId, id));
    } catch (err) { setError(err); }
    finally { setLoadingSubmission(false); }
  }

  async function finish() {
    if (!window.confirm("Submit this contest now? Remaining bot events will be finalized before the result is calculated.")) return;
    try {
      setFinishing(true);
      setError(null);
      await finishContest(contestId);
      if (challengeId) navigate(`/result/${challengeId}`, { replace: true, state: { challengeId, contestId } });
      else await loadContest();
    } catch (err) { setError(err); }
    finally { setFinishing(false); }
  }

  if (!contest) return <Loading text="Loading contest..." />;
  const examples = normalizeExamples(selectedProblemDetails?.examplesJson);

  return (
    <main className="contest-workspace">
      <section className="contest-main-v3">
        <div className="contest-topbar contest-topbar-v3">
          <div>
            <h2>{contest.name}</h2>
            <span className="muted">{contest.status}</span>
          </div>
          <div className="contest-topbar-actions">
            <div className="timer">{formatDuration(remaining)}</div>
            <button className="secondary-button history-toggle" onClick={() => setHistoryOpen(true)}>
              Submissions {activity.length ? `(${activity.length})` : ""}
            </button>
          </div>
        </div>

        <div className="problem-tabs">
          {contest.problems?.map((problem, index) => (
            <button
              key={problem.problemId}
              className={selectedProblemId === problem.problemId ? "problem-tab active" : "problem-tab"}
              onClick={() => {
                setSelectedProblemId(problem.problemId);
                setRunResult(null);
                setSubmissionResult(null);
              }}
            >
              {String.fromCharCode(65 + index)}
            </button>
          ))}
        </div>

        <ErrorBox error={error} />

        <div className="solve-split solve-split-v3">
          <section className="problem-pane-v3">
            <header className="problem-title-block">
              <h1>{selectedProblemDetails?.title || `Problem ${selectedProblem?.ordinal || ""}`}</h1>
              <div className="problem-meta-row">
                <span>Rating <strong>{selectedProblemDetails?.rating ?? selectedProblem?.problemRating ?? "—"}</strong></span>
                <span>Time <strong>{selectedProblemDetails?.timeLimitMs ?? "—"} ms</strong></span>
                <span>Memory <strong>{selectedProblemDetails?.memoryLimitMb ?? "—"} MB</strong></span>
              </div>
            </header>

            {problemErrors[selectedProblemId] ? (
              <div className="error-box">
                Could not load this problem statement. {problemErrors[selectedProblemId]?.response?.data?.message || problemErrors[selectedProblemId]?.message || "Problem Service error"}
              </div>
            ) : selectedProblemDetails ? (
              <div className="statement-sections">
                <section className="statement-section">
                  <ProblemRenderer content={selectedProblemDetails.statement} />
                </section>
                {selectedProblemDetails.inputFormat && (
                  <section className="statement-section"><h2>Input</h2><ProblemRenderer content={selectedProblemDetails.inputFormat} /></section>
                )}
                {selectedProblemDetails.outputFormat && (
                  <section className="statement-section"><h2>Output</h2><ProblemRenderer content={selectedProblemDetails.outputFormat} /></section>
                )}
                {selectedProblemDetails.constraints && (
                  <section className="statement-section"><h2>Constraints</h2><ProblemRenderer content={selectedProblemDetails.constraints} /></section>
                )}
                {examples.length > 0 && (
                  <section className="statement-section">
                    <h2>Examples</h2>
                    {examples.map((sample, index) => (
                      <div className="sample-card-v2" key={sample.id}>
                        <strong>Sample {index + 1}</strong>
                        <span className="sample-label-v2">Input</span>
                        <pre className="statement-pre">{sample.input}</pre>
                        <span className="sample-label-v2">Output</span>
                        <pre className="statement-pre">{sample.output}</pre>
                        {sample.explanation && <ProblemRenderer content={sample.explanation} />}
                      </div>
                    ))}
                  </section>
                )}
              </div>
            ) : <p className="muted">Loading problem statement...</p>}
          </section>

          <section className="coding-pane-v3">
            <div className="editor-shell editor-shell-v3">
              <Editor
                height="100%"
                defaultLanguage="cpp"
                value={code}
                onChange={(value) => setCode(value || "")}
                theme="vs-dark"
                options={{ automaticLayout: true, minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false }}
              />
            </div>

            <div className="testcase-workbench testcase-workbench-v3">
              <div className="testcase-tab-row">
                {testcases.map((tc) => (
                  <button
                    key={tc.id}
                    className={tc.id === activeTestcaseId ? "testcase-tab-v2 active" : "testcase-tab-v2"}
                    onClick={() => { setActiveTestcaseId(tc.id); setRunResult(null); }}
                  >
                    {tc.label}
                  </button>
                ))}
                <button className="testcase-tab-v2 add" onClick={addCustomTestcase}>+ Custom</button>
              </div>

              {activeTestcase ? (
                <div className="testcase-io-grid">
                  <div>
                    <label className="testcase-label">Input</label>
                    <textarea className="testcase-input-v2" value={activeTestcase.input} onChange={(e) => updateActiveInput(e.target.value)} />
                  </div>
                  {activeTestcase.type === "sample" && (
                    <div>
                      <label className="testcase-label">Expected Output</label>
                      <pre className="testcase-output-v2 testcase-expected">{activeTestcase.output}</pre>
                    </div>
                  )}
                </div>
              ) : <p className="muted">No official samples. Click <strong>+ Custom</strong> to run your own input.</p>}

              {runResult && (
                <div className="run-result-v2 run-result-visible">
                  <div className="result-heading-row">
                    <strong>Run result</strong>
                    <VerdictBadge verdict={runResult.verdict} />
                  </div>
                  {runResult.timeMs != null && <p className="muted result-summary">Execution time: {runResult.timeMs} ms</p>}
                  {runResult.compilationError && <pre className="testcase-output-v2 error-output">{runResult.compilationError}</pre>}
                  {runResult.stdout !== undefined && (
                    <div className="run-output-grid">
                      <div>
                        <label className="testcase-label">Your Output</label>
                        <pre className="testcase-output-v2">{runResult.stdout || "(empty)"}</pre>
                      </div>
                      {activeTestcase?.type === "sample" && (
                        <div>
                          <label className="testcase-label">Expected Output</label>
                          <pre className="testcase-output-v2">{activeTestcase.output || "(empty)"}</pre>
                        </div>
                      )}
                    </div>
                  )}
                  {runResult.stderr && <pre className="testcase-output-v2 error-output">{runResult.stderr}</pre>}
                </div>
              )}

              <HiddenTestResults submission={submissionResult} />
            </div>

            <div className="contest-action-bar">
              <button
                className="secondary-button"
                disabled={running || submitting || contest.status !== "RUNNING" || !activeTestcase}
                onClick={run}
              >
                {running ? "Running..." : "Run Code"}
              </button>
              <button
                className="primary-button"
                disabled={submitting || running || contest.status !== "RUNNING"}
                onClick={submit}
              >
                {submitting ? "Submitting..." : "Submit Solution"}
              </button>
              <button className="danger-button" disabled={finishing || contest.status !== "RUNNING"} onClick={finish}>
                {finishing ? "Finishing..." : "Finish Contest"}
              </button>
            </div>
          </section>
        </div>
      </section>

      <aside className={`submission-drawer ${historyOpen ? "open" : ""}`} aria-hidden={!historyOpen}>
        <div className="submission-drawer-header">
          <div><h3>Contest Activity</h3><span className="muted">Standings and submission history</span></div>
          <button className="drawer-close" onClick={() => setHistoryOpen(false)} aria-label="Close submission history">×</button>
        </div>

        <h4>Standings</h4>
        <div className="standings-list">
          {standings.map((row, index) => (
            <div key={row.id || row.participantId} className="standing-row standing-row-v3">
              <span>#{row.rank || index + 1}</span>
              <span>{row.type === "BOT" ? "Bot" : "You"}</span>
              <strong>{row.score} pt</strong>
              <span>{row.penalty}m</span>
            </div>
          ))}
        </div>

        <h4>Submissions</h4>
        <div className="activity-list activity-list-v3">
          {activity.length === 0 ? <p className="muted">No submissions yet.</p> : activity.slice().reverse().map((item) => {
            const label = item.actor === "BOT" ? "Bot" : "You";
            const problemLabel = String.fromCharCode(64 + Number(item.problemOrdinal || 1));
            const elapsed = item.elapsedSeconds == null ? "" : `${Math.floor(item.elapsedSeconds / 60)}:${String(item.elapsedSeconds % 60).padStart(2, "0")}`;
            return (
              <div className="activity-row activity-row-v2" key={item.id}>
                <div>
                  <strong>{label}</strong> · Problem {problemLabel}
                  <div className="muted">
                    {elapsed ? `${elapsed} into contest` : new Date(item.submittedAt).toLocaleTimeString()} · +{item.pointsEarned ?? 0}
                    {item.hiddenTestsExecuted > 0
                      ? ` · Tests ${item.hiddenTestsPassed}/${item.hiddenTestsExecuted}`
                      : ""}
                  </div>
                </div>
                <div className="activity-actions">
                  <VerdictBadge verdict={item.verdict} />
                  <button
                    className="tiny-button"
                    disabled={loadingSubmission || (item.actor === "BOT" && contest.status !== "ENDED")}
                    onClick={() => viewSubmission(item.id)}
                  >
                    {item.actor === "BOT" && contest.status !== "ENDED" ? "After Contest" : "View Code"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
      {historyOpen && <button className="drawer-backdrop" aria-label="Close submission history" onClick={() => setHistoryOpen(false)} />}

      <SubmissionCodeModal submission={viewedSubmission} onClose={() => setViewedSubmission(null)} />
    </main>
  );
}
