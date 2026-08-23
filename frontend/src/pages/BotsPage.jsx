import {
  useEffect,
  useState
} from "react";

import {
  useNavigate
} from "react-router-dom";

import { listBots } from "../api/bot.api";
import {
  createChallenge
} from "../api/contest.api";

import BotCard from "../components/BotCard";
import Loading from "../components/Loading";
import ErrorBox from "../components/ErrorBox";

export default function BotsPage() {
  const [bots, setBots] =
    useState([]);

  const [selected, setSelected] =
    useState(null);

  const [problemCount, setProblemCount] =
    useState(4);

  const [durationMinutes, setDurationMinutes] =
    useState(120);

  const [loading, setLoading] =
    useState(true);

  const [creating, setCreating] =
    useState(false);

  const [error, setError] =
    useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    listBots()
      .then(setBots)
      .catch(setError)
      .finally(() =>
        setLoading(false)
      );
  }, []);

  async function startChallenge() {
    try {
      setCreating(true);
      setError(null);

      const result =
        await createChallenge({
          botId: selected.slug ||
            selected.id,
          problemCount:
            Number(problemCount),
          durationSeconds:
            Number(durationMinutes) *
            60
        });

      const challenge =
        result.challenge;

      navigate(
        `/challenge/${challenge.id}`
      );
    } catch (err) {
      setError(err);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <Loading text="Loading bots..." />
    );
  }

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <span className="eyebrow">
            Opponents
          </span>

          <h1>Choose your bot</h1>

          <p>
            Higher-rated bots solve more
            consistently and faster.
          </p>
        </div>
      </div>

      <ErrorBox error={error} />

      <div className="bot-grid">
        {bots.map((bot) => (
          <BotCard
            key={bot.id}
            bot={bot}
            onChallenge={setSelected}
          />
        ))}
      </div>

      {selected && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2>
              Challenge {selected.name}
            </h2>

            <p>
              Rating {selected.rating}
            </p>

            <label>
              Problems
              <input
                type="number"
                min="1"
                max="20"
                value={problemCount}
                onChange={(e) =>
                  setProblemCount(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Duration (minutes)
              <input
                type="number"
                min="5"
                max="1440"
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(
                    e.target.value
                  )
                }
              />
            </label>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  setSelected(null)
                }
              >
                Cancel
              </button>

              <button
                className="primary-button"
                disabled={creating}
                onClick={startChallenge}
              >
                {creating
                  ? "Creating..."
                  : "Start Challenge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
