import { HEADLINE, HOW_IT_WORKS, PRODUCT_NAME } from "@/lib/copy";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-10 px-4 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-neutral-500">{PRODUCT_NAME}</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{HEADLINE}</h1>
      </header>

      <section aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-lg font-semibold">
          How it works
        </h2>
        <ol className="mt-4 flex flex-col gap-4">
          {HOW_IT_WORKS.map((item, i) => (
            <li key={item.step} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">
                {i + 1}
              </span>
              <p className="text-base">
                <span className="font-semibold">{item.step}.</span> {item.text}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
