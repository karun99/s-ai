import "./styles.css";

export const metadata = {
  title: "Knowledge Chat — S-AI",
  description: "A source-grounded assistant with citations for every answer.",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
