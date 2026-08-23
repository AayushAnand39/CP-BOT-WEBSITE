import Editor from "@monaco-editor/react";

export default function SubmissionCodeModal({ submission, onClose }) {
  if (!submission) return null;
  const hiddenTests = Array.isArray(submission.hiddenTests) ? submission.hiddenTests : [];

  return (
    <div className="submission-modal-backdrop" onClick={onClose}>
      <div className="submission-modal" onClick={(e) => e.stopPropagation()}>
        <div className="submission-modal-header">
          <div>
            <strong>{submission.actor === "BOT" ? "Bot submission" : "Your submission"}</strong>
            <div className="muted">
              {submission.verdict} · {submission.language} · {new Date(submission.submittedAt).toLocaleString()}
            </div>
          </div>
          <button onClick={onClose}>Close</button>
        </div>

        {hiddenTests.length > 0 && (
          <div className="submission-modal-tests">
            <strong>Hidden testcase verdicts</strong>
            <div className="hidden-tests-grid">
              {hiddenTests.map((test, index) => (
                <div className="hidden-test-row" key={`${test.testNumber ?? index + 1}-${index}`}>
                  <span>Hidden test {test.testNumber ?? index + 1}</span>
                  <span className="muted">{test.timeMs != null ? `${test.timeMs} ms` : ""}</span>
                  <span className={`verdict-badge verdict-${String(test.verdict || "pending").toLowerCase()}`}>
                    {test.verdict || "PENDING"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {submission.actor === "BOT" && submission.sourceCode?.includes("CP Bot note") && (
          <div className="bot-source-note">
            Bot outcomes are simulated. For failed bot attempts, the exact attempted program does not exist; the validated reference solution is shown only for post-contest analysis.
          </div>
        )}

        <Editor
          height="62vh"
          language="cpp"
          theme="vs-dark"
          value={submission.sourceCode || ""}
          options={{ readOnly: true, minimap: { enabled: false }, automaticLayout: true, fontSize: 14 }}
        />
      </div>
    </div>
  );
}
