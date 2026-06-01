"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScheduleStatus } from "@/lib/meal-schedules";

export default function MealScheduleRowActions({
  patientId,
  scheduleId,
  status,
}: {
  patientId: string;
  scheduleId: string;
  status: ScheduleStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function patch(next: ScheduleStatus) {
    setLoading(true);
    try {
      await fetch(
        `/api/psychologist/patients/${patientId}/meal-schedules/${scheduleId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function archive() {
    setLoading(true);
    try {
      await fetch(
        `/api/psychologist/patients/${patientId}/meal-schedules/${scheduleId}`,
        { method: "DELETE" },
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {status === "ACTIVE" && (
        <button
          type="button"
          onClick={() => patch("PAUSED")}
          disabled={loading}
          className="btn-ghost text-xs"
        >
          Pausar
        </button>
      )}
      {status === "PAUSED" && (
        <button
          type="button"
          onClick={() => patch("ACTIVE")}
          disabled={loading}
          className="btn-ghost text-xs"
        >
          Reanudar
        </button>
      )}
      <button
        type="button"
        onClick={archive}
        disabled={loading}
        className="btn-ghost text-xs"
      >
        Archivar
      </button>
    </div>
  );
}
