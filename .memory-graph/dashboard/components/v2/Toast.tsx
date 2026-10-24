"use client";

export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mg-toast" role="status" data-testid="mg-toast">
      {message}
    </div>
  );
}
