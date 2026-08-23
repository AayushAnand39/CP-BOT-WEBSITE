import {
  useEffect,
  useState
} from "react";

import {
  useNavigate,
  useParams
} from "react-router-dom";

import {
  getChallenge
} from "../api/contest.api";

import Loading from "../components/Loading";
import ErrorBox from "../components/ErrorBox";

export default function ChallengePage() {
  const { challengeId } =
    useParams();

  const navigate =
    useNavigate();

  const [challenge, setChallenge] =
    useState(null);

  const [error, setError] =
    useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data =
          await getChallenge(
            challengeId
          );

        setChallenge(data);

        if (
          data.status === "RUNNING" &&
          data.contest?.id
        ) {
          localStorage.setItem(
            `cpbot_challenge_for_contest_${data.contest.id}`,
            challengeId
          );

          navigate(
            `/contest/${data.contest.id}`,
            {
              replace: true,
              state: {
                challengeId
              }
            }
          );
        }
      } catch (err) {
        setError(err);
      }
    }

    load();
  }, [
    challengeId,
    navigate
  ]);

  if (error) {
    return (
      <main className="container">
        <ErrorBox error={error} />
      </main>
    );
  }

  if (!challenge) {
    return (
      <Loading text="Preparing challenge..." />
    );
  }

  return (
    <main className="container">
      <h1>
        Preparing challenge...
      </h1>
    </main>
  );
}
