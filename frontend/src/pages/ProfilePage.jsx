import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { profile } =
    useAuth();

  const user =
    profile?.user || {};

  const stats =
    profile?.stats || {};

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <span className="eyebrow">
            Profile
          </span>

          <h1>
            {user.displayName ||
              user.username}
          </h1>

          <p>
            @{user.username}
          </p>
        </div>

        <div className="rating-large">
          {user.rating}
        </div>
      </div>

      <div className="stats-grid">
        {[
          [
            "Problems Solved",
            stats.problemsSolved
          ],
          [
            "Problems Attempted",
            stats.problemsAttempted
          ],
          [
            "Contests Played",
            stats.contestsPlayed
          ],
          [
            "Bot Challenges",
            stats.botChallenges
          ],
          [
            "Bot Wins",
            stats.botWins
          ],
          [
            "Submissions",
            stats.submissions
          ]
        ].map(
          ([label, value]) => (
            <div
              key={label}
              className="card stat-card"
            >
              <span>{label}</span>
              <strong>
                {value ?? 0}
              </strong>
            </div>
          )
        )}
      </div>
    </main>
  );
}
