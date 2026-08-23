const cheerio = require("cheerio");
const { env } = require("../config/env");
const { fetchJson, fetchText } = require("../utils/http");
const AppError = require("../utils/app-error");

let lastApiAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cfApi(method, params = {}) {
  const wait = Math.max(
    0,
    env.CODEFORCES_API_GAP_MS - (Date.now() - lastApiAt)
  );

  if (wait > 0) await sleep(wait);
  lastApiAt = Date.now();

  const search = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  );

  const body = await fetchJson(
    `https://codeforces.com/api/${method}?${search.toString()}`
  );

  if (body.status !== "OK") {
    throw new AppError(
      502,
      body.comment || "Codeforces API request failed",
      "CODEFORCES_API_FAILED"
    );
  }

  return body.result;
}

async function getProblemMetadata(contestId, problemIndex) {
  // contest.standings gives the contest's problem list in one API call.
  const result = await cfApi("contest.standings", { contestId });

  const problem = result.problems.find(
    (item) =>
      Number(item.contestId) === Number(contestId) &&
      String(item.index).toUpperCase() === String(problemIndex).toUpperCase()
  );

  if (!problem) {
    throw new AppError(
      404,
      `Codeforces problem ${contestId}${problemIndex} was not found`,
      "CODEFORCES_PROBLEM_NOT_FOUND"
    );
  }

  return {
    contestId: problem.contestId,
    index: problem.index,
    name: problem.name,
    rating: problem.rating ?? null,
    tags: problem.tags || [],
    type: problem.type || "PROGRAMMING",
    points: problem.points ?? null
  };
}

