const OpenAI = require("openai");
const { env } = require("../config/env");
const AppError = require("../utils/app-error");

function client() {
  if (!env.GROQ_API_KEY) {
    throw new AppError(
      503,
      "GROQ_API_KEY is not configured; metadata/statement can be imported but AI generator preparation cannot continue",
      "AI_NOT_CONFIGURED"
    );
  }

  return new OpenAI({
    apiKey: env.GROQ_API_KEY,
    baseURL: env.GROQ_BASE_URL
  });
}

function stripFence(value) {
  return String(value || "")
    .replace(/^```(?:cpp|c\+\+)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

async function extractConstraintsAndGenerate({
  metadata,
  page,
  solutionCode,
  problemCode
}) {
  const prompt = `
You are preparing deterministic competitive-programming test data.

Problem: ${problemCode} - ${metadata.name}
Rating: ${metadata.rating ?? "unknown"}
Tags: ${(metadata.tags || []).join(", ")}

STATEMENT:
${page.statement}

INPUT:
${page.inputFormat}

OUTPUT:
${page.outputFormat}

NOTES:
${page.notes || ""}

REFERENCE ACCEPTED C++ SOLUTION:
${solutionCode}

Return ONLY valid JSON with this exact shape:
{
  "constraints": "plain-text concise constraints extracted from the statement/input; do not invent limits",
  "concepts": ["short concept", "..."],
  "generatorCode": "complete GNU C++20 source"
}

Generator requirements:
- It must print ONE complete valid input file for this problem.
- It must use std::mt19937_64 for randomness.
- Seed with uint64_t seed = std::chrono::high_resolution_clock::now().time_since_epoch().count();
- It must respect every input constraint.
- Prefer edge-heavy/randomized legal cases.
- Never print explanatory text.
- If the problem has t test cases, generate a useful batch of cases in that one file.
- If there is no t, generate one strong legal case.
- Do not solve the problem in the generator.
- Output must be syntactically valid C++20.
`;

  const response = await client().chat.completions.create({
    model: env.GROQ_MODEL,
    temperature: 0.15,
    messages: [
      {
        role: "system",
        content:
          "Extract only supported facts and generate legal C++ testcase generators. Never fabricate problem constraints."
      },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError(502, "AI returned an empty response", "AI_EMPTY_RESPONSE");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError(502, "AI returned invalid JSON", "AI_INVALID_JSON");
  }

  if (!parsed.generatorCode || typeof parsed.generatorCode !== "string") {
    throw new AppError(502, "AI response did not contain generatorCode", "AI_GENERATOR_MISSING");
  }

  return {
    constraints: String(parsed.constraints || page.inputFormat || "").trim(),
    concepts: Array.isArray(parsed.concepts)
      ? parsed.concepts.map(String).slice(0, 20)
      : [],
    generatorCode: stripFence(parsed.generatorCode)
  };
}


async function generateManualGenerator({
  title,
  statement,
  constraints,
  inputFormat,
  outputFormat,
  solutionCode
}) {
  const prompt = `
You are preparing deterministic competitive-programming test data for a manually entered problem.

TITLE:
${title}

STATEMENT:
${statement}

CONSTRAINTS:
${constraints}

INPUT FORMAT:
${inputFormat}

OUTPUT FORMAT:
${outputFormat}

REFERENCE C++ SOLUTION:
${solutionCode}

Return ONLY valid JSON with this exact shape:
{
  "concepts": ["short concept", "..."],
  "generatorCode": "complete GNU C++20 source"
}

Generator requirements:
- It must print ONE complete valid input file for the problem.
- It must respect every supplied constraint; do not invent constraints.
- Use std::mt19937_64 for randomness.
- Seed with uint64_t seed = std::chrono::high_resolution_clock::now().time_since_epoch().count().
- Cover boundary values and randomized legal cases.
- If the input contains t test cases, generate a useful batch in that one file.
- If there is no t, generate one strong legal case.
- Do not solve the problem inside the generator.
- Never print comments/explanations to stdout.
- Output complete syntactically valid GNU C++20 code.
`;

  const response = await client().chat.completions.create({
    model: env.GROQ_MODEL,
    temperature: 0.15,
    messages: [
      {
        role: "system",
        content:
          "Generate legal competitive-programming testcase generators using only the supplied statement, formats, constraints and reference solution."
      },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError(502, "AI returned an empty response", "AI_EMPTY_RESPONSE");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError(502, "AI returned invalid JSON", "AI_INVALID_JSON");
  }

  if (!parsed.generatorCode || typeof parsed.generatorCode !== "string") {
    throw new AppError(502, "AI response did not contain generatorCode", "AI_GENERATOR_MISSING");
  }

  return {
    concepts: Array.isArray(parsed.concepts)
      ? parsed.concepts.map(String).slice(0, 20)
      : [],
    generatorCode: stripFence(parsed.generatorCode)
  };
}


async function polishManualProblem({
  title,
  statement,
  constraints,
  inputFormat,
  outputFormat,
  examples
}) {
  const prompt = `
You are a competitive-programming problem statement editor.

Clean and format the administrator's copied problem text without changing its meaning.

TITLE:
${title || ""}

STATEMENT:
${statement || ""}

CONSTRAINTS:
${constraints || ""}

INPUT FORMAT:
${inputFormat || ""}

OUTPUT FORMAT:
${outputFormat || ""}

SAMPLES:
${JSON.stringify(examples || [])}

Return ONLY valid JSON with this exact shape:
{
  "title": "clean title",
  "statement": "clean Markdown statement",
  "constraints": "clean Markdown constraints",
  "inputFormat": "clean Markdown input format",
  "outputFormat": "clean Markdown output format",
  "examples": [{"input":"...","output":"...","explanation":"..."}]
}

Rules:
- Preserve every fact, mathematical condition, variable name and limit supplied by the administrator.
- Never invent constraints, examples, guarantees or interpretation.
- Fix broken spacing, line breaks, copied HTML artifacts and awkward formatting.
- Use readable Markdown paragraphs and lists where appropriate.
- Use LaTeX only for mathematical notation, with $...$ for inline math and $$...$$ only when genuinely useful.
- Do not wrap the whole response in Markdown fences.
- Preserve sample input and output bytes/text semantically; only trim accidental outer whitespace.
- If a field is already clean, keep it essentially unchanged.
`;

  const response = await client().chat.completions.create({
    model: env.GROQ_MODEL,
    temperature: 0.05,
    messages: [
      {
        role: "system",
        content:
          "Edit competitive-programming statements conservatively. Improve presentation only; never alter problem semantics or fabricate facts."
      },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError(502, "AI returned an empty response", "AI_EMPTY_RESPONSE");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError(502, "AI returned invalid JSON", "AI_INVALID_JSON");
  }

  const normalizedExamples = Array.isArray(parsed.examples)
    ? parsed.examples.slice(0, 20).map((sample) => ({
        input: String(sample?.input || "").trim(),
        output: String(sample?.output || "").trim(),
        explanation: String(sample?.explanation || "").trim()
      }))
    : examples || [];

  return {
    title: String(parsed.title || title || "").trim(),
    statement: String(parsed.statement || statement || "").trim(),
    constraints: String(parsed.constraints || constraints || "").trim(),
    inputFormat: String(parsed.inputFormat || inputFormat || "").trim(),
    outputFormat: String(parsed.outputFormat || outputFormat || "").trim(),
    examples: normalizedExamples
  };
}


async function generateBotAttempt({
  title,
  statement,
  constraints,
  inputFormat,
  outputFormat,
  referenceSolution,
  botRating,
  problemRating,
  attemptNumber,
  bugClass
}) {
  const skillGap = botRating - problemRating;
  const prompt = `
You are modelling a competitive-programming contestant rated ${botRating} making attempt ${attemptNumber} on a ${problemRating}-rated problem.

TITLE:
${title}

STATEMENT:
${statement}

CONSTRAINTS:
${constraints}

INPUT FORMAT:
${inputFormat}

OUTPUT FORMAT:
${outputFormat}

REFERENCE ACCEPTED GNU C++20 SOLUTION:
${referenceSolution}

Return ONLY valid JSON:
{
  "sourceCode": "complete GNU C++20 source",
  "mistakeSummary": "short private diagnostic"
}

Create a PLAUSIBLE, COMPILABLE contestant attempt that is close to the reference approach but contains exactly one subtle mistake of class: ${bugClass}.
Skill gap (bot - problem): ${skillGap}.
Rules:
- Do not add comments mentioning bots, simulation, deliberate mistakes, injected bugs, or testing.
- Do not add absurd busy loops, forced exceptions, fake compile errors, or obviously nonsensical output.
- Preserve normal competitive-programming style.
- The mistake should be more elementary for lower-rated contestants and more subtle for higher-rated contestants.
- Prefer realistic boundary/overflow/edge-case/complexity/logic errors that could pass some tests.
- Keep the program syntactically valid C++20 unless the requested mistake naturally concerns compilation (it does not here).
- Do not intentionally print debug text.
- Never change input/output format.
`;

  const response = await client().chat.completions.create({
    model: env.GROQ_MODEL,
    temperature: 0.18,
    messages: [
      {
        role: "system",
        content: "Generate realistic competitive-programming contestant attempts. Never expose that the code is simulated or deliberately flawed."
      },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new AppError(502, "AI returned an empty bot attempt", "AI_EMPTY_RESPONSE");
  let parsed;
  try { parsed = JSON.parse(content); }
  catch { throw new AppError(502, "AI returned invalid bot-attempt JSON", "AI_INVALID_JSON"); }
  const sourceCode = stripFence(parsed.sourceCode);
  if (!sourceCode) throw new AppError(502, "AI response did not contain sourceCode", "AI_SOURCE_MISSING");
  return {
    sourceCode,
    mistakeSummary: String(parsed.mistakeSummary || bugClass).slice(0, 300)
  };
}

module.exports = { extractConstraintsAndGenerate, generateManualGenerator, polishManualProblem, generateBotAttempt };
