import { useEffect, useState } from "react";

import { warmupBackend } from "../api/system.api";

export default function BackendWarmupGate({ children }) {
  const [state, setState] = useState("warming");

  const [services, setServices] = useState([]);

  const [error, setError] = useState(null);

  const [attempt, setAttempt] = useState(1);

  async function startBackend() {
    setState("warming");
    setError(null);

    for (let currentAttempt = 1; currentAttempt <= 3; currentAttempt++) {
      setAttempt(currentAttempt);

      try {
        const result = await warmupBackend();

        setServices(result.services || []);

        if (result.success) {
          setState("ready");
          return;
        }
      } catch (err) {
        console.warn(`[FRONTEND WARMUP] attempt ${currentAttempt} failed`, err);

        setError(err);

        if (currentAttempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    setState("failed");
  }

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setState("warming");

      for (let currentAttempt = 1; currentAttempt <= 3; currentAttempt++) {
        if (cancelled) {
          return;
        }

        setAttempt(currentAttempt);

        try {
          const result = await warmupBackend();

          if (cancelled) {
            return;
          }

          setServices(result.services || []);

          if (result.success) {
            setState("ready");
            return;
          }
        } catch (err) {
          if (cancelled) {
            return;
          }

          console.warn(
            `[FRONTEND WARMUP] attempt ${currentAttempt} failed`,
            err,
          );

          setError(err);
        }

        if (currentAttempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      if (!cancelled) {
        setState("failed");
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "ready") {
    return children;
  }

  if (state === "failed") {
    return (
      <main className="page-center">
        <div>
          <h2>Backend services could not start</h2>

          <p>The free backend services may still be waking up.</p>

          <button className="primary-button" onClick={startBackend}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-center">
      <div>
        <h2>Starting CP Bot services...</h2>

        <p>
          The backend is waking up after inactivity. This may take up to a
          minute.
        </p>

        <p>Warmup attempt {attempt} of 3</p>

        {services.length > 0 && (
          <div>
            {services.map((service) => (
              <div key={service.name}>
                {service.ready ? "✓" : "○"} {service.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
