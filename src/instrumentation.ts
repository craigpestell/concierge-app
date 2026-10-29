// Runs once when the server starts. The site is a single container, so a timer here is
// enough to send booking reminders without a separate cron.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.REMINDERS === "off") return;
  const { sendDueReminders } = await import("./lib/reminders");
  const run = () =>
    sendDueReminders()
      .then((n) => n && console.log(`Sent ${n} booking reminder${n === 1 ? "" : "s"}`))
      .catch((e) => console.error("Booking reminders failed", e));
  setTimeout(run, 30_000);
  setInterval(run, 15 * 60_000).unref();
}
