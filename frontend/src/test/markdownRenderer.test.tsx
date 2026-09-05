import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderMarkdown } from "@/components/shared/MarkdownRenderer";

describe("renderMarkdown", () => {
  it("renders a well-formed table with all cells", () => {
    render(<div>{renderMarkdown("| Company | City |\n| --- | --- |\n| Ravi Builders | Lahore |")}</div>);
    expect(screen.getByText("Company")).toBeInTheDocument();
    expect(screen.getByText("Ravi Builders")).toBeInTheDocument();
    expect(screen.getByText("Lahore")).toBeInTheDocument();
  });

  it("keeps the last column when the model omits the trailing pipe", () => {
    render(<div>{renderMarkdown("| Company | City\n| --- | ---\n| Ravi Builders | Lahore")}</div>);
    // The trailing cell used to be sliced off and never rendered.
    expect(screen.getByText("City")).toBeInTheDocument();
    expect(screen.getByText("Lahore")).toBeInTheDocument();
  });

  it("still renders content of an unterminated code fence", () => {
    // Happens whenever a response is cut off by the token limit, or mid-stream.
    render(<div>{renderMarkdown("Here is the config:\n```json\n{ \"budget\": 5000000 }")}</div>);
    expect(screen.getByText(/budget/)).toBeInTheDocument();
  });

  it("renders headings, bold text and lists", () => {
    render(<div>{renderMarkdown("## Options\n- **Ravi Builders** in Lahore\n- Noor Mahal")}</div>);
    expect(screen.getByText("Options")).toBeInTheDocument();
    expect(screen.getByText("Ravi Builders")).toBeInTheDocument();
    expect(screen.getByText("Noor Mahal")).toBeInTheDocument();
  });

  it("does not crash on empty or whitespace-only responses", () => {
    expect(() => render(<div>{renderMarkdown("")}</div>)).not.toThrow();
    expect(() => render(<div>{renderMarkdown("   \n\n  ")}</div>)).not.toThrow();
  });
});
