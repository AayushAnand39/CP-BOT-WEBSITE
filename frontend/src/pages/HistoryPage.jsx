import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getChallengeHistory } from "../api/contest.api";
import ErrorBox from "../components/ErrorBox";
import Loading from "../components/Loading";

export default function HistoryPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { getChallengeHistory().then(setItems).catch(setError); }, []);
  if (error) return <main className="container"><ErrorBox error={error} /></main>;
  if (!items) return <Loading text="Loading contest history..." />;
  return <main className="container"><div className="page-header"><div><span className="eyebrow">History</span><h1>Your Bot Contests</h1><p>Completed and active bot challenges.</p></div></div><div className="history-list">{items.length === 0 ? <div className="card"><p>No contests yet.</p></div> : items.map((challenge) => <Link className="card history-row" to={challenge.status === "ENDED" ? `/result/${challenge.id}` : `/contest/${challenge.contestId}`} key={challenge.id}><div><strong>{challenge.contest?.name || "Bot Challenge"}</strong><p className="muted">{new Date(challenge.createdAt).toLocaleString()}</p></div><div><span>{challenge.status}</span>{challenge.outcome && <strong>{challenge.outcome}</strong>}{challenge.ratingDelta != null && <span className={challenge.ratingDelta >= 0 ? "positive" : "negative"}>{challenge.ratingDelta >= 0 ? "+" : ""}{challenge.ratingDelta}</span>}</div></Link>)}</div></main>;
}
