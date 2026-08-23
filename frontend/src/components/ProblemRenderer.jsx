import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "./problem-renderer.css";

function normalizeProblemText(content) {
  return String(content || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, value) => `$$${value}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, value) => `$${value}$`)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function ProblemRenderer({ content = "" }) {
  return (
    <div className="problem-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
          pre: (props) => <pre className="problem-code-block" {...props} />,
        }}
      >
        {normalizeProblemText(content)}
      </ReactMarkdown>
    </div>
  );
}
