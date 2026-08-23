export default function BotCard({
  bot,
  onChallenge
}) {
  return (
    <div className="card bot-card">
      <div>
        <h3>{bot.name}</h3>
        <p>{bot.description}</p>
      </div>

      <div className="bot-meta">
        <span>
          Rating: {bot.rating}
        </span>

        <span>
          Consistency:{" "}
          {Math.round(
            bot.consistency * 100
          )}
          %
        </span>
      </div>

      <button
        className="primary-button"
        onClick={() =>
          onChallenge(bot)
        }
      >
        Challenge
      </button>
    </div>
  );
}
