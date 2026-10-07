import { useId, useMemo, useState } from "react";

const fallback = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "Pacific/Auckland",
];
const aliases = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Europe/Kiev": "Europe/Kyiv",
};
export function timezoneOptions(current = "Asia/Kolkata") {
  let zones = fallback;
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    /* Older browsers retain common valid zones. */
  }
  return [
    ...new Set([...zones.map((z) => aliases[z] || z), ...fallback, current]),
  ].sort();
}
export default function TimezoneSelect({
  label = "Timezone",
  name = "timezone",
  defaultValue = "Asia/Kolkata",
  disabled = false,
}) {
  const id = useId();
  const [value, setValue] = useState(defaultValue),
    [search, setSearch] = useState("");
  const options = useMemo(() => timezoneOptions(defaultValue), [defaultValue]);
  const matches = options.filter((zone) =>
    zone
      .toLowerCase()
      .replaceAll("_", " ")
      .includes(search.trim().toLowerCase().replaceAll("_", " ")),
  );
  const visible = [...new Set([value, ...matches])];
  return (
    <div className="timezone-field">
      <label htmlFor={id}>{label}</label>
      <input
        aria-label={`Search ${label.toLowerCase()}`}
        type="search"
        placeholder="Search a city or region…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled}
      />
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
        disabled={disabled}
        aria-describedby={`${id}-help`}
      >
        {visible.map((zone) => (
          <option key={zone} value={zone}>
            {zone.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <small id={`${id}-help`}>
        {search && !matches.length
          ? "No matching timezones. Your current selection is preserved."
          : "Search to narrow the list, then choose your timezone."}
      </small>
    </div>
  );
}