function cleanText($, element) {
  const clone = $(element).clone();

  clone.find("br").replaceWith("\n");
  clone.find("p").each((_, p) => {
    $(p).append("\n");
  });
  clone.find("li").each((_, li) => {
    $(li).prepend("- ").append("\n");
  });

  return clone
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseLimit(text) {
  const match = String(text).match(/(\d+(?:\.\d+)?)\s*(second|seconds|ms|millisecond|milliseconds)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return /ms|millisecond/i.test(match[2]) ? Math.round(value) : Math.round(value * 1000);
}

function parseMemory(text) {
  const match = String(text).match(/(\d+(?:\.\d+)?)\s*(megabyte|megabytes|mb)/i);
  return match ? Math.round(Number(match[1])) : null;
}

async function scrapeProblemPage(contestId, problemIndex) {
  const url = `https://codeforces.com/problemset/problem/${contestId}/${problemIndex}`;
  const html = await fetchText(url);
  const $ = cheerio.load(html);

  const root = $(".problem-statement");
  if (!root.length) {
    throw new AppError(
      502,
      "Could not locate Codeforces problem statement in returned page",
      "CODEFORCES_STATEMENT_PARSE_FAILED",
      { url }
    );
  }

  const header = root.find(".header").first();
  const title = cleanText($, header.find(".title").first());
  const timeLimitText = cleanText($, header.find(".time-limit").first());
  const memoryLimitText = cleanText($, header.find(".memory-limit").first());

  const inputFormat = cleanText($, root.find(".input-specification").first());
  const outputFormat = cleanText($, root.find(".output-specification").first());
  const notes = cleanText($, root.find(".note").first());

  // Statement = nodes after header until input-specification.
  const chunks = [];
  let current = header.next();
  while (current.length && !current.hasClass("input-specification")) {
    if (
      !current.hasClass("output-specification") &&
      !current.hasClass("sample-tests") &&
      !current.hasClass("note")
    ) {
      const text = cleanText($, current);
      if (text) chunks.push(text);
    }
    current = current.next();
  }

  const examples = [];
  root.find(".sample-test").each((_, sample) => {
    const inputs = $(sample).find(".input pre");
    const outputs = $(sample).find(".output pre");
    const count = Math.max(inputs.length, outputs.length);

    for (let i = 0; i < count; i++) {
      examples.push({
        input: $(inputs[i]).text().replace(/\r/g, "").trimEnd(),
        output: $(outputs[i]).text().replace(/\r/g, "").trimEnd()
      });
    }
  });

  return {
    url,
    title,
    statement: chunks.join("\n\n"),
    inputFormat,
    outputFormat,
    examples,
    notes,
    timeLimitMs: parseLimit(timeLimitText) || 2000,
    memoryLimitMb: parseMemory(memoryLimitText) || 256
  };
}

async function getAcceptedCppCandidates(contestId, problemIndex) {
  const candidates = [];

  for (let page = 0; page < env.CODEFORCES_STATUS_PAGES; page++) {
    const result = await cfApi("contest.status", {
      contestId,
      from: page * env.CODEFORCES_STATUS_PAGE_SIZE + 1,
      count: env.CODEFORCES_STATUS_PAGE_SIZE
    });

    for (const submission of result) {
      if (
        submission.verdict === "OK" &&
        String(submission.problem?.index).toUpperCase() === String(problemIndex).toUpperCase() &&
        /GNU C\+\+|C\+\+/i.test(submission.programmingLanguage || "")
      ) {
        const handle = submission.author?.members?.[0]?.handle;
        if (handle) {
          candidates.push({
            submissionId: submission.id,
            handle,
            programmingLanguage: submission.programmingLanguage
          });
        }
      }
    }

    if (candidates.length >= 20 || result.length < env.CODEFORCES_STATUS_PAGE_SIZE) break;
  }

  if (!candidates.length) {
    throw new AppError(
      404,
      "No accepted public C++ submission was found in the scanned Codeforces status pages",
      "NO_ACCEPTED_CPP_SOLUTION"
    );
  }

  const uniqueHandles = [...new Set(candidates.map((c) => c.handle))].slice(0, 100);
  const users = await cfApi("user.info", {
    handles: uniqueHandles.join(";"),
    checkHistoricHandles: false
  });

  const ratingByHandle = new Map(
    users.map((user) => [user.handle, user.rating ?? 0])
  );

  return candidates
    .map((candidate) => ({
      ...candidate,
      authorRating: ratingByHandle.get(candidate.handle) || 0
    }))
    .sort((a, b) => b.authorRating - a.authorRating);
}

async function scrapeSubmissionSource(contestId, submissionId) {
  const urls = [
    `https://codeforces.com/contest/${contestId}/submission/${submissionId}`,
    `https://codeforces.com/problemset/submission/${contestId}/${submissionId}`
  ];

  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const $ = cheerio.load(html);
      const source = $("#program-source-text").text();

      if (source && source.trim().length > 20) {
        return { sourceCode: source.replace(/\r/g, ""), url };
      }
    } catch {
      // Try the alternate public submission route.
    }
  }

  throw new AppError(
    502,
    "Accepted submission page was found but source code could not be extracted",
    "SUBMISSION_SOURCE_PARSE_FAILED",
    { contestId, submissionId }
  );
}

async function getTrustedSolution(contestId, problemIndex) {
  const candidates = await getAcceptedCppCandidates(contestId, problemIndex);

  // Highest-rated author first. If a page is unavailable, try a few alternatives.
  for (const candidate of candidates.slice(0, 10)) {
    try {
      const scraped = await scrapeSubmissionSource(contestId, candidate.submissionId);
      return {
        ...candidate,
        ...scraped,
        solutionSource: "codeforces_accepted_submission"
      };
    } catch {
      // continue
    }
  }

  throw new AppError(
    502,
    "Could not extract source from the accepted Codeforces submissions found",
    "TRUSTED_SOLUTION_UNAVAILABLE"
  );
}

module.exports = {
  cfApi,
  getProblemMetadata,
  scrapeProblemPage,
  getAcceptedCppCandidates,
  scrapeSubmissionSource,
  getTrustedSolution
};
