import {
  useEffect,
  useState
} from "react";

export default function useContestTimer(
  endsAt
) {
  const [remaining, setRemaining] =
    useState(0);

  useEffect(() => {
    if (!endsAt) return;

    function update() {
      setRemaining(
        Math.max(
          0,
          new Date(endsAt).getTime() -
            Date.now()
        )
      );
    }

    update();

    const interval =
      setInterval(update, 1000);

    return () =>
      clearInterval(interval);
  }, [endsAt]);

  return remaining;
}
