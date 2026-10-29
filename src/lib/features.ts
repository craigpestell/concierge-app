// Feature flags, read from the environment at request time so they can be switched without a rebuild.
// Each one is off unless its variable is "on", "true" or "1".

function flag(name: string) {
  return ["on", "true", "1"].includes((process.env[name] ?? "").trim().toLowerCase());
}

export const features = {
  /** Multi-night house and pet sitting stays, booked as a date range and priced per night. */
  stays: () => flag("FEATURE_STAYS"),
};
