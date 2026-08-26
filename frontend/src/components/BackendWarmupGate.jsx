import { useCallback, useEffect, useRef, useState } from "react";

import { checkBackendServices, wakeBackendServices } from "../api/system.api";

const MAX_ATTEMPTS = 8;

const INITIAL_WAKE_DELAY_MS = 10000;

const RETRY_DELAY_MS = 7000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function BackendWarmupGate({ children }) {
  const [state, setState] = useState("warming");

  const [attempt, setAttempt] = useState(0);

  const [services, setServices] = useState([]);

  const [message, setMessage] = useState(
    "Sending wake requests to backend services...",
  );

  const runningRef = useRef(false);

  const cancelledRef = useRef(false);

  const initializeBackend = useCallback(async () => {
    // Prevent multiple simultaneous startup loops.
    if (runningRef.current) {
      return;
    }

    runningRef.current = true;

    setState("warming");
    setAttempt(0);
    setServices([]);

    try {
      /*
       * ---------------------------------------------------------
       * STEP 1
       *
       * Send direct browser requests to ALL Render services.
       *
       * If the services are asleep, these inbound requests should
       * trigger their Render cold starts.
       * ---------------------------------------------------------
       */

      setMessage("Waking backend services...");

      await wakeBackendServices();

      if (cancelledRef.current) {
        return;
      }

      /*
       * Render needs some time to actually boot the containers.
       *
       * Don't immediately ask Gateway for readiness because it
       * would very likely see 429/502/etc while they are starting.
       */

      setMessage("Backend services are starting...");

      await sleep(INITIAL_WAKE_DELAY_MS);

      /*
       * ---------------------------------------------------------
       * STEP 2
       *
       * Poll Gateway for actual readiness.
       * ---------------------------------------------------------
       */

      for (
        let currentAttempt = 1;
        currentAttempt <= MAX_ATTEMPTS;
        currentAttempt++
      ) {
        if (cancelledRef.current) {
          return;
        }

        setAttempt(currentAttempt);

        setMessage("Checking backend services...");

        try {
          const result = await checkBackendServices();

          if (cancelledRef.current) {
            return;
          }

          const serviceResults = Array.isArray(result?.services)
            ? result.services
            : [];

          setServices(serviceResults);

          /*
           * `ready` represents REQUIRED service readiness.
           *
           * AI can remain unavailable if Gateway marks it
           * optional.
           */

          if (result?.ready === true) {
            console.log("[FRONTEND WARMUP] Backend ready", result);

            setState("ready");
            return;
          }

          console.log(
            `[FRONTEND WARMUP] Attempt ${currentAttempt}: services still warming`,
            result,
          );
        } catch (error) {
          console.warn(
            `[FRONTEND WARMUP] Readiness attempt ${currentAttempt} failed`,
            error,
          );
        }

        if (currentAttempt < MAX_ATTEMPTS) {
          /*
           * Re-send direct browser wake requests.
           *
           * This is particularly important for services where
           * Render-to-Render wake requests are returning 429.
           */

          setMessage("Some services are still sleeping. Waking them again...");

          await wakeBackendServices();

          if (cancelledRef.current) {
            return;
          }

          await sleep(RETRY_DELAY_MS);
        }
      }

      /*
       * We deliberately do NOT leave the page permanently stuck.
       *
       * The user can retry startup or continue into the app.
       */

      if (!cancelledRef.current) {
        setState("failed");

        setMessage("Some backend services could not be started.");
      }
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    initializeBackend();

    return () => {
      cancelledRef.current = true;
    };
  }, [initializeBackend]);

  /*
   * Backend is ready.
   *
   * Only NOW do we mount AuthProvider and the rest of the app,
   * because BackendWarmupGate wraps AuthProvider in App.jsx.
   */

  if (state === "ready") {
    return children;
  }

  /*
   * Startup failed after all attempts.
   */

  if (state === "failed") {
    return (
      <main className="page-center">
        <div
          style={{
            width: "min(520px, 90vw)",
          }}
        >
          <h2>Backend services are taking longer than expected</h2>

          <p>{message}</p>

          {services.length > 0 && <ServiceList services={services} />}

          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "20px",
              flexWrap: "wrap",
            }}
          >
            <button
              className="primary-button"
              onClick={() => {
                cancelledRef.current = false;

                initializeBackend();
              }}
            >
              Retry startup
            </button>

            <button
              type="button"
              onClick={() => {
                setState("ready");
              }}
            >
              Continue anyway
            </button>
          </div>
        </div>
      </main>
    );
  }

  /*
   * Warming screen.
   */

  return (
    <main className="page-center">
      <div
        style={{
          width: "min(520px, 90vw)",
        }}
      >
        <h2>Starting CP Bot services...</h2>

        <p>
          Free backend services are waking up after inactivity. The first load
          can take around a minute.
        </p>

        <p>{message}</p>

        {attempt > 0 && (
          <p>
            Warmup attempt <strong>{attempt}</strong> of{" "}
            <strong>{MAX_ATTEMPTS}</strong>
          </p>
        )}

        {services.length > 0 && <ServiceList services={services} />}
      </div>
    </main>
  );
}

function ServiceList({ services }) {
  return (
    <div
      style={{
        marginTop: "20px",
      }}
    >
      {services.map((service) => {
        const ready = service.ready === true;

        const optional = service.required === false;

        let statusText = "";

        if (ready) {
          statusText = "ready";
        } else if (service.status) {
          statusText = `HTTP ${service.status}`;
        } else {
          statusText = "starting";
        }

        return (
          <div
            key={service.name}
            style={{
              marginBottom: "8px",
            }}
          >
            <strong>
              {ready ? "✓" : "○"} {service.name}
            </strong>

            {optional && " (optional)"}

            {" — "}

            {statusText}
          </div>
        );
      })}
    </div>
  );
}
