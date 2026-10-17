import Groq from "groq-sdk";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs/promises";

// Embedded Groq API key
const GROQ_API_KEY =
  process.env.GROQ_API_KEY;

const groq = new Groq({ apiKey: GROQ_API_KEY });

// Supported language choices
const LANGUAGES = {
  en: "English",
  ar: "Arabic (العربية)",
  jp: "Japanese (日本語)",
  de: "German (Deutsch)",
  gr: "German (Deutsch)",
  fr: "French (Français)",
};

const DIFFICULTIES = ["easy", "medium", "hard"];

async function promptUser() {
  const rl = readline.createInterface({ input, output });

  console.log("\n==============================================");
  console.log("       🧠 GROQ AI QUIZ GENERATOR (MCQ)        ");
  console.log("==============================================\n");

  // 1. Topic
  let topic = "";
  while (!topic.trim()) {
    topic = await rl.question("📌 Enter the Quiz Subject / Topic: ");
  }

  // 2. Difficulty
  let difficulty = "";
  while (!DIFFICULTIES.includes(difficulty.toLowerCase())) {
    difficulty = await rl.question(
      "⚡ Select Difficulty (easy / medium / hard): "
    );
  }
  difficulty = difficulty.toLowerCase();

  // 3. Language
  console.log("\nSupported Languages:");
  console.log(" • en  -> English");
  console.log(" • ar  -> Arabic");
  console.log(" • jp  -> Japanese (Horizontal)");
  console.log(" • de  -> German (or 'gr')");
  console.log(" • fr  -> French");

  let langKey = "";
  while (!LANGUAGES[langKey.toLowerCase()]) {
    langKey = await rl.question("\n🌐 Select Language Code [en/ar/jp/de/fr]: ");
  }
  langKey = langKey.toLowerCase();
  if (langKey === "gr") langKey = "de"; // Normalize

  rl.close();

  return {
    topic: topic.trim(),
    difficulty,
    languageCode: langKey,
    languageName: LANGUAGES[langKey],
  };
}

async function generateQuiz({ topic, difficulty, languageCode, languageName }) {
  console.log(
    `\n⏳ Generating 10 ${difficulty.toUpperCase()} questions on "${topic}" in ${languageName}...`
  );

  const systemMessage = `You are a helpful assistant designed to output JSON. You are an expert exam author.

Strict Rules:
1. Always output a single valid JSON object.
2. Generate exactly 10 questions.
3. Every question must have exactly 4 choices: "A", "B", "C", and "D".
4. ANTI-CHEAT RULE (EQUAL LENGTH): All 4 choices for each question MUST be roughly the same character length. Never make the correct answer noticeably longer, more descriptive, or more detailed than the distractors.
5. All questions, options, and explanations must be written fluently in ${languageName}.`;

  const userMessage = `Create a 10-question MCQ quiz about "${topic}" with difficulty level "${difficulty}".

You must return valid JSON matching this schema:
{
  "quiz_title": "Quiz Title",
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "language": "${languageCode}",
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": {
        "A": "Choice A text",
        "B": "Choice B text",
        "C": "Choice C text",
        "D": "Choice D text"
      },
      "correct_answer": "A",
      "explanation": "Brief 1-sentence reason."
    }
  ]
}`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      model: "openai/gpt-oss-120b",
      temperature: 0.5,
      max_tokens: 4096, // Prevents cutoff mid-JSON
      response_format: { type: "json_object" },
    });

    const rawContent = chatCompletion.choices[0]?.message?.content || "{}";

    // Clean any stray markdown tags if present
    const cleanedContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

    const quizData = JSON.parse(cleanedContent);
    return quizData;
  } catch (error) {
    console.error("❌ Failed to query Groq API:", error.message);
    throw error;
  }
}

async function main() {
  try {
    const config = await promptUser();
    const quiz = await generateQuiz(config);

    // Save directly to qa.json
    const fileName = "qa.json";
    await fs.writeFile(fileName, JSON.stringify(quiz, null, 2), "utf-8");

    console.log("\n==============================================");
    console.log("✅ QUIZ GENERATED SUCCESSFULLY!");
    console.log(`📁 File created: ${fileName}`);
    console.log("==============================================\n");

    // Preview Question 1
    const q1 = quiz.questions?.[0];
    if (q1) {
      console.log(`Preview [Q1]: ${q1.question}`);
      Object.entries(q1.options).forEach(([k, v]) => {
        const mark = k === q1.correct_answer ? "✔ [CORRECT]" : " ";
        console.log(`  ${k}) ${v} (${v.length} chars) ${mark}`);
      });
      console.log(`\n👉 All 10 questions saved in ${fileName}`);
    }
  } catch (err) {
    console.error("\n❌ Execution error:", err.message);
  }
}

main();