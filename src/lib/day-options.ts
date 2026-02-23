import type { DayOption } from "@/components/day-toggle";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nextWeekday(base: Date, weekday: number): Date {
  const output = new Date(base);
  const diff = (weekday - output.getDay() + 7) % 7;
  output.setDate(output.getDate() + diff);
  return output;
}

export function getDashboardDayOptions(now = new Date()): DayOption[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const saturday = nextWeekday(today, 6);
  const sunday = nextWeekday(today, 0);

  return [
    { key: "today", label: "Today", date: toIsoDate(today) },
    { key: "tomorrow", label: "Tomorrow", date: toIsoDate(tomorrow) },
    { key: "sat", label: "Sat", date: toIsoDate(saturday) },
    { key: "sun", label: "Sun", date: toIsoDate(sunday) },
  ];
}
