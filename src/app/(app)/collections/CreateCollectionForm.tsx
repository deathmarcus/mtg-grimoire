"use client";

import { useTransition, useRef, useState } from "react";
import { createCollection } from "./actions";
import { IconPlus } from "@/components/Icons";

export function CreateCollectionForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await createCollection(formData);
      if (res.ok) {
        formRef.current?.reset();
        setError(null);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <form
        ref={formRef}
        action={handleSubmit}
        style={{
          display: "flex",
          gap: 8,
          opacity: pending ? 0.6 : undefined,
        }}
      >
        <input
          name="name"
          type="text"
          placeholder="New folder…"
          required
          maxLength={50}
          className="grimoire-input"
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          <IconPlus size={12} /> Create
        </button>
      </form>
      {error && <span className="chip neg">{error}</span>}
    </div>
  );
}
