export default function Page({ count }: { count: number }) {
  return (
    <main>
      <h1>Invoices</h1>
      <p>
        {count} invoice{count > 1 ? "s" : ""} waiting for review
      </p>
      <button type="button">Review invoices</button>
      <div className="mt-[12px] h-[1px] top-[2px] flex!">{count !== 0 ? <span>Ready</span> : null}</div>
    </main>
  );
}
