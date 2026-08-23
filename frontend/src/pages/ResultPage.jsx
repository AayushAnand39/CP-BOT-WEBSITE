import {
  useEffect,
  useState
} from "react";

import {
  Link,
  useLocation,
  useParams
} from "react-router-dom";

import {
  getChallenge
} from "../api/contest.api";

import {
  useAuth
} from "../context/AuthContext";

import Loading from "../components/Loading";
import ErrorBox from "../components/ErrorBox";

export default function ResultPage() {
  const { id } = useParams();

  const location =
    useLocation();

  const {
    refreshProfile
  } = useAuth();

  const challengeId =
    location.state?.challengeId ||
    id;

  const [challenge, setChallenge] =
    useState(null);

  const [error, setError] =
    useState(null);

  useEffect(() => {
    getChallenge(challengeId)
      .then(async (data) => {
        setChallenge(data);

        if (
          data.status === "ENDED"
        ) {
          await refreshProfile();
        }
      })
      .catch(setError);
  }, [challengeId]);

  if (error) {
    return (
      <main className="container">
        <ErrorBox error={error} />
      </main>
    );
  }

  if (!challenge) {
    return (
      <Loading text="Loading result..." />
    );
  }

  if (
    challenge.status !== "ENDED"
  ) {
    return (
      <main className="container result-card">
        <h1>
          Contest is still running
        </h1>

        <Link
          to={`/contest/${challenge.contestId}`}
          className="primary-button"
        >
          Return to Contest
        </Link>
      </main>
    );
  }

  return (
    <main className="container">
      <section className="result-card">
        <span className="eyebrow">
          Challenge complete
        </span>

        <h1>
          {challenge.outcome}
        </h1>

        <div className="rating-change">
          <span>
            {challenge.ratingBefore}
          </span>

          <span>→</span>

          <strong>
            {challenge.ratingAfter}
          </strong>
        </div>

        <p
          className={
            challenge.ratingDelta >= 0
              ? "positive"
              : "negative"
          }
        >
          {challenge.ratingDelta >= 0
            ? "+"
            : ""}
          {challenge.ratingDelta}
        </p>

        <div className="result-actions">
          <Link
            to={`/contest/${challenge.contestId}`}
            state={{ challengeId: challenge.id, review: true }}
            className="secondary-button"
          >
            Review Submissions
          </Link>

          <Link
            to="/bots"
            className="primary-button"
          >
            Challenge Another Bot
          </Link>
        </div>
      </section>
    </main>
  );
}
