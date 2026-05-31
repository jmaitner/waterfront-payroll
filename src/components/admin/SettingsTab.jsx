import { updateSettings, resetDemo } from '../../data/store.js'

// Pay period + rounding rule live here and persist to localStorage.
export default function SettingsTab({ state }) {
  const s = state.settings
  return (
    <div className="flex flex-col gap-4">
      <Section title="Pay period">
        <Segmented
          value={s.payPeriod}
          options={[
            { value: 'weekly', label: 'Weekly' },
            { value: 'biweekly', label: 'Biweekly' },
          ]}
          onChange={(v) => updateSettings({ payPeriod: v })}
        />
      </Section>

      <Section title="Rounding rule" hint="Applied to each shift's total before payroll.">
        <Segmented
          value={s.rounding}
          options={[
            { value: 'none', label: 'None (exact)' },
            { value: '15', label: 'Nearest 15 min' },
          ]}
          onChange={(v) => updateSettings({ rounding: v })}
        />
      </Section>

      <Section title="Geofence radius" hint="Punches outside this distance from a job site get flagged.">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.05"
            value={s.geofenceRadiusMiles}
            onChange={(e) => updateSettings({ geofenceRadiusMiles: parseFloat(e.target.value) })}
            className="flex-1 accent-navy"
          />
          <div className="w-20 text-right font-extrabold tabular-nums text-navy">
            {s.geofenceRadiusMiles.toFixed(2)} mi
          </div>
        </div>
      </Section>

      <Section title="Admin name" hint="Stamped on every manual time edit in the log.">
        <input
          value={s.adminName}
          onChange={(e) => updateSettings({ adminName: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
        />
      </Section>

      <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 p-4">
        <div className="text-sm font-bold text-red-700">Reset demo</div>
        <div className="mt-1 text-xs text-red-600/80">
          Wipes all shifts and restores the seed crew, jobs, and settings.
        </div>
        <button
          onClick={() => {
            if (confirm('Reset all demo data back to the seed state?')) resetDemo()
          }}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white active:scale-[0.98]"
        >
          Reset to seed data
        </button>
      </div>
    </div>
  )
}

function Section({ title, hint, children }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="font-bold text-navy">{title}</div>
      {hint && <div className="mb-3 mt-0.5 text-xs text-slate-500">{hint}</div>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </div>
  )
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${
            value === o.value ? 'bg-navy text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
