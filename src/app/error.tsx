"use client"; // Error boundaries must be Client Components

/**
 * Fallback for any page that fails to render, for example when the database
 * is unreachable. The root layout (header, footer, disclaimer) stays.
 */
export default function PageError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Try again in a moment</h1>
      <p className="text-neutral-700 dark:text-neutral-300">
        The registry couldn&apos;t load just now. Nothing you did caused this.
      </p>
      <div>
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-xl bg-neutral-900 px-5 py-3 font-semibold text-white dark:bg-white dark:text-neutral-900"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
