import { Bebas_Neue } from "next/font/google";

import { backgroundKeywordRows } from "@/content/background-keywords";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
});

function rowText(words: string[]) {
  return `${words.join("   ·   ")}   ·   `;
}

export function KeywordBackground() {
  return (
    <div className={`keyword-board ${bebasNeue.className}`} aria-hidden>
      <div className="keyword-board__tilt">
        {backgroundKeywordRows.map((row) => {
          const line = rowText(row.words);
          return (
            <div key={`${row.top}-${row.direction}`} className="keyword-row" style={{ top: row.top }}>
              <div
                className={`keyword-track ${
                  row.direction === "left" ? "keyword-track--left" : "keyword-track--right"
                }`}
                style={{ animationDuration: `${row.duration}s` }}
              >
                <span>{line}</span>
                <span>{line}</span>
                <span>{line}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
