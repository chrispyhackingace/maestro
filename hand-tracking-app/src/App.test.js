import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the full-page conducting workspace", () => {
  render(<App />);
  expect(screen.getByLabelText(/orchestra section cueing area/i)).toBeInTheDocument();
  expect(screen.getAllByText("Strings").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Woodwinds").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /start camera/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
});
