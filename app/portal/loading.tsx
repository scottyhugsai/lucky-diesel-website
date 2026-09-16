export default function PortalLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="h-4 w-28 animate-pulse rounded-sm bg-gunmetal motion-reduce:animate-none" />
      <div className="h-12 w-2/3 max-w-md animate-pulse rounded-sm bg-gunmetal motion-reduce:animate-none" />
      <div className="h-40 animate-pulse rounded-md border border-line bg-carbon-2 motion-reduce:animate-none" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-36 animate-pulse rounded-md border border-line bg-carbon-2 motion-reduce:animate-none" />
        <div className="h-36 animate-pulse rounded-md border border-line bg-carbon-2 motion-reduce:animate-none" />
      </div>
    </div>
  );
}
