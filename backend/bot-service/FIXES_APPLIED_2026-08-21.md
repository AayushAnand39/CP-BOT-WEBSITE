
## Follow-up fixes: bot realism + stable problem tabs

- Bot solve probabilities were rebalanced so lower-rated bots no longer behave helplessly on problems around their own rating. The model still degrades naturally as problem rating exceeds bot rating and still respects consistency, strengths and weaknesses.
- Failed bot submissions no longer display the untouched correct reference solution. WA/TLE/RE/CE attempts now store a visibly imperfect attempt derived from the reference solution; AC attempts store the validated solution.
- Contest polling no longer resets the selected problem to Problem A. The polling callback now initializes Problem A only when no problem has ever been selected.
