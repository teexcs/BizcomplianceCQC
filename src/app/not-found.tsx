export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-5xl md:text-7xl mb-4">404</h1>
      <p className="text-lg text-muted-foreground max-w-md mb-8">
        This page could not be found. Please check the URL or return to the homepage.
      </p>
      <a
        href="/"
        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-6 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors"
      >
        Go home
      </a>
    </main>
  );
}
