import { useEffect, useState } from "react";
import { warmupBackend } from "../api/system.api";

const MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 5000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function BackendWarmupGate({ children }) {
  const [state, setState] = useState("warming");
  const [services, setServices] = useState([]);
  const [attempt, setAttempt] = useState(1);
  const [lastError, setLastError] = useState(null);

  async function runWarmup(isCancelled = () => false) {
    setState("warming");
    setLastError(null);

    for (
      let currentAttempt = 1;
      currentAttempt <= MAX_ATTEMPTS;
      currentAttempt++
    ) {
      if (isCancelled()) return;

      setAttempt(currentAttempt);

      try {
        const result = await warmupBackend();

        if (isCancelled()) return;

        setServices(result.services || []);

        if (result.ready) {
          setState("ready");
          return;
        }
      } catch (error) {
        if (isCancelled()) return;

        console.warn(
          `[FRONTEND WARMUP] attempt ${currentAttempt} failed`,
          error,
        );
        setLastError(error);
      }

      if (currentAttempt < MAX_ATTEMPTS) {
        await wait(RETRY_DELAY_MS);
      }
    }

    if (!isCancelled()) {
      setState("failed");
    }
  }

  useEffect(() => {
    let cancelled = false;
    runWarmup(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "ready") {
    return children;
  }

  if (state === "failed") {
    const notReady = services.filter(
      (service) => service.required && !service.ready,
    );

    return (
      <main className="page-center">
        <div>
          <h2>Some backend services are still unavailable</h2>

          {notReady.length > 0 ? (
            <p>
              Waiting for: {notReady.map((service) => service.name).join(", ")}
            </p>
          ) : (
            <p>The backend did not finish warming up in time.</p>
          )}

          {lastError && <p>{lastError?.message || "Warmup request failed."}</p>}

          <div className="modal-actions">
            <button className="primary-button" onClick={() => runWarmup()}>
              Retry startup
            </button>

            <button
              className="secondary-button"
              onClick={() => setState("ready")}
            >
              Continue anyway
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-center">
      <div>
        <h2>Starting CP Bot services...</h2>

        <p>
          Free backend services are waking up after inactivity. The first load
          can take around a minute.
        </p>

        <p>
          Warmup attempt {attempt} of {MAX_ATTEMPTS}
        </p>

        {services.length > 0 && (
          <div>
            {services.map((service) => (
              <div key={service.name}>
                {service.ready ? "✓" : "○"} {service.name}
                {!service.required ? " (optional)" : ""}
                {service.status ? ` — HTTP ${service.status}` : ""}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
